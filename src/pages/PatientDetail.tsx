import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import {
  FileText,
  Sparkles,
  ClipboardList,
  Image as ImageIcon,
  Download,
  CheckCircle2,
  Circle,
  Calendar,
  Loader2,
  AlertCircle,
  Upload,
  Trash2,
  Printer,
  Eye
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";


const getDynamicTimeline = (patient: any) => {
  const t = [
    { date: new Date(patient.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), title: "Case Created", desc: `${patient.diagnosis || 'Clinical entry initiated'}`, done: true, type: "diagnosis" },
  ];

  if (patient.status === 'lab-pending' || patient.status === 'lab-received' || patient.status === 'completed') {
    t.push({ date: "In Progress", title: "Lab Requisition", desc: "Crown/Prosthesis fabrication requested", done: patient.status !== 'lab-pending', type: "lab" });
  }

  if (patient.status === 'checkup-pending' || patient.status === 'completed') {
    t.push({ date: "Follow-up", title: "Final Checkup", desc: "Clinical review and cementation", done: patient.status === 'completed', type: "follow" });
  }

  if (patient.status === 'completed') {
    t.push({ date: "Finished", title: "Treatment Completed", desc: "Case closed successfully", done: true, type: "step" });
  }

  return t;
};

const PatientDetail = () => {
  const route = useRoute<any>();
  const id = route.params?.id;
  const [activeTab, setActiveTab] = useState("all info");
  const [patient, setPatient] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const navigation = useRef<any>(null);

  const nav = useNavigation<any>();

  const fetchFiles = async (doctorId: string, patientName: string) => {
    const { data: storageFiles } = await supabase.storage
      .from('clinical-files')
      .list(doctorId);

    if (storageFiles) {
      const matchedFiles = storageFiles.filter(f => {
        const parts = f.name.split('--');
        if (parts.length > 1) {
          const pName = parts[0].split('_')[0]?.replace(/-/g, ' ');
          return pName?.toLowerCase() === patientName.toLowerCase();
        }
        return false;
      }).map(f => ({
        name: f.name.split('--').slice(1).join('--') || f.name,
        tag: f.name.split('--')[0]?.split('_')[1]?.replace(/-/g, ' ') || "Other",
        path: `${doctorId}/${f.name}`,
        type: f.name.match(/\.(jpg|jpeg|png|gif)$/i) ? "img" : "pdf"
      }));
      setFiles(matchedFiles);
    }
  };

  React.useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      const { data: caseData } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single();

      if (caseData) {
        setPatient(caseData);
        if (caseData.doctor_id) {
          await fetchFiles(caseData.doctor_id, caseData.patient_name);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <View style={styles.loadingContainer}>
          <Loader2 size={24} color="#0EA5E9" />
          <Text style={styles.loadingText}>Loading patient record...</Text>
        </View>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color="#EF4444" />
          <Text style={styles.errorText}>Patient record not found.</Text>
        </View>
      </AppLayout>
    );
  }

  const handleFileUpload = async () => {
    if (Platform.OS === 'web') {
      // Web: use a hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.multiple = false;
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await uploadFile(file.name, file.type, file);
      };
      input.click();
    } else {
      // Mobile: dynamically import expo-document-picker to avoid Vite bundling issues
      try {
        const DocumentPicker = await import('expo-document-picker');
        const result = await DocumentPicker.getDocumentAsync({
          type: '*/*',
          copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return;

        const asset = result.assets[0];
        // Fetch the file as a blob from its local URI
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        await uploadFile(asset.name, asset.mimeType || 'application/octet-stream', blob);
      } catch (err: any) {
        alert('Could not open file picker: ' + err.message);
      }
    }
  };

  const uploadFile = async (fileName: string, mimeType: string, fileData: any) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = fileName.split('.').pop();
      const sanitizedPatient = patient.patient_name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      const sanitizedDate = new Date().toISOString().split('T')[0];
      const uploadName = `${sanitizedPatient}_Report_${sanitizedDate}--${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${uploadName}`;

      const { error: uploadError } = await supabase.storage
        .from('clinical-files')
        .upload(filePath, fileData, {
          contentType: mimeType || 'application/octet-stream',
          upsert: true
        });

      if (uploadError) throw uploadError;
      await fetchFiles(user.id, patient.patient_name);
      alert('File uploaded successfully!');
    } catch (error: any) {
      console.error("Upload failed:", error.message);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('cases')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      setPatient({ ...patient, status: newStatus });
      alert(`Patient journey moved to: ${newStatus.replace('-', ' ')}`);
    } catch (error: any) {
      alert("Status update failed: " + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to delete this file?')) return;
    }
    const { error } = await supabase.storage.from('clinical-files').remove([filePath]);
    if (error) {
      alert('Delete failed: ' + error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await fetchFiles(user.id, patient.patient_name);
    }
  };

  const handleDeleteCase = async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to permanently delete this case? This cannot be undone.')) return;
    }
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Case deleted successfully.');
      nav.goBack();
    } catch (error: any) {
      alert('Failed to delete case: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadFile = async (path: string, name: string) => {
    try {
      const { data } = await supabase.storage
        .from('clinical-files')
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        if (Platform.OS === 'web') {
          const response = await fetch(data.signedUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          import("react-native").then(({ Linking }) => {
            Linking.openURL(data.signedUrl);
          });
        }
      }
    } catch (err: any) {
      alert("Download failed: " + err.message);
    }
  };

  const renderTimeline = () => {
    const dynamicTimeline = getDynamicTimeline(patient);
    return (
      <View style={styles.card}>
        <View style={styles.timelineContainer}>
          <View style={styles.timelineLine} />
          {dynamicTimeline.map((t, i) => (
            <View key={i} style={styles.timelineItem}>
              <View style={styles.timelineIconBox}>
                {t.done ? (
                  <View style={styles.doneIcon}>
                    <CheckCircle2 size={16} color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.todoIcon}>
                    <Circle size={12} color="#CBD5E1" />
                  </View>
                )}
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineTitle}>{t.title}</Text>
                  <View style={styles.dateBadge}>
                    <Calendar size={10} color="#64748B" />
                    <Text style={styles.dateText}>{t.date}</Text>
                  </View>
                </View>
                <Text style={styles.timelineDesc}>{t.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderNotes = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <FileText size={16} color="#0EA5E9" />
        <Text style={styles.cardHeaderTitle}>Clinical notes</Text>
      </View>
      <Text style={styles.notesText}>
        {patient.notes || "No additional clinical notes captured for this visit."}
      </Text>
    </View>
  );

  const renderInfo = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <ClipboardList size={16} color="#0EA5E9" />
        <Text style={styles.cardHeaderTitle}>Patient information</Text>
      </View>
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Gender</Text>
          <Text style={styles.infoValue}>{patient.gender || "Not specified"}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Tooth</Text>
          <Text style={styles.infoValue}>#{patient.tooth_number}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Chief Complaint</Text>
        <Text style={styles.infoValueText}>{patient.diagnosis || "No complaint recorded"}</Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoLabel}>Reported Symptoms</Text>
        <View style={styles.symptomRow}>
          <View style={styles.symptomBadge}>
            <Text style={styles.symptomBadgeText}>Standard Review</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderFiles = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <ClipboardList size={16} color="#8B5CF6" />
        <Text style={styles.cardHeaderTitle}>Lab forms & uploads</Text>
      </View>

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={handleFileUpload}
        disabled={uploading}
      >
        {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Upload size={16} color="#FFFFFF" />}
        <Text style={styles.uploadButtonText}>{uploading ? "Uploading..." : "Upload New File"}</Text>
      </TouchableOpacity>

      <View style={styles.fileList}>
        {files.length > 0 ? (
          files.map((f) => (
            <View key={f.name} style={styles.fileItem}>
              <View style={styles.fileIconBox}>
                {f.type === "img" ? <ImageIcon size={18} color="#0EA5E9" /> : <FileText size={18} color="#0EA5E9" />}
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                <View style={styles.fileTag}>
                  <Text style={styles.fileTagText}>{f.tag}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.viewButton}
                onPress={async () => {
                  const { data } = await supabase.storage
                    .from('clinical-files')
                    .createSignedUrl(f.path, 3600);
                  if (data?.signedUrl) {
                    if (Platform.OS === 'web') window.open(data.signedUrl, '_blank');
                    else import("react-native").then(({ Linking }) => Linking.openURL(data.signedUrl));
                  }
                }}
              >
                <Eye size={18} color="#0EA5E9" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleDownloadFile(f.path, f.name)}
              >
                <Printer size={18} color="#10B981" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteFile(f.path)}
              >
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyFilesText}>No files uploaded for this patient yet.</Text>
        )}
      </View>
    </View>
  );

  return (
    <AppLayout>
      <View style={styles.container}>
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>P</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.patientName}>{patient.patient_name}</Text>
              <Text style={styles.patientMeta}>
                #{id.slice(0, 8)} · Tooth {patient.tooth_number}
              </Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{patient.status.replace('-', ' ')}</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          {["all info", "actions"].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.content}>
          {activeTab === "all info" && (
            <>
              {renderTimeline()}
              {renderInfo()}
              {renderNotes()}
              {renderFiles()}
            </>
          )}
          {activeTab === "actions" && (
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>Action Center</Text>
              <Text style={styles.actionDesc}>Manage patient treatment lifecycle</Text>

              <View style={styles.actionGrid}>
                <TouchableOpacity
                  style={[styles.actionBtn, patient.status === 'lab-pending' && styles.actionBtnActive]}
                  onPress={() => nav.navigate("LabRequisition", { caseId: patient.id })}
                >
                  <ClipboardList size={20} color={patient.status === 'lab-pending' ? "#FFFFFF" : "#0EA5E9"} />
                  <Text style={[styles.actionBtnLabel, patient.status === 'lab-pending' && styles.actionBtnLabelActive]}>Request Lab</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, patient.status === 'completed' && styles.actionBtnActive]}
                  onPress={() => handleStatusUpdate('completed')}
                >
                  <CheckCircle2 size={20} color={patient.status === 'completed' ? "#FFFFFF" : "#22C55E"} />
                  <Text style={[styles.actionBtnLabel, patient.status === 'completed' && styles.actionBtnLabelActive]}>Complete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                  onPress={handleDeleteCase}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Trash2 size={20} color="#EF4444" />
                  )}
                  <Text style={[styles.actionBtnLabel, { color: '#EF4444' }]}>Delete Case</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  profileCard: {
    backgroundColor: "#0EA5E9",
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  patientMeta: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#0F172A",
  },
  content: {
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  timelineContainer: {
    position: "relative",
    paddingLeft: 4,
  },
  timelineLine: {
    position: "absolute",
    left: 15,
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: "#F1F5F9",
  },
  timelineItem: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  timelineIconBox: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  doneIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  todoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  timelineDesc: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  notesText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
  fileList: {
    gap: 10,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  fileTag: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  fileTagText: {
    fontSize: 10,
    color: "#64748B",
  },
  downloadButton: {
    padding: 8,
  },
  viewButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyFilesText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    padding: 20,
    fontStyle: "italic",
  },
  uploadButton: {
    backgroundColor: "#0EA5E9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    gap: 8,
  },
  actionBtnActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  actionBtnLabelActive: {
    color: "#FFFFFF",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    textTransform: "capitalize",
  },
  infoSection: {
    marginTop: 12,
  },
  infoValueText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  symptomRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  symptomBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  symptomBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
});

export default PatientDetail;