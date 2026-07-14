import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import {
  Download,
  Printer,
  Send,
  ChevronDown,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { notifyOrgAndLabsOfNewCase } from "@/lib/notifications";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  fetchProcedures,
  fetchWorkflow,
  type ProceduresResponse,
  type WorkflowStep,
} from "@/lib/backendApi";

const LabRequisition = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const caseId = route.params?.caseId;

  const [loading, setLoading] = useState(!!caseId);
  const [dentistName, setDentistName] = useState("Doctor");

  // ── Patient data ──────────────────────────────────────────────────────────
  const [patientData, setPatientData] = useState<any>({
    patient_name: "",
    age: "",
    gender: "",
    tooth_number: "",
    diagnosis: "",
  });

  const [labDetails, setLabDetails] = useState({
    material: "PFM (Porcelain-fused-to-metal)",
    shade: "A2 (Vita)",
    margin: "Chamfer",
    instructions: "",
  });

  const [isUrgent, setIsUrgent] = useState(false);

  // ── Procedure / subtype from backend ──────────────────────────────────────
  const [proceduresMap, setProceduresMap] = useState<ProceduresResponse>({});
  const [loadingProcedures, setLoadingProcedures] = useState(true);
  const [proceduresError, setProceduresError] = useState<string | null>(null);

  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [showProcPicker, setShowProcPicker] = useState(false);
  const [showSubtypePicker, setShowSubtypePicker] = useState(false);

  // ── Workflow steps ────────────────────────────────────────────────────────
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);

  // ── Load procedures on mount ──────────────────────────────────────────────
  useEffect(() => {
    const loadProcedures = async () => {
      try {
        setLoadingProcedures(true);
        setProceduresError(null);
        const data = await fetchProcedures();
        setProceduresMap(data);
      } catch {
        setProceduresError("Could not load procedures from server.");
      } finally {
        setLoadingProcedures(false);
      }
    };
    loadProcedures();
  }, []);

  // ── Load patient case data ────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setDentistName(user.user_metadata?.full_name || "Doctor");
      }

      if (caseId) {
        if (loading) setLoading(true);
        const { data: caseData } = await supabase
          .from("cases")
          .select("*")
          .eq("id", caseId)
          .single();

        if (caseData) {
          setPatientData(caseData);
          setIsUrgent(caseData.is_urgent || false);
        }
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [caseId]);

  // ── When procedure changes, reset subtype & steps ─────────────────────────
  useEffect(() => {
    setSelectedSubtype(null);
    setWorkflowSteps([]);
  }, [selectedProcedure]);

  // ── When subtype changes, load workflow steps ─────────────────────────────
  useEffect(() => {
    if (!selectedProcedure || !selectedSubtype) return;
    const load = async () => {
      try {
        setLoadingWorkflow(true);
        const result = await fetchWorkflow(selectedProcedure, selectedSubtype);
        setWorkflowSteps(result.workflow);
      } catch {
        setWorkflowSteps([]);
      } finally {
        setLoadingWorkflow(false);
      }
    };
    load();
  }, [selectedProcedure, selectedSubtype]);

  const handleSendToLab = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Fetch doctor's profile to get org_id and full_name
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, full_name')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from("cases")
        .update({
          status: "lab-pending",
          is_urgent: isUrgent,
          org_id: profile?.org_id || patientData.org_id || null,
          doctor_name: profile?.full_name || null,
          notes:
            (patientData.notes || "") +
            `\n\n[LAB REQUESTED - ${new Date().toLocaleDateString()}]` +
            `\nProcedure: ${selectedProcedure || "None"}` +
            `\nSubtype: ${selectedSubtype || "None"}` +
            `\nMaterial: ${labDetails.material}` +
            `\nShade: ${labDetails.shade}` +
            `\nMargin: ${labDetails.margin}` +
            `\nSpecial instructions: ${labDetails.instructions || "None"}`,
        })
        .eq("id", caseId || patientData.id);

      if (error) throw error;
      
      const targetOrgId = profile?.org_id || patientData.org_id;
      if (targetOrgId) {
        notifyOrgAndLabsOfNewCase(targetOrgId, patientData.patient_name || 'Patient', patientData.tooth_number || 'XX');
      }

      alert("Lab requisition sent successfully!");
      navigation.goBack();
    } catch (error: any) {
      alert("Failed to send to lab: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (Platform.OS !== "web") {
      alert("Print/PDF is only supported on Web currently.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker prevented opening the print view.");
      return;
    }

    const stepsHtml = workflowSteps
      .map(
        (s) => `
        <div class="step-item">
          <div class="step-header">
            <span class="step-num">${s.step_number}</span>
            <span class="step-name">${s.current_step}</span>
          </div>
          <p class="step-desc">${s.current_description || ""}</p>
          ${s.next_step ? `<p class="step-next">→ Next: <strong>${s.next_step}</strong></p>` : ""}
        </div>`
      )
      .join("");

    const htmlContent = `
      <html>
        <head>
          <title>Lab Requisition - ${patientData.patient_name || "Case"}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; color: #0ea5e9; margin: 0; }
            .meta { font-size: 14px; color: #64748b; margin-top: 5px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .info-box { background: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 12px; }
            .label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
            .value { font-size: 14px; font-weight: 600; color: #334155; margin-top: 4px; }
            .section-title { font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            .step-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
            .step-header { display: flex; align-items: center; gap: 8px; }
            .step-num { background: #0ea5e9; color: white; border-radius: 6px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; }
            .step-name { font-weight: 700; font-size: 14px; }
            .step-desc { font-size: 13px; color: #475569; margin: 6px 0 0; }
            .step-next { font-size: 12px; color: #8b5cf6; margin: 4px 0 0; }
            .instructions { background: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 12px; margin-top: 20px; font-style: italic; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">LAB REQUISITION REPORT</h1>
            <div class="meta">Case Reference: #${caseId ? caseId.slice(0, 8).toUpperCase() : "NEW"}</div>
          </div>
          <div class="grid">
            <div class="info-box"><div class="label">Patient Name</div><div class="value">${patientData.patient_name || "N/A"}</div></div>
            <div class="info-box"><div class="label">Age / Gender</div><div class="value">${patientData.age || "N/A"} yrs &middot; ${patientData.gender || "N/A"}</div></div>
            <div class="info-box"><div class="label">Dentist Name</div><div class="value">${dentistName}</div></div>
            <div class="info-box"><div class="label">Tooth FDI</div><div class="value">#${patientData.tooth_number || "N/A"}</div></div>
          </div>
          <div class="section-title">Required Lab Work</div>
          <p>${selectedProcedure || "Not specified"} — ${selectedSubtype || "Not specified"}</p>
          ${stepsHtml ? `<div class="section-title">Workflow Steps</div>${stepsHtml}` : ""}
          <div class="grid" style="margin-top:20px">
            <div class="info-box"><div class="label">Material</div><div class="value">${labDetails.material}</div></div>
            <div class="info-box"><div class="label">Shade / Margin</div><div class="value">${labDetails.shade} &middot; ${labDetails.margin}</div></div>
          </div>
          ${labDetails.instructions ? `<div class="section-title">Special Instructions</div><div class="instructions">${labDetails.instructions}</div>` : ""}
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const procedureNames = Object.keys(proceduresMap);
  const availableSubtypes = selectedProcedure
    ? proceduresMap[selectedProcedure] ?? []
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <View style={styles.container}>
        <Text style={styles.description}>
          Auto-filled from clinical entry — review and send.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.reqNumber}>
                Lab requisition #
                {caseId ? caseId.slice(0, 8).toUpperCase() : "NEW"}
              </Text>
              <Text style={styles.cardTitle}>
                {selectedProcedure || "New Request"} — Tooth{" "}
                {patientData.tooth_number || "XX"}
              </Text>
              <View style={styles.headerMeta}>
                <Text style={styles.metaText}>
                  {new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.metaText}>Return: 5–7 days</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              {/* Patient fields */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Patient name</Text>
                <TextInput
                  style={styles.input}
                  value={patientData.patient_name}
                  editable={false}
                  placeholder="Patient name"
                />
              </View>

              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Age</Text>
                  <TextInput
                    style={styles.input}
                    value={String(patientData.age || "")}
                    editable={false}
                    placeholder="Age"
                  />
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Gender</Text>
                  <TextInput
                    style={styles.input}
                    value={patientData.gender}
                    editable={false}
                    placeholder="Gender"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Dentist</Text>
                <TextInput
                  style={styles.input}
                  value={dentistName}
                  onChangeText={setDentistName}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tooth number (FDI)</Text>
                <TextInput
                  style={styles.input}
                  value={patientData.tooth_number}
                  editable={false}
                  placeholder="XX"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Diagnosis / Indication</Text>
                <TextInput
                  style={styles.input}
                  value={patientData.diagnosis}
                  editable={false}
                  multiline
                  placeholder="Primary diagnosis"
                />
              </View>

              {/* Urgent Case Checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsUrgent(!isUrgent)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isUrgent && styles.checkboxChecked]}>
                  {isUrgent && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.checkboxLabel}>Mark this Lab Request as Urgent Case</Text>
              </TouchableOpacity>

              {/* Procedures loading/error */}
              {loadingProcedures && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#0EA5E9" />
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
                    <RefreshCw size={14} color="#0EA5E9" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Procedure picker */}
              <View style={styles.selectionGroup}>
                <Text style={styles.label}>Procedure</Text>
                <TouchableOpacity
                  style={[
                    styles.input,
                    { justifyContent: "center" },
                    loadingProcedures && { opacity: 0.5 },
                  ]}
                  onPress={() => !loadingProcedures && setShowProcPicker(true)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: selectedProcedure ? "#0F172A" : "#94A3B8",
                      }}
                    >
                      {selectedProcedure
                        ? selectedProcedure.replace(/\b\w/g, (l) =>
                            l.toUpperCase()
                          )
                        : "Select Procedure…"}
                    </Text>
                    <ChevronDown size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Subtype picker */}
              {selectedProcedure && (
                <View style={styles.selectionGroup}>
                  <Text style={styles.label}>Subtype</Text>
                  <TouchableOpacity
                    style={[styles.input, { justifyContent: "center" }]}
                    onPress={() => setShowSubtypePicker(true)}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: selectedSubtype ? "#0F172A" : "#94A3B8",
                        }}
                      >
                        {selectedSubtype
                          ? selectedSubtype.replace(/\b\w/g, (l) =>
                              l.toUpperCase()
                            )
                          : "Select Subtype…"}
                      </Text>
                      <ChevronDown size={16} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* Workflow steps */}
              {loadingWorkflow && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#0EA5E9" />
                  <Text style={styles.loadingText}>Loading workflow…</Text>
                </View>
              )}
              {workflowSteps.length > 0 && (
                <View style={styles.selectionGroup}>
                  <Text style={styles.label}>
                    Workflow Steps &amp; Details
                  </Text>
                  <View style={styles.stepsContainer}>
                    {workflowSteps.map((step) => (
                      <View key={step.step_number} style={styles.stepItem}>
                        <View style={styles.stepHeader}>
                          <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>
                              {step.step_number}
                            </Text>
                          </View>
                          <Text style={styles.stepTitle}>
                            {step.current_step}
                          </Text>
                        </View>
                        {step.current_description ? (
                          <Text style={styles.stepDesc}>
                            {step.current_description}
                          </Text>
                        ) : null}
                        {step.next_step && (
                          <View style={styles.nextRow}>
                            <Text style={styles.stepMeta}>
                              → Next:{" "}
                              <Text style={{ color: "#0EA5E9", fontWeight: "600" }}>
                                {step.next_step}
                              </Text>
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Lab detail fields */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Material</Text>
                <TextInput
                  style={styles.input}
                  value={labDetails.material}
                  onChangeText={(v) =>
                    setLabDetails({ ...labDetails, material: v })
                  }
                  placeholder="Enter material (e.g. Zirconia)"
                />
              </View>

              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Shade</Text>
                  <TextInput
                    style={styles.input}
                    value={labDetails.shade}
                    onChangeText={(v) =>
                      setLabDetails({ ...labDetails, shade: v })
                    }
                    placeholder="e.g. A2"
                  />
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.label}>Margin</Text>
                  <TextInput
                    style={styles.input}
                    value={labDetails.margin}
                    onChangeText={(v) =>
                      setLabDetails({ ...labDetails, margin: v })
                    }
                    placeholder="e.g. Chamfer"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Special instructions</Text>
                <TextInput
                  style={styles.textarea}
                  value={labDetails.instructions}
                  onChangeText={(v) =>
                    setLabDetails({ ...labDetails, instructions: v })
                  }
                  placeholder="Match translucency, specific contact notes, etc."
                  multiline
                />
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handlePrint}
              >
                <Download size={16} color="#0F172A" />
                <Text style={styles.secondaryButtonText}>PDF / Print</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.7 }]}
              onPress={handleSendToLab}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Send size={16} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Send to lab</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

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
                {procedureNames.map((name) => (
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
                        {proceduresMap[name].length} subtypes
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
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
                    <Text style={styles.casePickerName}>
                      {subtype.replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 20,
  },
  description: {
    fontSize: 14,
    color: "#64748B",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#0EA5E9",
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
    marginBottom: 16,
  },
  cardHeader: {
    backgroundColor: "#0EA5E9",
    padding: 16,
  },
  reqNumber: {
    fontSize: 10,
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  headerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.9,
  },
  cardBody: {
    padding: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  gridItem: {
    flex: 1,
    gap: 8,
  },
  selectionGroup: {
    gap: 8,
  },
  textarea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
  },
  stepsContainer: {
    gap: 12,
  },
  stepItem: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },
  stepDesc: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
  nextRow: {
    marginTop: 4,
  },
  stepMeta: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  actions: {
    gap: 10,
    marginBottom: 40,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  primaryButton: {
    height: 54,
    backgroundColor: "#0EA5E9",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
    maxHeight: "80%",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  casePickerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#EF4444",
    backgroundColor: "#FEE2E2",
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
});

export default LabRequisition;
