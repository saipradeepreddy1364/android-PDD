import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from "react-native";
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
  FileSearch,
  ListChecks,
} from "lucide-react-native";
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

type DatasetStep = {
  id: string;
  order: number;
  name: string;
  component: string;
  cost: number;
};

type DatasetProcedure = {
  id: string;
  category: string;
  work_type: string;
  steps: DatasetStep[];
};

const confidenceColors: Record<Output["confidence"], string> = {
  High: "#22C55E",
  Medium: "#F59E0B",
  Low: "#EF4444",
};

const AIEngine = () => {
  const [input, setInput] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const [loading, setLoading] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<string | null>(null);
  const [fetchingFile, setFetchingFile] = useState(false);

  const [selectedProcedure, setSelectedProcedure] = useState<DatasetProcedure | null>(null);
  const [selectedStep, setSelectedStep] = useState<DatasetStep | null>(null);
  const [showProcPicker, setShowProcPicker] = useState(false);
  const [showStepPicker, setShowStepPicker] = useState(false);

  // Dataset next steps state (separate from AI)
  const [datasetSteps, setDatasetSteps] = useState<RecommendedStep[]>([]);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetSearched, setDatasetSearched] = useState(false);

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

  // Reset dataset results when procedure/step changes
  useEffect(() => {
    setDatasetSteps([]);
    setDatasetSearched(false);
  }, [selectedProcedure, selectedStep]);

  const handleSelectCase = async (patientCase: any) => {
    setSelectedCase(patientCase);
    setShowCasePicker(false);
    setFileAnalysis(null);
    setSymptoms(patientCase.diagnosis || "");
    setInput(`Patient: ${patientCase.patient_name}, Tooth: ${patientCase.tooth_number}, Diagnosis: ${patientCase.diagnosis}`);

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
          const latestFile = patientFiles.sort((a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          )[0];

          const { data: urlData } = await supabase.storage
            .from('clinical-files')
            .createSignedUrl(`${user.id}/${latestFile.name}`, 3600);

          if (urlData?.signedUrl) {
            const ext = latestFile.name.split('.').pop()?.toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
            const fileType = isImage ? 'radiograph/image' : 'document/report';
            setFileAnalysis(
              `📎 Latest ${fileType} detected for ${patientCase.patient_name}\n\n` +
              `File: ${latestFile.name.split('--').pop() || latestFile.name}\n` +
              `Uploaded: ${new Date(latestFile.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n` +
              `Based on the clinical record for Tooth ${patientCase.tooth_number} with diagnosis of "${patientCase.diagnosis}", ` +
              `the uploaded ${fileType} has been linked to this case.`
            );
          } else {
            setFileAnalysis(`No files found for ${patientCase.patient_name}.`);
          }
        } else {
          setFileAnalysis(`No reports uploaded yet for ${patientCase.patient_name}.`);
        }
      } else {
        setFileAnalysis(`No files found in storage.`);
      }
    } catch (err) {
      setFileAnalysis("Could not fetch patient files.");
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

  // --- Button 1: Get AI Clinical Insight (uses Gemini API only) ---
  const handleAISuggest = async () => {
    if (!input.trim() && !symptoms.trim()) return;
    setLoading(true);
    setOutput(null);

    try {
      let procedureContext = "";
      if (selectedProcedure) {
        procedureContext = `\nProcedure: ${selectedProcedure.category} - ${selectedProcedure.work_type}`;
        if (selectedStep) {
          procedureContext += `\nCurrent Step: Step ${selectedStep.order} - ${selectedStep.name}`;
        }
      }

      const combinedInput = `Patient Symptoms: ${symptoms}\nDoctor Observations: ${input}${procedureContext}`;

      const prompt = `You are an expert dental AI assistant. Based on the following clinical input, provide a diagnostic assessment and procedural guidance.
Input: ${combinedInput}

You MUST return ONLY a valid JSON object with the exact following structure, no markdown formatting or backticks:
{
  "diagnosis": "Short diagnostic string including tooth number if applicable",
  "confidence": "High",
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
  "instruments": ["Instrument 1", "Instrument 2", "Instrument 3"],
  "materials": ["Material 1", "Material 2", "Material 3"],
  "alerts": ["Clinical alert 1", "Clinical alert 2"]
}`;

      const response = await fetch('/api/gemini', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const result = await response.json();
      let textResponse = result.candidates[0].content.parts[0].text;
      textResponse = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsedOutput = JSON.parse(textResponse) as Output;
      setOutput(parsedOutput);
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      setOutput({
        diagnosis: "API Error — could not generate insights",
        confidence: "Low",
        steps: ["Check your network connection", "Ensure the API key is valid", error.message || "Unknown error"],
        instruments: ["N/A"],
        materials: ["N/A"],
        alerts: ["AI generation failed. Please try again."]
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Button 2: Search Next Steps from Dataset ---
  const handleDatasetSearch = async () => {
    if (!selectedProcedure) {
      alert("Please select an Operation / Topic first to search the dataset.");
      return;
    }

    setDatasetLoading(true);
    setDatasetSteps([]);
    setDatasetSearched(false);

    try {
      if (selectedStep) {
        // Use WorkflowRecommender if a step is selected
        const recs = await WorkflowRecommender.recommendNextSteps(
          selectedProcedure.id,
          selectedStep.id,
          { diagnosis: symptoms || selectedCase?.diagnosis || "" }
        );
        setDatasetSteps(recs);
      } else {
        // No step selected — return all steps from the procedure as recommended steps
        const allSteps: RecommendedStep[] = selectedProcedure.steps.map((s, i) => ({
          id: s.id,
          name: `Step ${s.order}: ${s.name}`,
          score: 1 - (i * 0.05), // descending score
          reasons: [`Component: ${s.component}`, `Cost: ₹${s.cost}`],
        }));
        setDatasetSteps(allSteps);
      }
      setDatasetSearched(true);
    } catch (err) {
      console.error("Dataset search error:", err);
      setDatasetSearched(true);
    } finally {
      setDatasetLoading(false);
    }
  };

  return (
    <AppLayout>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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
                    <TouchableOpacity key={c.id} style={styles.casePickerItem} onPress={() => handleSelectCase(c)}>
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
                {(diasDataset.procedures as DatasetProcedure[]).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.casePickerItem}
                    onPress={() => {
                      setSelectedProcedure(p);
                      setSelectedStep(null);
                      setShowProcPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.casePickerName}>{p.category} — {p.work_type}</Text>
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
                {selectedProcedure?.steps.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.casePickerItem}
                    onPress={() => { setSelectedStep(s); setShowStepPicker(false); }}
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

        {/* Input Section */}
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
                <View style={styles.pickerRow}>
                  <Text style={{ fontSize: 12, color: selectedProcedure ? '#0F172A' : '#94A3B8', flex: 1 }} numberOfLines={1}>
                    {selectedProcedure ? `${selectedProcedure.category} — ${selectedProcedure.work_type}` : "Select Procedure..."}
                  </Text>
                  <ChevronDown size={14} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.gridItem}>
              <TouchableOpacity
                style={[styles.inputCard, !selectedProcedure && { opacity: 0.5 }]}
                onPress={() => selectedProcedure && setShowStepPicker(true)}
              >
                <Text style={styles.inputLabel}>Current Step</Text>
                <View style={styles.pickerRow}>
                  <Text style={{ fontSize: 12, color: selectedStep ? '#0F172A' : '#94A3B8', flex: 1 }} numberOfLines={1}>
                    {selectedStep ? `Step ${selectedStep.order}: ${selectedStep.name}` : "Select Step..."}
                  </Text>
                  <ChevronDown size={14} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mainInputCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.inputLabel}>Observations & Thoughts</Text>
              <View style={styles.headerActions}>
                {(input.length > 0 || symptoms.length > 0) && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => { setInput(""); setOriginalText(""); setSymptoms(""); setOutput(null); setDatasetSteps([]); setDatasetSearched(false); }}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
                {browserSupportsSpeechRecognition && (
                  <TouchableOpacity
                    style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
                    onPress={handleToggleVoice}
                  >
                    {isListening ? <MicOff size={14} color="#EF4444" /> : <Mic size={14} color="#0EA5E9" />}
                    <Text style={[styles.voiceButtonText, isListening && styles.voiceButtonTextActive]}>
                      {isListening ? "Stop" : "Voice"}
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

            {/* Two buttons side by side */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleAISuggest}
                style={[styles.aiButton, loading && { opacity: 0.7 }]}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Sparkles size={15} color="#FFFFFF" />
                }
                <Text style={styles.aiButtonText}>
                  {loading ? "Analysing..." : "Get AI Clinical Insight"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDatasetSearch}
                style={[styles.datasetButton, datasetLoading && { opacity: 0.7 }]}
                disabled={datasetLoading}
              >
                {datasetLoading
                  ? <ActivityIndicator size="small" color="#8B5CF6" />
                  : <ListChecks size={15} color="#8B5CF6" />
                }
                <Text style={styles.datasetButtonText}>
                  {datasetLoading ? "Searching..." : "Next Steps"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Dataset Next Steps Result */}
        {datasetSearched && (
          <View style={styles.datasetCard}>
            <View style={styles.cardTitleRow}>
              <ListChecks size={16} color="#8B5CF6" />
              <Text style={[styles.cardTitle, { color: '#8B5CF6' }]}>
                {selectedStep
                  ? `Recommended Next Steps after Step ${selectedStep.order}`
                  : `Workflow Steps — ${selectedProcedure?.category}`}
              </Text>
            </View>
            {datasetSteps.length === 0 ? (
              <Text style={styles.emptyPickerText}>No steps found for this selection.</Text>
            ) : (
              <View style={styles.recsList}>
                {datasetSteps.map((rec, i) => (
                  <View key={rec.id} style={styles.recItem}>
                    <View style={[styles.recBadge, i === 0 && styles.recBadgePrimary]}>
                      <Text style={styles.recBadgeText}>{Math.round(rec.score * 100)}%</Text>
                    </View>
                    <View style={styles.recContent}>
                      <Text style={styles.recName}>{rec.name}</Text>
                      {rec.reasons.map((r, ri) => (
                        <Text key={ri} style={styles.recMeta}>{r}</Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* AI Output */}
        {output && !loading && (
          <View style={styles.outputSection}>
            {/* Diagnosis card */}
            <View style={styles.diagnosisCard}>
              <View style={styles.diagnosisHeader}>
                <Text style={styles.diagnosisLabel}>AI Suggested Diagnosis</Text>
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
                <Text style={styles.cardTitle}>Next Steps</Text>
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
                {output.instruments.map((item, i) => (
                  <View key={i} style={styles.listItem}>
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
                {output.materials.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <View style={[styles.dot, { backgroundColor: "#F43F5E" }]} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.alertCard}>
              <AlertTriangle size={20} color="#F59E0B" />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Verify clinically before proceeding</Text>
                {output.alerts.map((alert, i) => (
                  <Text key={i} style={styles.alertText}>• {alert}</Text>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
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
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 36,
  },
  inputCard: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.6)",
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
    borderColor: "rgba(226,232,240,0.6)",
    gap: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 30,
  },
  voiceButtonActive: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "#EF4444",
  },
  voiceButtonText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  voiceButtonTextActive: {
    color: "#EF4444",
  },
  clearButton: {
    paddingHorizontal: 10,
    height: 30,
    justifyContent: "center",
  },
  clearButtonText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  textarea: {
    fontSize: 14,
    color: "#0F172A",
    minHeight: 100,
    textAlignVertical: "top",
    padding: 0,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  aiButton: {
    flex: 2,
    backgroundColor: "#0EA5E9",
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  aiButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  datasetButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#8B5CF6",
    backgroundColor: "#F5F3FF",
  },
  datasetButtonText: {
    color: "#8B5CF6",
    fontSize: 13,
    fontWeight: "600",
  },
  outputSection: {
    gap: 16,
  },
  datasetCard: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    gap: 12,
  },
  diagnosisCard: {
    backgroundColor: "rgba(14,165,233,0.05)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: "rgba(14,165,233,0.2)",
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
    borderColor: "rgba(226,232,240,0.6)",
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
    flex: 1,
  },
  alertCard: {
    backgroundColor: "rgba(245,158,11,0.05)",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
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
    backgroundColor: "rgba(139,92,246,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
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
  recsList: {
    gap: 12,
  },
  recItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  recBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 48,
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