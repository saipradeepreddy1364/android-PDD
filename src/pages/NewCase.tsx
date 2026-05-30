import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { X, ChevronDown, Check, Stethoscope, Clipboard } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const symptomOptions = ["Pain", "Swelling", "Sensitivity", "Sinus tract", "Mobility", "Bleeding"];

const NewCase = () => {
  const navigation = useNavigation<any>();
  const [symptoms, setSymptoms] = useState<string[]>(["Pain"]);
  const [loading, setLoading] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    patient_name: "",
    age: "",
    gender: "",           // ← blank by default
    tooth_number: "",
    chief_complaint: "",
    notes: "",
    case_type: "new-checkup",
  });

  React.useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'organization') {
          navigation.navigate("OrgDashboard");
        }
      }
    };
    checkAccess();
  }, [navigation]);

  const toggleSymptom = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleSubmit = async () => {
    if (!formData.patient_name.trim()) {
      alert("Please enter the patient name.");
      return;
    }
    if (!formData.gender) {
      alert("Please select a gender.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate("Login");
        return;
      }

      // Fetch doctor's profile to get org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase.from('cases').insert([
        {
          patient_name: formData.patient_name,
          gender: formData.gender,
          tooth_number: formData.tooth_number,
          diagnosis: formData.chief_complaint,
          status:
            formData.case_type === "lab"
              ? "lab-pending"
              : formData.case_type === "new-checkup"
                ? "checkup-pending"
                : "in-progress",
          doctor_id: user.id,
          org_id: profile?.org_id || null,
        },
      ]);

      if (error) throw error;
      navigation.navigate("Patients");
    } catch (error: any) {
      console.error(error);
      alert("Error adding case: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <ScrollView style={styles.container}>
        <Text style={styles.description}>Capture clinical findings for the patient.</Text>

        <View style={styles.form}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Patient details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Patient name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter patient full name"
                value={formData.patient_name}
                onChangeText={(v) => setFormData({ ...formData, patient_name: v })}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Case Type</Text>
              <View style={styles.typeRow}>
                {[
                  { id: "new-checkup", label: "Checkup", icon: Stethoscope },
                  { id: "active", label: "General", icon: Clipboard },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setFormData({ ...formData, case_type: t.id })}
                    style={[styles.typeButton, formData.case_type === t.id && styles.typeButtonActive]}
                  >
                    <t.icon size={16} color={formData.case_type === t.id ? "#FFFFFF" : "#64748B"} />
                    <Text style={[styles.typeButtonText, formData.case_type === t.id && styles.typeButtonTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Age</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Yrs"
                  value={formData.age}
                  onChangeText={(v) => setFormData({ ...formData, age: v })}
                  keyboardType="numeric"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.label}>Gender</Text>
                <TouchableOpacity
                  onPress={() => setGenderModalVisible(true)}
                  style={styles.selectTrigger}
                >
                  <Text style={[styles.selectValue, !formData.gender && styles.selectPlaceholder]}>
                    {formData.gender
                      ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1)
                      : "Select"}
                  </Text>
                  <ChevronDown size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tooth number (FDI)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 11, 24, 36"
                value={formData.tooth_number}
                onChangeText={(v) => setFormData({ ...formData, tooth_number: v })}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Chief complaint</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe patient's primary issue"
                value={formData.chief_complaint}
                onChangeText={(v) => setFormData({ ...formData, chief_complaint: v })}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Symptoms</Text>
            <View style={styles.symptomsGrid}>
              {symptomOptions.map((s) => {
                const active = symptoms.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleSymptom(s)}
                    style={[styles.symptomBadge, active && styles.symptomBadgeActive]}
                  >
                    <Text style={[styles.symptomText, active && styles.symptomTextActive]}>{s}</Text>
                    {active && <X size={12} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Clinical notes</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Add detailed clinical findings, response to tests, or specific treatment plans..."
              multiline
              value={formData.notes}
              onChangeText={(v) => setFormData({ ...formData, notes: v })}
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.submitButtonText}>Add Case</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Gender Picker Modal */}
      <Modal
        visible={genderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGenderModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGenderModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {["male", "female", "other"].map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.modalOption}
                onPress={() => {
                  setFormData({ ...formData, gender: g });
                  setGenderModalVisible(false);
                }}
              >
                <Text style={[styles.modalOptionText, formData.gender === g && styles.modalOptionTextActive]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
                {formData.gender === g && <Check size={16} color="#0EA5E9" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
    marginBottom: 4,
  },
  form: {
    gap: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
    gap: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
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
  selectTrigger: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectValue: {
    fontSize: 14,
    color: "#0F172A",
  },
  selectPlaceholder: {
    color: "#94A3B8",   // ← grey like other placeholders when nothing selected
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  typeButtonTextActive: {
    color: "#FFFFFF",
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  symptomBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  symptomBadgeActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  symptomText: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  symptomTextActive: {
    color: "#FFFFFF",
  },
  textarea: {
    fontSize: 14,
    color: "#0F172A",
    minHeight: 100,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  submitButton: {
    flex: 2,
    height: 48,
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  modalOption: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingHorizontal: 4,
  },
  modalOptionText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "500",
  },
  modalOptionTextActive: {
    color: "#0EA5E9",
    fontWeight: "700",
  },
});

export default NewCase;