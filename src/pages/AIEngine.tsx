import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions, Modal, ActivityIndicator } from "react-native";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Wrench,
  FlaskConical,
  ArrowRight,
  Loader2,
  Mic,
  MicOff,
  FileText,
  ChevronDown,
  X,
  FileSearch
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { useVoiceInput } from "@/hooks/useVoice";
import { WorkflowRecommender, RecommendedStep } from "@/lib/WorkflowRecommender";
import diasDataset from "@/data/dias_lab_workflow.json";

type Output = {
  diagnosis: string;
  confidence: "High" | "Medium" | "Low";
  steps: string[];
  instruments: string[];
  materials: string[];
  alerts: string[];
};

const procedures: Record<string, Output> = {
  "access cavity": {
    diagnosis: "Irreversible Pulpitis — Tooth 36",
    confidence: "High",
    steps: [
      "Locate all canals (MB, ML, DB, DL) under magnification",
      "Establish glide path with #10 K-file to working length",
      "Select initial rotary file (ProTaper SX → S1)",
      "Begin irrigation protocol: 3% NaOCl, EDTA 17%, saline rinse",
      "Determine working length with apex locator + IOPA confirmation",
    ],
    instruments: ["DG-16 endodontic explorer", "Endo-Z bur", "K-files #10–#25", "Rotary endomotor", "Apex locator"],
    materials: ["3% Sodium Hypochlorite", "17% EDTA", "Saline", "Calcium hydroxide (intracanal)"],
    alerts: ["Verify rubber dam isolation before irrigation.", "Avoid binding files past WL — risk of perforation."],
  },
  "crown prep": {
    diagnosis: "Crown Preparation — Tooth 11",
    confidence: "High",
    steps: [
      "Select appropriate diamond burs (tapered chamfer)",
      "Reduce occlusal surface by 1.5mm - 2.0mm",
      "Prepare axial walls with 6-degree taper",
      "Refine gingival finish line (chamfer)",
      "Take final impression using PVS material",
    ],
    instruments: ["High-speed handpiece", "Diamond burs", "Retraction cord", "Impression trays"],
    materials: ["PVS impression material", "Retraction solution", "Temporary cement"],
    alerts: ["Ensure adequate clearance for material thickness.", "Protect adjacent teeth with metal matrix."],
  },
  "extraction": {
    diagnosis: "Non-restorable Caries — Tooth 46",
    confidence: "High",
    steps: [
      "Administer local anesthesia (IANB + Long Buccal)",
      "Sever periodontal ligament using periotome",
      "Luxate tooth with straight elevator",
      "Engage tooth with appropriate forceps (Lower molar)",
      "Debride socket and verify hemostasis",
    ],
    instruments: ["Periotome", "Straight elevator", "Molar forceps", "Curette"],
    materials: ["Local Anesthetic (Articaine 4%)", "Gauze", "Gelfoam (if needed)"],
    alerts: ["Monitor patient vitals.", "Warn patient about post-op numbness."],
  },
};

const confidenceColors: Record<Output["confidence"], string> = {
  High: "#22C55E",
  Medium: "#F59E0B",
  Low: "#EF4444",
};

const AIEngine = () => {
  const [input, setInput] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [stage, setStage] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const [loading, setLoading] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<string | null>(null);
  const [fetchingFile, setFetchingFile] = useState(false);

  const [selectedProcedure, setSelectedProcedure] = useState<any>(null);
  const [selectedStep, setSelectedStep] = useState<any>(null);
  const [showProcPicker, setShowProcPicker] = useState(false);
  const [showStepPicker, setShowStepPicker] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedStep[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  // Load the dataset directly for the pickers
  // diasDataset is now imported at the top

  useEffect(() => {
    const fetchCases = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('cases')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setCases(data);
    };
    fetchCases();
  }, []);

  // Update recommendations when selection changes
  useEffect(() => {
    const updateRecs = async () => {
      if (selectedProcedure && selectedStep) {
        setRecLoading(true);
        const recs = await WorkflowRecommender.recommendNextSteps(
          selectedProcedure.id,
          selectedStep.id,
          { diagnosis: symptoms || selectedCase?.diagnosis || "" }
        );
        setRecommendations(recs);
        setRecLoading(false);
      } else {
        setRecommendations([]);
      }
    };
    updateRecs();
  }, [selectedProcedure, selectedStep, symptoms, selectedCase]);

  const handleSelectCase = async (patientCase: any) => {
    setSelectedCase(patientCase);
    setShowCasePicker(false);
    setFileAnalysis(null);

    // Pre-fill input fields from case data
    setSymptoms(patientCase.diagnosis || "");
    setStage(patientCase.status?.replace(/-/g, ' ') || "");
    setInput(`Patient: ${patientCase.patient_name}, Tooth: ${patientCase.tooth_number}, Diagnosis: ${patientCase.diagnosis}`);

    // Fetch latest uploaded file for this patient
    setFetchingFile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: storageFiles } = await supabase.storage
        .from('clinical-files')
        .list(user.id);

      if (storageFiles && storageFiles.length > 0) {
        const sanitizedName = patientCase.patient_name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const patientFiles = storageFiles.filter(f =>
          f.name.toLowerCase().startsWith(sanitizedName.toLowerCase())
        );

        if (patientFiles.length > 0) {
          // Sort by most recent and get the latest
          const latestFile = patientFiles.sort((a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          )[0];

          const { data: urlData } = await supabase.storage
            .from('clinical-files')
            .createSignedUrl(`${user.id}/${latestFile.name}`, 3600);

          if (urlData?.signedUrl) {
            // Generate analysis based on file metadata + case data
            const ext = latestFile.name.split('.').pop()?.toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
            const fileType = isImage ? 'radiograph/image' : 'document/report';

            setFileAnalysis(
              `📎 Latest ${fileType} detected for ${patientCase.patient_name}\n\n` +
              `File: ${latestFile.name.split('--').pop() || latestFile.name}\n` +
              `Uploaded: ${new Date(latestFile.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n` +
              `Based on the clinical record for Tooth ${patientCase.tooth_number} with diagnosis of "${patientCase.diagnosis}", ` +
              `the uploaded ${fileType} has been linked to this case. ` +
              `Cross-reference with the AI suggestion below for complete clinical guidance.`
            );
          } else {
            setFileAnalysis(`No files found for ${patientCase.patient_name}. Upload a report from the Records page for file-linked analysis.`);
          }
        } else {
          setFileAnalysis(`No reports uploaded yet for ${patientCase.patient_name}. Go to Records → Patient Card → tap to open → Files tab to upload.`);
        }
      } else {
        setFileAnalysis(`No files found in storage. Upload a report from the Records page to enable file analysis.`);
      }
    } catch (err) {
      setFileAnalysis("Could not fetch patient files. Please try again.");
    } finally {
      setFetchingFile(false);
    }
  };

  const { isListening, startListening, stopListening, browserSupportsSpeechRecognition } = useVoiceInput((text) => {
    setInput(originalText ? `${originalText} ${text}` : text);
  });
  const handleToggleVoice = () => {
    if (isListening) { stopListening(); }
    else { setOriginalText(input); startListening(); }
  };

  const handleSuggest = async () => {
    if (!input.trim() && !symptoms.trim() && !selectedProcedure) return;

    setLoading(true);

    try {
      let relevantLabContext = "";
      
      if (selectedProcedure) {
        relevantLabContext = `\n\n[CRITICAL LAB WORKFLOW DATA]\nYou MUST use the following lab workflow for your response:\nCategory: ${selectedProcedure.category}\nWork Type: ${selectedProcedure.work_type}\nLab Steps:\n${selectedProcedure.steps.map((s: any) => `- Step ${s.order}: ${s.name} (Component: ${s.component}, Cost: ${s.cost})`).join('\n')}\n`;
        if (selectedStep) {
          relevantLabContext += `\nThe doctor is currently on Step ${selectedStep.order} (${selectedStep.name}). Focus your guidance on completing this step and preparing for the next.`;
          
          if (recommendations.length > 0) {
            relevantLabContext += `\n\n[RECOMMENDED NEXT STEPS BY ALGORITHM]\nThe system recommends these steps next:\n${recommendations.map(r => `- ${r.name} (Confidence: ${Math.round(r.score * 100)}%, Reason: ${r.reasons.join(', ')})`).join('\n')}\nPlease align your advice with these recommendations where clinically appropriate.`;
          }
        }
      } else if (stage.trim()) {
        const stageQuery = stage.toLowerCase().trim();
        const matchedProcedure = diasDataset.procedures.find((p: any) => 
          p.category.toLowerCase().includes(stageQuery) || 
          p.work_type.toLowerCase().includes(stageQuery) ||
          p.steps.some((s: any) => s.name.toLowerCase().includes(stageQuery))
        );
        
        if (matchedProcedure) {
          relevantLabContext = `\n\n[CRITICAL LAB WORKFLOW DATA]\nYou MUST use the following lab workflow for your response:\nCategory: ${matchedProcedure.category}\nWork Type: ${matchedProcedure.work_type}\nLab Steps:\n${matchedProcedure.steps.map((s: any) => `- Step ${s.order}: ${s.name} (Component: ${s.component}, Cost: ${s.cost})`).join('\n')}\n`;
        }
      }

      const procedureInfo = selectedProcedure ? `${selectedProcedure.category} - ${selectedProcedure.work_type}` : stage;
      const stepInfo = selectedStep ? `Step ${selectedStep.order}: ${selectedStep.name}` : "";
      
      const combinedInput = `Patient Symptoms: ${symptoms}\nProcedure Stage: ${procedureInfo} ${stepInfo}\nDoctor Observations: ${input}`;

      const prompt = `You are an expert dental AI assistant. Based on the following clinical input, provide a diagnostic assessment and procedural guidance.
Input: ${combinedInput}${relevantLabContext}

You MUST return ONLY a valid JSON object with the exact following structure, no markdown formatting or backticks:
{
  "diagnosis": "Short diagnostic string including tooth number if applicable",
  "confidence": "High", "Medium", or "Low",
  "steps": ["Step 1", "Step 2", ...],
  "instruments": ["Instrument 1", ...],
  "materials": ["Material 1", ...],
  "alerts": ["Clinical alert 1", ...]
}`;

      // Call our secure Vercel backend proxy instead of Google directly
      const response = await fetch('/api/gemini', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = errorText;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error && parsed.error.message) errorMsg = parsed.error.message;
        } catch(e) {}
        throw new Error(`API Error: ${errorMsg}`);
      }

      const result = await response.json();
      let textResponse = result.candidates[0].content.parts[0].text;
      
      // Clean up markdown formatting if Gemini returns it inside code blocks
      textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsedOutput = JSON.parse(textResponse) as Output;

      setOutput(parsedOutput);
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      // Show actual error instead of static fallback
      setOutput({
        diagnosis: "API Error: Could not generate insights",
        confidence: "Low",
        steps: ["Check your network connection", "Ensure the API key is valid", "Try rewording your prompt", error.message || "Unknown error occurred"],
        instruments: ["N/A"],
        materials: ["N/A"],
        alerts: ["The AI generation failed. Please try again."]
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <View style={styles.container}>
        <Text style={styles.description}>
          Share your clinical findings or the current procedure step to get AI-validated guidance.
        </Text>

        {/* Patient Case Selector */}
        <TouchableOpacity style={styles.patientSelector} onPress={() => setShowCasePicker(true)}>
          <FileSearch size={16} color="#0EA5E9" />
          <Text style={styles.patientSelectorText}>
            {selectedCase ? selectedCase.patient_name : "Select a Patient Case"}
          </Text>
          <ChevronDown size={16} color="#94A3B8" />
        </TouchableOpacity>

        {/* Patient Picker Modal */}
        <Modal visible={showCasePicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Patient Case</Text>
                <TouchableOpacity onPress={() => setShowCasePicker(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {cases.length === 0 ? (
                  <Text style={styles.emptyPickerText}>No cases found. Add cases from the Records page.</Text>
                ) : (
                  cases.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.casePickerItem}
                      onPress={() => handleSelectCase(c)}
                    >
                      <View style={styles.casePickerAvatar}>
                        <Text style={styles.casePickerAvatarText}>{c.patient_name?.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.casePickerName}>{c.patient_name}</Text>
                        <Text style={styles.casePickerMeta}>Tooth {c.tooth_number} · {c.diagnosis}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Procedure Picker Modal */}
        <Modal visible={showProcPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Operation / Surgery</Text>
                <TouchableOpacity onPress={() => setShowProcPicker(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {diasDataset.procedures.map((p: any) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.casePickerItem}
                    onPress={() => {
                      setSelectedProcedure(p);
                      setSelectedStep(null); // Reset step when procedure changes
                      setShowProcPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.casePickerName}>{p.category} - {p.work_type}</Text>
                      <Text style={styles.casePickerMeta}>{p.steps.length} steps in workflow</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Step Picker Modal */}
        <Modal visible={showStepPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Current Step</Text>
                <TouchableOpacity onPress={() => setShowStepPicker(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {selectedProcedure?.steps.map((s: any) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.casePickerItem}
                    onPress={() => {
                      setSelectedStep(s);
                      setShowStepPicker(false);
                    }}
                  >
                    <View style={styles.casePickerAvatar}>
                      <Text style={styles.casePickerAvatarText}>{s.order}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.casePickerName}>Step {s.order}: {s.name}</Text>
                      <Text style={styles.casePickerMeta}>{s.component}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* File Analysis Card */}
        {(fetchingFile || fileAnalysis) && (
          <View style={styles.fileAnalysisCard}>
            <View style={styles.fileAnalysisHeader}>
              <FileText size={14} color="#8B5CF6" />
              <Text style={styles.fileAnalysisTitle}>Report Analysis</Text>
            </View>
            {fetchingFile ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.fileAnalysisText}>Fetching latest report...</Text>
              </View>
            ) : (
              <Text style={styles.fileAnalysisText}>{fileAnalysis}</Text>
            )}
          </View>
        )}

        <View style={styles.entrySection}>
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Clinical Symptoms</Text>
            <TextInput
              placeholder="e.g. Sharp pain, sensitivity..."
              style={styles.smallInput}
              value={symptoms}
              onChangeText={setSymptoms}
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <TouchableOpacity style={styles.inputCard} onPress={() => setShowProcPicker(true)}>
                <Text style={styles.inputLabel}>Operation / Topic</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 36 }}>
                  <Text style={{ fontSize: 12, color: selectedProcedure ? '#0F172A' : '#94A3B8' }} numberOfLines={1}>
                    {selectedProcedure ? `${selectedProcedure.category} - ${selectedProcedure.work_type}` : "Select Procedure..."}
                  </Text>
                  <ChevronDown size={14} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.gridItem}>
              <TouchableOpacity style={styles.inputCard} onPress={() => selectedProcedure && setShowStepPicker(true)}>
                <Text style={styles.inputLabel}>Current Step</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 36 }}>
                  <Text style={{ fontSize: 12, color: selectedStep ? '#0F172A' : (selectedProcedure ? '#94A3B8' : '#CBD5E1') }} numberOfLines={1}>
                    {selectedStep ? `Step ${selectedStep.order}: ${selectedStep.name}` : "Select Step..."}
                  </Text>
                  <ChevronDown size={14} color={selectedProcedure ? "#94A3B8" : "#CBD5E1"} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mainInputCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.inputLabel}>Observations & Thoughts</Text>
              <View style={styles.headerActions}>
                {(input.length > 0 || symptoms.length > 0 || stage.length > 0) && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => {
                      setInput("");
                      setOriginalText("");
                      setSymptoms("");
                      setStage("");
                      setOutput(null);
                    }}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {browserSupportsSpeechRecognition && (
                  <TouchableOpacity
                    style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
                    onPress={handleToggleVoice}
                  >
                    {isListening ? (
                      <MicOff size={14} color="#EF4444" />
                    ) : (
                      <Mic size={14} color="#0EA5E9" />
                    )}
                    <Text style={[styles.voiceButtonText, isListening && styles.voiceButtonTextActive]}>
                      {isListening ? "Stop Listening" : "Voice Guide"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Describe what you see or where you are stuck..."
              multiline
              style={styles.textarea}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity
              onPress={handleSuggest}
              style={styles.suggestButton}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} color="#FFFFFF" /> : <Sparkles size={16} color="#FFFFFF" />}
              <Text style={styles.suggestButtonText}>Get AI Clinical Insight</Text>
            </TouchableOpacity>
          </View>
        </View>

        {output && !loading && (
          <View style={styles.outputSection}>
            {/* Recommended Path Card (Algorithm Result) */}
            {recommendations.length > 0 && (
              <View style={styles.recommendationCard}>
                <View style={styles.cardTitleRow}>
                  <Sparkles size={16} color="#8B5CF6" />
                  <Text style={[styles.cardTitle, { color: '#8B5CF6' }]}>AI Recommended Path</Text>
                </View>
                <View style={styles.recsList}>
                  {recommendations.map((rec, i) => (
                    <View key={rec.id} style={styles.recItem}>
                      <View style={[styles.recBadge, i === 0 && styles.recBadgePrimary]}>
                        <Text style={styles.recBadgeText}>{Math.round(rec.score * 100)}% Match</Text>
                      </View>
                      <View style={styles.recContent}>
                        <Text style={styles.recName}>{rec.name}</Text>
                        <Text style={styles.recMeta}>{rec.reasons[0] || "Standard workflow progression"}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Diagnosis card */}
            <View style={styles.diagnosisCard}>
              <View style={styles.diagnosisHeader}>
                <Text style={styles.diagnosisLabel}>Suggested diagnosis</Text>
                <View style={[styles.confidenceBadge, { backgroundColor: confidenceColors[output.confidence] }]}>
                  <ShieldCheck size={10} color="#FFFFFF" />
                  <Text style={styles.confidenceText}>{output.confidence}</Text>
                </View>
              </View>
              <Text style={styles.diagnosisTitle}>{output.diagnosis}</Text>
            </View>

            {/* Next steps */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <ArrowRight size={16} color="#0EA5E9" />
                <Text style={styles.cardTitle}>Next steps</Text>
              </View>
              <View style={styles.stepsList}>
                {output.steps.map((step, i) => (
                  <View key={i} style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{i + 1}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                    <CheckCircle2 size={16} color="#CBD5E1" />
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Wrench size={16} color="#8B5CF6" />
                <Text style={styles.cardTitle}>Instruments</Text>
              </View>
              <View style={styles.list}>
                {output.instruments.map((item) => (
                  <View key={item} style={styles.listItem}>
                    <View style={[styles.dot, { backgroundColor: "#8B5CF6" }]} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <FlaskConical size={16} color="#F43F5E" />
                <Text style={styles.cardTitle}>Materials</Text>
              </View>
              <View style={styles.list}>
                {output.materials.map((item) => (
                  <View key={item} style={styles.listItem}>
                    <View style={[styles.dot, { backgroundColor: "#F43F5E" }]} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Alerts */}
            <View style={styles.alertCard}>
              <AlertTriangle size={20} color="#F59E0B" />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Verify clinically before proceeding</Text>
                {output.alerts.map((alert) => (
                  <Text key={alert} style={styles.alertText}>• {alert}</Text>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 20,
  },
  description: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  entrySection: {
    gap: 16,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
  inputCard: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  smallInput: {
    fontSize: 12,
    color: "#0F172A",
    height: 36,
    padding: 0,
  },
  mainInputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
    gap: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 32,
  },
  voiceButtonActive: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "#EF4444",
  },
  voiceButtonText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  voiceButtonTextActive: {
    color: "#EF4444",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clearButton: {
    paddingHorizontal: 12,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  clearButtonText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  textarea: {
    fontSize: 14,
    color: "#0F172A",
    minHeight: 120,
    textAlignVertical: "top",
    padding: 0,
  },
  suggestButton: {
    backgroundColor: "#0EA5E9",
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  suggestButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  outputSection: {
    gap: 16,
  },
  diagnosisCard: {
    backgroundColor: "rgba(14, 165, 233, 0.05)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: "rgba(14, 165, 233, 0.2)",
  },
  diagnosisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  diagnosisLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#0EA5E9",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  diagnosisTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepText: {
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 20,
  },
  list: {
    gap: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listText: {
    fontSize: 14,
    color: "#0F172A",
  },
  alertCard: {
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  alertContent: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  alertText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
  spin: {
    // Rotation logic in RN usually requires Animated API
  },
  pulse: {
    // Pulse logic in RN usually requires Animated API
  },
  patientSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  patientSelectorText: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  casePickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  casePickerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  casePickerAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0EA5E9",
  },
  casePickerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  casePickerMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  emptyPickerText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    padding: 24,
  },
  fileAnalysisCard: {
    backgroundColor: "rgba(139, 92, 246, 0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    gap: 8,
  },
  fileAnalysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fileAnalysisTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8B5CF6",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fileAnalysisText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
  recommendationCard: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    marginBottom: 8,
  },
  recsList: {
    gap: 12,
  },
  recItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  recBadgePrimary: {
    backgroundColor: "#8B5CF6",
  },
  recBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  recContent: {
    flex: 1,
  },
  recName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E1B4B",
  },
  recMeta: {
    fontSize: 11,
    color: "#6D6E9C",
    marginTop: 2,
  },
});

export default AIEngine;
