import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions, ActivityIndicator, Platform } from "react-native";
import { Download, Printer, Send, ClipboardList } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";
import { useNavigation, useRoute } from "@react-navigation/native";

const labOptions = [
  { id: "crown", label: "Crown" },
  { id: "rct", label: "Root Canal Treatment" },
  { id: "impression", label: "Impression" },
  { id: "prosthesis", label: "Prosthesis" },
  { id: "bridge", label: "Bridge" },
  { id: "denture", label: "Denture" },
];

const LabRequisition = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const caseId = route.params?.caseId;
  
  const [loading, setLoading] = useState(!!caseId);
  const [selected, setSelected] = useState<string[]>(["crown"]);
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
    instructions: ""
  });
  const [dentistName, setDentistName] = useState("Doctor");
  
  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setDentistName(user.user_metadata?.full_name || "Doctor");
      }

      if (caseId) {
        setLoading(true);
        const { data: caseData } = await supabase
          .from('cases')
          .select('*')
          .eq('id', caseId)
          .single();
        
        if (caseData) {
          setPatientData(caseData);
        }
        setLoading(false);
      }
    };
    fetchData();
  }, [caseId]);

  const handleSendToLab = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('cases')
        .update({ 
          status: 'lab-pending',
          notes: (patientData.notes || "") + `\n\n[LAB REQUESTED - ${new Date().toLocaleDateString()}]\nWork: ${selected.join(", ")}\nMaterial: ${labDetails.material}\nShade: ${labDetails.shade}`
        })
        .eq('id', caseId || patientData.id);

      if (error) throw error;
      alert("Lab requisition sent successfully!");
      navigation.goBack();
    } catch (error: any) {
      alert("Failed to send to lab: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (isPdf: boolean) => {
    if (Platform.OS !== 'web') {
      alert("Print/PDF is only supported on Web currently.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker prevented opening the print view.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Lab Requisition - ${patientData.patient_name || 'Case'}</title>
          <style>
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #0f172a;
              padding: 40px;
              line-height: 1.5;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              color: #0ea5e9;
              margin: 0;
            }
            .meta {
              font-size: 14px;
              color: #64748b;
              margin-top: 5px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .info-box {
              background: #f8fafc;
              border: 1px solid #f1f5f9;
              padding: 15px;
              border-radius: 12px;
            }
            .label {
              font-size: 11px;
              font-weight: 700;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .value {
              font-size: 14px;
              font-weight: 600;
              color: #334155;
              margin-top: 4px;
            }
            .section-title {
              font-size: 14px;
              font-weight: 700;
              color: #475569;
              margin-bottom: 10px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 5px;
            }
            .badges {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-bottom: 20px;
            }
            .badge {
              background: #e0f2fe;
              color: #0369a1;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
            }
            .instructions {
              background: #fffbeb;
              border: 1px solid #fef3c7;
              padding: 15px;
              border-radius: 12px;
              margin-top: 20px;
              font-style: italic;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">LAB REQUISITION REPORT</h1>
            <div class="meta">Case Reference: #${caseId ? caseId.slice(0, 8).toUpperCase() : 'NEW'}</div>
          </div>

          <div class="grid">
            <div class="info-box">
              <div class="label">Patient Name</div>
              <div class="value">${patientData.patient_name || 'N/A'}</div>
            </div>
            <div class="info-box">
              <div class="label">Age / Gender</div>
              <div class="value">${patientData.age || 'N/A'} yrs &middot; ${patientData.gender || 'N/A'}</div>
            </div>
            <div class="info-box">
              <div class="label">Dentist Name</div>
              <div class="value">${dentistName}</div>
            </div>
            <div class="info-box">
              <div class="label">Tooth FDI</div>
              <div class="value">#${patientData.tooth_number || 'N/A'}</div>
            </div>
          </div>

          <div class="section-title">Required Lab Work</div>
          <div class="badges">
            ${selected.map(item => `<span class="badge">${item.toUpperCase()}</span>`).join('')}
          </div>

          <div class="grid">
            <div class="info-box">
              <div class="label">Material</div>
              <div class="value">${labDetails.material}</div>
            </div>
            <div class="info-box">
              <div class="label">Shade / Margin</div>
              <div class="value">${labDetails.shade} &middot; ${labDetails.margin}</div>
            </div>
          </div>

          ${labDetails.instructions ? `
            <div class="section-title">Special Instructions</div>
            <div class="instructions">${labDetails.instructions}</div>
          ` : ''}

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <AppLayout>
      <View style={styles.container}>
        <Text style={styles.description}>Auto-filled from clinical entry — review and send.</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.reqNumber}>Lab requisition #{caseId ? caseId.slice(0, 8).toUpperCase() : 'NEW'}</Text>
            <Text style={styles.cardTitle}>{selected.join(" & ") || "New Request"} — Tooth {patientData.tooth_number || "XX"}</Text>
            <View style={styles.headerMeta}>
              <Text style={styles.metaText}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              <Text style={styles.metaText}>Return: 5–7 days</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Patient name</Text>
              <TextInput style={styles.input} value={patientData.patient_name} editable={false} placeholder="Patient name" />
            </View>

            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Age</Text>
                <TextInput style={styles.input} value={String(patientData.age || "")} editable={false} placeholder="Age" />
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Gender</Text>
                <TextInput style={styles.input} value={patientData.gender} editable={false} placeholder="Gender" />
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
              <TextInput style={styles.input} value={patientData.tooth_number} editable={false} placeholder="XX" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Diagnosis / Indication</Text>
              <TextInput style={styles.input} value={patientData.diagnosis} editable={false} multiline placeholder="Primary diagnosis" />
            </View>

            <View style={styles.selectionGroup}>
              <Text style={styles.label}>Lab work required</Text>
              <View style={styles.badgeGrid}>
                {labOptions.map((o) => {
                  const active = selected.includes(o.id);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      onPress={() => toggle(o.id)}
                      style={[styles.badge, active && styles.badgeActive]}
                    >
                      <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Material</Text>
              <TextInput 
                style={styles.input} 
                value={labDetails.material}
                onChangeText={(v) => setLabDetails({...labDetails, material: v})}
                placeholder="Enter material (e.g. Zirconia)" 
              />
            </View>

            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Shade</Text>
                <TextInput 
                  style={styles.input} 
                  value={labDetails.shade}
                  onChangeText={(v) => setLabDetails({...labDetails, shade: v})}
                  placeholder="e.g. A2" 
                />
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Margin</Text>
                <TextInput 
                  style={styles.input} 
                  value={labDetails.margin}
                  onChangeText={(v) => setLabDetails({...labDetails, margin: v})}
                  placeholder="e.g. Chamfer" 
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Special instructions</Text>
              <TextInput
                style={styles.textarea}
                value={labDetails.instructions}
                onChangeText={(v) => setLabDetails({...labDetails, instructions: v})}
                placeholder="Match translucency, specific contact notes, etc."
                multiline
              />
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => handlePrint(true)}>
              <Download size={16} color="#0F172A" />
              <Text style={styles.secondaryButtonText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => handlePrint(false)}>
              <Printer size={16} color="#0F172A" />
              <Text style={styles.secondaryButtonText}>Print</Text>
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
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
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
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  badgeActive: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  badgeText: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  badgeTextActive: {
    color: "#FFFFFF",
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
  actions: {
    gap: 10,
    marginTop: 8,
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
});

export default LabRequisition;
