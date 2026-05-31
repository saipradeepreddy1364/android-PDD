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

const parseLabNotes = (notes: string | null) => {
  if (!notes) return null;

  // Extract the [LAB REQUESTED ...] block
  const labBlock = notes.match(/\[LAB REQUESTED[^\]]*\]([\s\S]*)/);
  if (!labBlock) {
    const clean = notes.trim();
    return clean ? { rawNotes: clean } : null;
  }

  const block = labBlock[1];
  const extract = (key: string) => {
    const match = block.match(new RegExp(`${key}:\\s*(.+)`));
    return match ? match[1].trim() : null;
  };

  const procedure  = extract("Procedure");
  const subtype    = extract("Subtype");
  const material   = extract("Material");
  const shade      = extract("Shade");
  const margin     = extract("Margin");
  const instructions = extract("Special instructions") || extract("Instructions");

  const beforeBlock = notes.split(/\[LAB REQUESTED/)[0].trim();

  return {
    procedure:     procedure !== "None" ? procedure : null,
    subtype:       subtype !== "None" ? subtype : null,
    material:      material !== "None" ? material : null,
    shade:         shade !== "None" ? shade : null,
    margin:        margin !== "None" ? margin : null,
    instructions:  instructions !== "None" ? instructions : null,
    rawNotes:      beforeBlock || null,
  };
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigation = useRef<any>(null);

  const nav = useNavigation<any>();

  const fetchFiles = async (caseId: string, patientName: string) => {
    const { data: storageFiles } = await supabase.storage
      .from('clinical-files')
      .list(caseId);

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
        path: `${caseId}/${f.name}`,
        type: f.name.match(/\.(jpg|jpeg|png|gif)$/i) ? "img" : "pdf"
      }));
      setFiles(matchedFiles);
    }
  };

  React.useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.error("Error fetching user profile in PatientDetail:", err);
      }

      const { data: caseData } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single();

      if (caseData) {
        setPatient(caseData);
        await fetchFiles(caseData.id, caseData.patient_name);
      }
      setLoading(false);
    };

    fetchData();

    // 1-second auto polling for reliable fallback/sync
    const interval = setInterval(fetchData, 1000);

    // Supabase Realtime channel for instant push updates
    const channel = supabase
      .channel(`patient-detail-${id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases', filter: `id=eq.${id}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
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

  // NOTE: This function must NOT be async — iOS Safari only allows opening the
  // file picker synchronously within a direct user-gesture (tap) event.
  // Making it async would break the synchronous execution context and iOS would
  // silently block the picker, causing "failed to fetch" errors.
  const handleFileUpload = () => {
    if (Platform.OS === 'web') {
      // Web (desktop + mobile browsers/PWA): use a hidden file input.
      // input.click() must be called synchronously — so this function is NOT async.
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.multiple = false;
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          // Read as ArrayBuffer first — mobile browsers (iOS Safari, Android Chrome)
          // fail with "failed to fetch" when a raw File object is passed to Supabase.
          // Converting to Uint8Array ensures binary data is sent correctly on all platforms.
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          await uploadFile(file.name, file.type || 'application/octet-stream', bytes);
        } catch (err: any) {
          alert('Failed to read file: ' + err.message);
        }
      };
      input.click();
    } else {
      // Native Expo (iOS/Android): dynamically import expo-document-picker.
      // Wrapped in an IIFE since we can't make the outer function async.
      (async () => {
        try {
          const DocumentPicker = await import('expo-document-picker');
          const result = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
          });

          if (result.canceled || !result.assets || result.assets.length === 0) return;

          const asset = result.assets[0];

          try {
            const FileSystem = await import('expo-file-system');
            const base64 = await (FileSystem as any).readAsStringAsync(asset.uri, {
              encoding: (FileSystem as any).EncodingType.Base64 || 'base64',
            });

            // Decode base64 → ArrayBuffer
            // atob() is available in all modern browsers and Expo (Hermes engine).
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            await uploadFile(asset.name, asset.mimeType || 'application/octet-stream', bytes.buffer);
          } catch (fsErr: any) {
            console.error("File system read error:", fsErr);
            alert("Could not read chosen file: " + fsErr.message);
          }
        } catch (err: any) {
          alert('Could not open file picker: ' + err.message);
        }
      })();
    }
  };

  const uploadFile = async (fileName: string, mimeType: string, fileData: any) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = fileName.split('.').pop() || 'bin';
      const sanitizedPatient = patient.patient_name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      const sanitizedDate = new Date().toISOString().split('T')[0];
      const uploadName = `${sanitizedPatient}_Report_${sanitizedDate}--${Date.now()}.${fileExt}`;
      const filePath = `${id}/${uploadName}`;

      let finalMimeType = mimeType;
      const ext = fileExt.toLowerCase();
      if (!finalMimeType || finalMimeType === 'application/octet-stream') {
        if (ext === 'pdf') finalMimeType = 'application/pdf';
        else if (ext === 'jpg' || ext === 'jpeg') finalMimeType = 'image/jpeg';
        else if (ext === 'png') finalMimeType = 'image/png';
        else if (ext === 'gif') finalMimeType = 'image/gif';
      }

      // Convert Uint8Array/ArrayBuffer to a native Blob on web to ensure complete
      // compatibility across all mobile browsers (e.g. iOS Safari and Android Chrome).
      // Standard fetch() body on web expects Blob/File and sometimes fails with raw Uint8Array.
      let dataToUpload = fileData;
      if (Platform.OS === 'web' && !(fileData instanceof Blob)) {
        try {
          dataToUpload = new Blob([fileData], { type: finalMimeType });
        } catch (blobErr) {
          console.warn("Could not convert data to Blob, uploading raw data:", blobErr);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('clinical-files')
        .upload(filePath, dataToUpload, {
          contentType: finalMimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;
      await fetchFiles(id, patient.patient_name);
      alert('File uploaded successfully!');
    } catch (error: any) {
      console.error('Upload failed:', error.message);
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
      if (id) await fetchFiles(id, patient.patient_name);
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
            Linking.openURL(encodeURI(data.signedUrl));
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
                  const newWindow = Platform.OS === 'web' ? window.open('', '_blank') : null;
                  const { data } = await supabase.storage
                    .from('clinical-files')
                    .createSignedUrl(f.path, 3600);
                  if (data?.signedUrl) {
                    if (Platform.OS === 'web') {
                      if (newWindow) newWindow.location.href = data.signedUrl;
                    } else {
                      import("react-native").then(({ Linking }) => Linking.openURL(encodeURI(data.signedUrl)));
                    }
                  } else {
                    if (newWindow) newWindow.close();
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

  const handleCancelLabRequest = async () => {
    if (Platform.OS === 'web') {
      if (!window.confirm('Cancel this lab request? The case will return to in-progress status.')) return;
    }
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('cases')
        .update({ status: 'in-progress', notes: null })
        .eq('id', id);
      if (error) throw error;
      setPatient({ ...patient, status: 'in-progress', notes: null });
      alert('Lab request cancelled. Case returned to in-progress.');
    } catch (err: any) {
      alert('Failed to cancel request: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderRequests = () => {
    const hasLabRequest = ['lab-pending', 'lab-received', 'completed'].includes(patient.status);
    const labDetails = hasLabRequest ? parseLabNotes(patient.notes) : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <ClipboardList size={16} color="#8B5CF6" />
          <Text style={styles.cardHeaderTitle}>Lab Requisition</Text>
        </View>

        {!hasLabRequest ? (
          <View style={styles.emptyRequests}>
            <ClipboardList size={36} color="#94A3B8" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyRequestsText}>No active lab requisitions for this patient.</Text>
            {userRole !== 'organization' && (
              <TouchableOpacity
                style={styles.raiseRequestBtn}
                onPress={() => nav.navigate('LabRequisition', { caseId: patient.id })}
              >
                <Text style={styles.raiseRequestBtnText}>Raise Lab Request</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.requestContent}>
            {/* Status Section */}
            <View style={styles.requestStatusBox}>
              <Text style={styles.statusLabel}>Current Status</Text>
              <View style={styles.badgeRow}>
                <View style={[
                  styles.statusPillLarge,
                  {
                    backgroundColor:
                      patient.status === 'lab-pending' ? '#FEF2F2' :
                      patient.status === 'lab-received' ? '#FEF3C7' : '#ECFDF5',
                    borderColor:
                      patient.status === 'lab-pending' ? '#FCA5A5' :
                      patient.status === 'lab-received' ? '#FCD34D' : '#A7F3D0',
                    borderWidth: 1,
                  }
                ]}>
                  <Text style={[
                    styles.statusPillLargeText,
                    {
                      color:
                        patient.status === 'lab-pending' ? '#EF4444' :
                        patient.status === 'lab-received' ? '#D97706' : '#10B981',
                    }
                  ]}>
                    {patient.status === 'lab-pending' ? 'Submitted' :
                     patient.status === 'lab-received' ? 'In Progress' : 'Completed'}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusDescText}>
                {patient.status === 'lab-pending' && "Requisition has been sent to the lab. Awaiting production start."}
                {patient.status === 'lab-received' && "Lab has accepted the requisition. Work is in progress."}
                {patient.status === 'completed' && "Lab work has been finished and delivered."}
              </Text>
            </View>

            {/* Details Section */}
            {labDetails ? (
              <View style={styles.detailsList}>
                <Text style={styles.detailsHeader}>Requisition Details</Text>
                
                {labDetails.procedure && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailName}>Procedure</Text>
                    <Text style={styles.detailValue}>{labDetails.procedure}</Text>
                  </View>
                )}
                {labDetails.subtype && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailName}>Subtype</Text>
                    <Text style={styles.detailValue}>{labDetails.subtype}</Text>
                  </View>
                )}
                {labDetails.material && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailName}>Material</Text>
                    <Text style={styles.detailValue}>{labDetails.material}</Text>
                  </View>
                )}
                {labDetails.shade && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailName}>Shade</Text>
                    <Text style={styles.detailValue}>{labDetails.shade}</Text>
                  </View>
                )}
                {labDetails.margin && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailName}>Margin</Text>
                    <Text style={styles.detailValue}>{labDetails.margin}</Text>
                  </View>
                )}
                {labDetails.instructions && (
                  <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', borderBottomWidth: 0 }]}>
                    <Text style={styles.detailName}>Special Instructions</Text>
                    <Text style={[styles.detailValue, { marginTop: 4, color: '#475569', lineHeight: 18 }]}>{labDetails.instructions}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.notesFallback}>
                <Text style={styles.detailsHeader}>Clinical Notes / Instructions</Text>
                <Text style={styles.notesFallbackText}>{patient.notes || "No additional notes provided."}</Text>
              </View>
            )}

            {/* Cancel Request — only show for lab-pending & only for non-org roles */}
            {patient.status === 'lab-pending' && userRole !== 'organization' && (
              <TouchableOpacity
                style={styles.cancelRequestBtn}
                onPress={handleCancelLabRequest}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <Trash2 size={14} color="#EF4444" />}
                <Text style={styles.cancelRequestBtnText}>Cancel / Delete Request</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

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
          {["all info", "requests", "actions"]
            .filter(tab => tab !== "actions" || userRole !== "organization")
            .map((tab) => (
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
          {activeTab === "requests" && renderRequests()}
          {activeTab === "actions" && (
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>Action Center</Text>
              <Text style={styles.actionDesc}>Manage patient treatment lifecycle</Text>

              <View style={styles.actionGrid}>
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
  cancelRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
  },
  cancelRequestBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Requests Tab Styles ──
  emptyRequests: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRequestsText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  raiseRequestBtn: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  raiseRequestBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  requestContent: {
    gap: 20,
  },
  requestStatusBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: 8,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  statusPillLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillLargeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusDescText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 4,
  },
  detailsList: {
    gap: 12,
  },
  detailsHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailName: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  notesFallback: {
    gap: 8,
  },
  notesFallbackText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
});

export default PatientDetail;