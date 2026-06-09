import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
} from "react-native";
import {
  ArrowRight,
  FileText,
  ChevronDown,
  X,
  FileSearch,
  ListChecks,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Brain,
  Info,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";

import AppLayout from "@/components/AppLayout";
import {
  fetchProcedures,
  fetchWorkflow,
  type ProceduresResponse,
  type WorkflowStep,
  type WorkflowResponse,
} from "@/lib/backendApi";

const AIEngine = () => {
  // ── Patient case ──────────────────────────────────────────────────────────
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<string | null>(null);
  const [fetchingFile, setFetchingFile] = useState(false);

  // ── Procedures from backend ───────────────────────────────────────────────
  const [proceduresMap, setProceduresMap] = useState<ProceduresResponse>({});
  const [loadingProcedures, setLoadingProcedures] = useState(true);
  const [proceduresError, setProceduresError] = useState<string | null>(null);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [showProcPicker, setShowProcPicker] = useState(false);
  const [showSubtypePicker, setShowSubtypePicker] = useState(false);

  // ── Workflow result ───────────────────────────────────────────────────────
  const [workflowResult, setWorkflowResult] = useState<WorkflowResponse | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  // ── Next Step addition states ──────────────────────────────────────────────
  const [currentStepInput, setCurrentStepInput] = useState("");
  const [availableSteps, setAvailableSteps] = useState<WorkflowStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [showStepPicker, setShowStepPicker] = useState(false);

  // ── Groq AI States ────────────────────────────────────────────────────────
  const [groqSuggestion, setGroqSuggestion] = useState<any | null>(null);
  const [groqLoading, setGroqLoading] = useState(false);
  const [groqError, setGroqError] = useState<string | null>(null);
  const [autoSelecting, setAutoSelecting] = useState(false);

  // ── Load procedures on mount ──────────────────────────────────────────────
  useEffect(() => {
    const loadProcedures = async () => {
      try {
        setLoadingProcedures(true);
        setProceduresError(null);
        const data = await fetchProcedures();
        setProceduresMap(data);
      } catch (err: any) {
        setProceduresError("Could not load procedures from server.");
      } finally {
        setLoadingProcedures(false);
      }
    };
    loadProcedures();
  }, []);


  const handleGetGroqSuggestion = async () => {
    if (!selectedProcedure || !selectedSubtype) {
      alert("Please select a procedure and subtype first so the AI has context.");
      return;
    }

    setGroqLoading(true);
    setGroqError(null);
    setGroqSuggestion(null);

    const caseDetails = selectedCase 
      ? `Patient: ${selectedCase.patient_name}\nDiagnosis: ${selectedCase.diagnosis}\nTooth Number: ${selectedCase.tooth_number}\n${fileAnalysis ? `Report/File Analysis: ${fileAnalysis}` : ""}`
      : "No specific patient case selected.";

    const currentStepCtx = currentStepInput 
      ? `Current Completed Step: ${currentStepInput}`
      : "Start of procedure (no current step completed yet).";

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "https://pdd-backend-ztqc.onrender.com";
      const response = await fetch(`${backendUrl}/api/ai-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedure: selectedProcedure,
          subtype: selectedSubtype,
          current_step: currentStepInput || "",
          case_details: caseDetails,
          current_step_context: currentStepCtx,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      setGroqSuggestion(data);
    } catch (err: any) {
      console.error("Groq API error:", err);
      setGroqError(err.message || "Failed to generate AI suggestion. Check network connection.");
    } finally {
      setGroqLoading(false);
    }
  };



  const handleAutoSelectFields = async () => {
    if (!selectedCase) {
      alert("Please select a Patient Case first so the AI can analyze the case details.");
      return;
    }

    setAutoSelecting(true);
    setGroqError(null);

    // Build lists of available procedures and their subtypes
    const availableSchema = Object.entries(proceduresMap).reduce((acc: any, [proc, subtypes]) => {
      acc[proc] = subtypes;
      return acc;
    }, {});

    const patientContext = `
Patient: ${selectedCase.patient_name}
Tooth Number: ${selectedCase.tooth_number}
Diagnosis: ${selectedCase.diagnosis}
${fileAnalysis ? `Clinical Files/Radiograph Analysis: ${fileAnalysis}` : ""}
`;

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "https://pdd-backend-ztqc.onrender.com";
      const response = await fetch(`${backendUrl}/api/auto-select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_context: patientContext,
          available_schema: availableSchema,
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
      }

      const parsed = await response.json();

      const aiProc = (parsed.matched_procedure || "").trim().toLowerCase();
      const aiSubtype = (parsed.matched_subtype || "").trim().toLowerCase();
      const aiStep = (parsed.suggested_current_step || "").trim();

      // Find best match in our actual list
      const actualProcKey = Object.keys(proceduresMap).find(
        (p) => p.toLowerCase() === aiProc
      );

      if (actualProcKey) {
        setSelectedProcedure(actualProcKey);
        
        // Find best match for subtype
        const subtypes = proceduresMap[actualProcKey] || [];
        const actualSubtype = subtypes.find(
          (s) => s.toLowerCase() === aiSubtype
        );
        
        if (actualSubtype) {
          setSelectedSubtype(actualSubtype);
          if (aiStep) {
            setCurrentStepInput(aiStep);
          }
          
          alert(`AI Auto-Selected:\nProcedure: ${actualProcKey}\nSubtype: ${actualSubtype}\nStep: ${aiStep || "Start"}`);
          
          // Trigger get workflow automatically
          setWorkflowLoading(true);
          setWorkflowResult(null);
          setWorkflowError(null);
          try {
            const result = await fetchWorkflow(actualProcKey, actualSubtype);
            setWorkflowResult(result);
          } catch (err: any) {
            setWorkflowError(err.message || "Failed to fetch workflow from server.");
          } finally {
            setWorkflowLoading(false);
          }
        } else {
          // Fallback if subtype is not exactly matched, pick first
          if (subtypes.length > 0) {
            setSelectedSubtype(subtypes[0]);
            alert(`AI selected Procedure "${actualProcKey}", but recommended subtype "${aiSubtype}" was not found. Selected first available subtype: "${subtypes[0]}".`);
          }
        }
      } else {
        throw new Error(`AI returned procedure "${parsed.matched_procedure}", which does not match any of our allowed clinical procedures.`);
      }
    } catch (err: any) {
      console.error("Auto select fields error:", err);
      alert("AI Auto-Select failed: " + (err.message || "Check network connection."));
    } finally {
      setAutoSelecting(false);
    }
  };


  // ── Load patient cases ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCases = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("cases")
        .select("*")
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setCases(data);
    };
    fetchCases();
  }, []);

  // Reset workflow when selection changes
  useEffect(() => {
    setWorkflowResult(null);
    setWorkflowError(null);
    setSelectedSubtype(null);
    setCurrentStepInput("");
    setAvailableSteps([]);
  }, [selectedProcedure]);

  useEffect(() => {
    setWorkflowResult(null);
    setWorkflowError(null);
    setCurrentStepInput("");
    setAvailableSteps([]);

    if (!selectedProcedure || !selectedSubtype) return;

    const loadSteps = async () => {
      try {
        setLoadingSteps(true);
        const result = await fetchWorkflow(selectedProcedure, selectedSubtype);
        setAvailableSteps(result.workflow || []);
      } catch (err) {
        console.error("Error loading steps in background:", err);
      } finally {
        setLoadingSteps(false);
      }
    };
    loadSteps();
  }, [selectedProcedure, selectedSubtype]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectCase = async (patientCase: any) => {
    setSelectedCase(patientCase);
    setShowCasePicker(false);
    setFileAnalysis(null);
    setFetchingFile(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: storageFiles } = await supabase.storage
        .from("clinical-files")
        .list(patientCase.id);

      if (storageFiles && storageFiles.length > 0) {
        const sanitizedName = patientCase.patient_name
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9-]/g, "");
        const patientFiles = storageFiles.filter((f) =>
          f.name.toLowerCase().startsWith(sanitizedName.toLowerCase())
        );

        if (patientFiles.length > 0) {
          const latestFile = patientFiles.sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime()
          )[0];

          const { data: urlData } = await supabase.storage
            .from("clinical-files")
            .createSignedUrl(`${patientCase.id}/${latestFile.name}`, 3600);

          if (urlData?.signedUrl) {
            const ext = latestFile.name.split(".").pop()?.toLowerCase();
            const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(
              ext || ""
            );
            const fileType = isImage ? "radiograph/image" : "document/report";
            setFileAnalysis(
              `📎 Latest ${fileType} detected for ${patientCase.patient_name}\n\n` +
                `File: ${latestFile.name.split("--").pop() || latestFile.name}\n` +
                `Uploaded: ${new Date(
                  latestFile.created_at || Date.now()
                ).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}\n\n` +
                `Based on the clinical record for Tooth ${patientCase.tooth_number} with diagnosis of "${patientCase.diagnosis}", ` +
                `the uploaded ${fileType} has been linked to this case.`
            );
          } else {
            setFileAnalysis(`No files found for ${patientCase.patient_name}.`);
          }
        } else {
          setFileAnalysis(
            `No reports uploaded yet for ${patientCase.patient_name}.`
          );
        }
      } else {
        setFileAnalysis(`No files found in storage.`);
      }
    } catch {
      setFileAnalysis("Could not fetch patient files.");
    } finally {
      setFetchingFile(false);
    }
  };

  const handleGetWorkflow = async () => {
    if (!selectedProcedure) {
      alert("Please select a procedure first.");
      return;
    }
    if (!selectedSubtype) {
      alert("Please select a subtype first.");
      return;
    }

    setWorkflowLoading(true);
    setWorkflowResult(null);
    setWorkflowError(null);

    try {
      const result = await fetchWorkflow(selectedProcedure, selectedSubtype);
      setWorkflowResult(result);
    } catch (err: any) {
      setWorkflowError(err.message || "Failed to fetch workflow from server.");
    } finally {
      setWorkflowLoading(false);
    }
  };

  const getNextStepToDisplay = () => {
    if (!workflowResult || !workflowResult.workflow || workflowResult.workflow.length === 0) {
      return null;
    }

    const currentInput = (currentStepInput || "").trim().toLowerCase();
    
    // Smart Bypassing: If no current step is entered, or if "start" is entered,
    // we want to recommend the first actual clinical/operational step instead of the generic "Start" step.
    if (!currentInput || currentInput === "start") {
      const firstStep = workflowResult.workflow[0];
      if (firstStep.current_step.toLowerCase() === "start" && firstStep.next_step) {
        // Find the step object that corresponds to the first operational step (matching the next_step of "Start")
        const firstOperationalStep = workflowResult.workflow.find(s => 
          s.current_step.toLowerCase() === firstStep.next_step.toLowerCase()
        );
        if (firstOperationalStep) {
          return {
            step: firstOperationalStep,
            type: "first"
          };
        }
      }
      
      // Fallback: if "Start" is not the first step, or doesn't have a valid next_step, show the first step
      return {
        step: workflowResult.workflow[0],
        type: "first"
      };
    }

    // Find the step matching the user's input
    const matchingStepIndex = workflowResult.workflow.findIndex(s => 
      s.current_step.toLowerCase().includes(currentInput) ||
      s.step_number.toString() === currentInput
    );

    if (matchingStepIndex === -1) {
      return {
        error: `Could not find a step matching "${currentStepInput}". Showing first step:`,
        step: workflowResult.workflow[0],
        type: "fallback"
      };
    }

    const matchingStep = workflowResult.workflow[matchingStepIndex];
    
    if (!matchingStep.next_step) {
      return {
        completed: true,
        message: "You have reached the end of the workflow! No further steps required."
      };
    }

    // Find the next step object
    const nextStepObj = workflowResult.workflow.find(s => 
      s.current_step.toLowerCase() === matchingStep.next_step.toLowerCase()
    );

    if (nextStepObj) {
      return {
        step: nextStepObj,
        type: "next"
      };
    }

    // Fallback if next step name is present but doesn't exist as a full step in the array
    return {
      step: {
        step_number: matchingStep.step_number + 1,
        current_step: matchingStep.next_step,
        current_description: matchingStep.next_description || "Proceed with the next stage of treatment.",
        next_step: "",
        confidence: matchingStep.confidence,
        source: matchingStep.source
      },
      type: "next"
    };
  };

  const procedureNames = Object.keys(proceduresMap);
  const availableSubtypes = selectedProcedure
    ? proceduresMap[selectedProcedure] ?? []
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.description}>
          Select a procedure and subtype to fetch the complete clinical workflow
          from the backend dataset.
        </Text>



        {/* Procedure Picker Modal */}
        <Modal visible={showProcPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Procedure</Text>
                <TouchableOpacity onPress={() => setShowProcPicker(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {procedureNames.length === 0 ? (
                  <Text style={styles.emptyPickerText}>
                    No procedures available. Check your connection.
                  </Text>
                ) : (
                  procedureNames.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={styles.casePickerItem}
                      onPress={() => {
                        setSelectedProcedure(name);
                        setShowProcPicker(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.casePickerName}>
                          {name.replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Text>
                        <Text style={styles.casePickerMeta}>
                          {proceduresMap[name].length} subtypes available
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Subtype Picker Modal */}
        <Modal visible={showSubtypePicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Subtype</Text>
                <TouchableOpacity onPress={() => setShowSubtypePicker(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {availableSubtypes.map((subtype) => (
                  <TouchableOpacity
                    key={subtype}
                    style={styles.casePickerItem}
                    onPress={() => {
                      setSelectedSubtype(subtype);
                      setShowSubtypePicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.casePickerName}>
                        {subtype.replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Text>
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
                <TouchableOpacity
                  style={styles.casePickerItem}
                  onPress={() => {
                    setCurrentStepInput("");
                    setShowStepPicker(false);
                  }}
                >
                  <Text style={[styles.casePickerName, { color: "#8B5CF6", fontWeight: "700" }]}>
                    None / Start of Treatment
                  </Text>
                </TouchableOpacity>
                {availableSteps.map((step) => (
                  <TouchableOpacity
                    key={step.step_number}
                    style={styles.casePickerItem}
                    onPress={() => {
                      setCurrentStepInput(step.current_step);
                      setShowStepPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.casePickerName}>
                        Step {step.step_number}: {step.current_step}
                      </Text>
                      {step.current_description ? (
                        <Text style={styles.casePickerMeta} numberOfLines={1}>
                          {step.current_description}
                        </Text>
                      ) : null}
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.fileAnalysisText}>
                  Fetching latest report...
                </Text>
              </View>
            ) : (
              <Text style={styles.fileAnalysisText}>{fileAnalysis}</Text>
            )}
          </View>
        )}

        {/* Input Section */}
        <View style={styles.entrySection}>
          {/* Procedures loading/error state */}
          {loadingProcedures && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading procedures…</Text>
            </View>
          )}
          {proceduresError && !loadingProcedures && (
            <View style={styles.errorRow}>
              <AlertCircle size={14} color="#EF4444" />
              <Text style={styles.errorText}>{proceduresError}</Text>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setLoadingProcedures(true);
                    setProceduresError(null);
                    const data = await fetchProcedures();
                    setProceduresMap(data);
                  } catch {
                    setProceduresError("Could not load procedures.");
                  } finally {
                    setLoadingProcedures(false);
                  }
                }}
              >
                <RefreshCw size={14} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.grid}>
            {/* Procedure picker */}
            <View style={styles.gridItem}>
              <TouchableOpacity
                style={[
                  styles.inputCard,
                  loadingProcedures && { opacity: 0.5 },
                ]}
                onPress={() => !loadingProcedures && setShowProcPicker(true)}
              >
                <Text style={styles.inputLabel}>Procedure</Text>
                <View style={styles.pickerRow}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: selectedProcedure ? "#0F172A" : "#94A3B8",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {selectedProcedure
                      ? selectedProcedure.replace(/\b\w/g, (l) =>
                          l.toUpperCase()
                        )
                      : "Select Procedure…"}
                  </Text>
                  <ChevronDown size={14} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Subtype picker */}
            <View style={styles.gridItem}>
              <TouchableOpacity
                style={[
                  styles.inputCard,
                  !selectedProcedure && { opacity: 0.5 },
                ]}
                onPress={() =>
                  selectedProcedure && setShowSubtypePicker(true)
                }
              >
                <Text style={styles.inputLabel}>Subtype</Text>
                <View style={styles.pickerRow}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: selectedSubtype ? "#0F172A" : "#94A3B8",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {selectedSubtype
                      ? selectedSubtype.replace(/\b\w/g, (l) =>
                          l.toUpperCase()
                        )
                      : "Select Subtype…"}
                  </Text>
                  <ChevronDown size={14} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Current Step Input */}
          {selectedSubtype && (
            <View style={styles.inputGroupFull}>
              <Text style={styles.inputLabelFull}>Current Step (Optional)</Text>
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInputFull}
                  placeholder="e.g. Diagnosis, Preparation (or tap dropdown)"
                  placeholderTextColor="#94A3B8"
                  value={currentStepInput}
                  onChangeText={setCurrentStepInput}
                />
                {availableSteps.length > 0 && (
                  <TouchableOpacity
                    style={styles.dropdownToggleBtn}
                    onPress={() => setShowStepPicker(true)}
                  >
                    <ChevronDown size={18} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
              {loadingSteps && (
                <Text style={styles.stepSuggestionLoadingText}>Loading steps list…</Text>
              )}
            </View>
          )}

          {/* Action button */}
          <TouchableOpacity
            onPress={handleGetWorkflow}
            style={[
              styles.datasetButton,
              workflowLoading && { opacity: 0.7 },
            ]}
            disabled={workflowLoading}
          >
            {workflowLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ArrowRight size={16} color="#FFFFFF" />
            )}
            <Text style={styles.datasetButtonText}>
              {workflowLoading ? "Fetching Next Step…" : "Get Next Step"}
            </Text>
          </TouchableOpacity>
        </View>



        {/* Groq AI Section */}
        <View style={styles.groqSection}>
          <TouchableOpacity
            onPress={handleGetGroqSuggestion}
            style={[
              styles.groqButton,
              groqLoading && { opacity: 0.7 },
              (!selectedProcedure || !selectedSubtype) && { opacity: 0.5 }
            ]}
            disabled={groqLoading}
          >
            {groqLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Sparkles size={16} color="#FFFFFF" />
            )}
            <Text style={styles.groqButtonText}>
              {groqLoading ? "Generating AI Recommendation..." : "AI Suggestion"}
            </Text>
          </TouchableOpacity>


        </View>

        {/* Groq AI Error */}
        {groqError && (
          <View style={styles.errorCard}>
            <AlertCircle size={16} color="#EF4444" />
            <Text style={styles.errorCardText}>{groqError}</Text>
          </View>
        )}

        {/* Groq AI Suggestion Content Card */}
        {groqSuggestion && (
          <View style={styles.groqResultCard}>
            <View style={styles.groqCardHeader}>
              <Brain size={18} color="#8B5CF6" />
              <Text style={styles.groqCardTitle}>Groq AI Clinical Advisor</Text>

            </View>

            <View style={styles.groqStepBadge}>
              <Text style={styles.groqStepBadgeNum}>Step {groqSuggestion.suggested_step_number || "•"}</Text>
              <Text style={styles.groqStepBadgeName}>{groqSuggestion.suggested_step_name}</Text>
            </View>

            <View style={styles.groqContentGroup}>
              <Text style={styles.groqContentLabel}>Clinical Overview & Rationale</Text>
              <Text style={styles.groqContentText}>{groqSuggestion.clinical_description}</Text>
            </View>

            {groqSuggestion.rationale ? (
              <View style={styles.groqContentGroup}>
                <Text style={styles.groqContentLabel}>Case-Specific Rationale</Text>
                <Text style={styles.groqContentText}>{groqSuggestion.rationale}</Text>
              </View>
            ) : null}

            <View style={styles.groqContentGroup}>
              <Text style={styles.groqContentLabel}>Actionable Instructions</Text>
              <Text style={styles.groqContentText}>{groqSuggestion.clinical_instructions}</Text>
            </View>

            {groqSuggestion.instruments_required && groqSuggestion.instruments_required.length > 0 && (
              <View style={styles.groqContentGroup}>
                <Text style={styles.groqContentLabel}>Recommended Instruments & Materials</Text>
                <View style={styles.groqPillsRow}>
                  {groqSuggestion.instruments_required.map((inst: string, idx: number) => (
                    <View key={idx} style={styles.groqPill}>
                      <Text style={styles.groqPillText}>{inst}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {groqSuggestion.clinical_precautions && groqSuggestion.clinical_precautions.length > 0 && (
              <View style={styles.groqContentGroup}>
                <Text style={styles.groqContentLabel}>Clinical Precautions & Tips</Text>
                {groqSuggestion.clinical_precautions.map((prec: string, idx: number) => (
                  <View key={idx} style={styles.groqPrecautionItem}>
                    <Info size={12} color="#EF4444" style={{ marginTop: 2 }} />
                    <Text style={styles.groqPrecautionText}>{prec}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Workflow Error */}
        {workflowError && (
          <View style={styles.errorCard}>
            <AlertCircle size={16} color="#EF4444" />
            <Text style={styles.errorCardText}>{workflowError}</Text>
          </View>
        )}

        {/* Workflow Result */}
        {workflowResult && (
          <View style={styles.datasetCard}>
            <View style={styles.cardTitleRow}>
              <ListChecks size={16} color="#8B5CF6" />
              <Text style={[styles.cardTitle, { color: "#8B5CF6" }]}>
                {workflowResult.procedure.replace(/\b\w/g, (l) =>
                  l.toUpperCase()
                )}{" "}
                — {workflowResult.subtype.replace(/\b\w/g, (l) =>
                  l.toUpperCase()
                )}
              </Text>
            </View>

            <Text style={styles.workflowMeta}>
              {workflowResult.total_steps} step{workflowResult.total_steps !== 1 ? "s" : ""} in total workflow · showing next step
            </Text>

            {(() => {
              const displayInfo = getNextStepToDisplay();
              if (!displayInfo) return null;

              if (displayInfo.completed) {
                return (
                  <View style={styles.completedCard}>
                    <CheckCircle2 size={24} color="#10B981" />
                    <Text style={styles.completedText}>{displayInfo.message}</Text>
                  </View>
                );
              }

              const step = displayInfo.step;
              return (
                <View>
                  {displayInfo.error && (
                    <View style={styles.warningRowInline}>
                      <AlertCircle size={14} color="#D97706" />
                      <Text style={styles.warningTextInline}>{displayInfo.error}</Text>
                    </View>
                  )}
                  
                  <View style={styles.stepCard}>
                    {/* Step header row */}
                    <View style={styles.stepHeaderRow}>
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>
                          {step.step_number}
                        </Text>
                      </View>
                      <Text style={styles.stepCurrentName}>
                        {step.current_step}
                      </Text>

                    </View>

                    {/* Current step description */}
                    {step.current_description ? (
                      <Text style={styles.stepDesc}>
                        {step.current_description}
                      </Text>
                    ) : null}

                    {/* Arrow to next step */}
                    {step.next_step && (
                      <View style={styles.nextStepRow}>
                        <ArrowRight size={12} color="#8B5CF6" />
                        <Text style={styles.nextStepLabel}>
                          Next:{" "}
                          <Text style={styles.nextStepName}>
                            {step.next_step}
                          </Text>
                        </Text>
                      </View>
                    )}


                  </View>
                </View>
              );
            })()}

            {/* FULL WORKFLOW TIMELINE PATH */}
            <View style={styles.timelineHeader}>
              <Text style={styles.timelineTitle}>Procedure Workflow Path</Text>
              <Text style={styles.timelineSubtitle}>The sequential stages for this treatment.</Text>
            </View>

            <View style={styles.timelineContainer}>
              {workflowResult.workflow.map((item, index) => {
                const displayInfo = getNextStepToDisplay();
                const isActive = displayInfo && !displayInfo.completed && displayInfo.step && displayInfo.step.step_number === item.step_number;
                return (
                  <View key={index} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, isActive && styles.timelineDotActive]}>
                        <Text style={[styles.timelineDotText, isActive && styles.timelineDotTextActive]}>
                          {item.step_number}
                        </Text>
                      </View>
                      {index < workflowResult.workflow.length - 1 && (
                        <View style={styles.timelineConnector} />
                      )}
                    </View>
                    <View style={[styles.timelineContentCard, isActive && styles.timelineContentCardActive]}>
                      <Text style={[styles.timelineStepName, isActive && styles.timelineStepNameActive]}>
                        {item.current_step}
                      </Text>
                      <Text style={styles.timelineStepDesc}>
                        {item.current_description || "No description available."}
                      </Text>
                      {item.next_step ? (
                        <Text style={styles.timelineNextText}>
                          Next: {item.next_step}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
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
  // ── Loading / error inline ──
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#8B5CF6",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#EF4444",
  },
  // ── Patient selector ──
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
  // ── File analysis ──
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
  // ── Entry section ──
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  datasetButton: {
    width: "100%",
    backgroundColor: "#8B5CF6",
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  datasetButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  // ── Modals ──
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
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  casePickerAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8B5CF6",
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
  // ── Workflow result ──
  datasetCard: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    gap: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  workflowMeta: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  stepCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.12)",
    gap: 8,
  },
  stepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stepCurrentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  confidencePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
  },
  stepDesc: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  nextStepLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  nextStepName: {
    fontWeight: "700",
    color: "#8B5CF6",
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceText: {
    fontSize: 10,
    color: "#94A3B8",
    textTransform: "capitalize",
  },
  // ── Workflow error card ──
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorCardText: {
    flex: 1,
    fontSize: 13,
    color: "#EF4444",
  },
  // ── Next Step styles ──
  inputGroupFull: {
    gap: 8,
    width: "100%",
  },
  inputLabelFull: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  textInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.6)",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  textInputFull: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    height: "100%",
  },
  dropdownToggleBtn: {
    padding: 6,
  },
  stepSuggestionLoadingText: {
    fontSize: 11,
    color: "#8B5CF6",
    fontStyle: "italic",
  },
  completedCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  completedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
    flex: 1,
  },
  warningRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  warningTextInline: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "500",
  },
  // ── Timeline styles ──
  timelineHeader: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(139,92,246,0.1)",
    paddingTop: 16,
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  timelineSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  timelineContainer: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineLeft: {
    alignItems: "center",
    width: 24,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineDotActive: {
    backgroundColor: "#8B5CF6",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timelineDotText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  timelineDotTextActive: {
    color: "#FFFFFF",
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  timelineContentCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  timelineContentCardActive: {
    borderColor: "rgba(139,92,246,0.3)",
    backgroundColor: "rgba(139,92,246,0.02)",
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
  },
  timelineStepName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  timelineStepNameActive: {
    color: "#8B5CF6",
    fontWeight: "700",
  },
  timelineStepDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  timelineNextText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8B5CF6",
    marginTop: 4,
  },
  // ── AI Auto-Select Styles ──
  autoSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.25)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  autoSelectBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8B5CF6",
  },
  // ── Key Config Card ──
  keyConfigCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 10,
    marginTop: 10,
  },
  keyConfigHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  keyConfigTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  keyConfigDesc: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 18,
  },
  keyInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  keyInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
    paddingHorizontal: 12,
    fontSize: 12,
    color: "#1E293B",
    height: 38,
  },
  saveKeyBtn: {
    backgroundColor: "#D97706",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  saveKeyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  // ── Groq Section ──
  groqSection: {
    gap: 8,
    marginTop: 10,
  },
  groqButton: {
    width: "100%",
    backgroundColor: "#7C3AED", // Vibrant Purple
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  groqButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  settingsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  settingsLinkText: {
    fontSize: 11,
    color: "#64748B",
    textDecorationLine: "underline",
  },
  // ── Groq Result Card ──
  groqResultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
    marginTop: 10,
  },
  groqCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  groqCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4C1D95",
    flex: 1,
  },
  confidenceBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  groqStepBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  groqStepBadgeNum: {
    backgroundColor: "#7C3AED",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  groqStepBadgeName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E1B4B",
    flex: 1,
  },
  groqContentGroup: {
    gap: 6,
  },
  groqContentLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  groqContentText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
  },
  groqPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  groqPill: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  groqPillText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
  },
  groqPrecautionItem: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  groqPrecautionText: {
    fontSize: 11.5,
    color: "#E11D48",
    flex: 1,
    lineHeight: 16,
  },
});

export default AIEngine;