import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, DeviceEventEmitter, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Info, AlertTriangle, CheckCircle2, Mail, Phone, Stethoscope, Calendar, UserCheck, UserX } from "lucide-react-native";
import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { supabase } from "@/lib/supabase";
import { useTheme } from "./ThemeProvider";

type PendingDoctor = {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  specialization?: string;
  created_at: string;
  org_name?: string;
  role?: string;
};

type CaseNotification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "urgent" | "update";
  time: string;
};

type UserRole = "organization" | "doctor" | "lab" | null;

export const NotificationSidebar = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const insets = useSafeAreaInsets();
  const [pendingDoctors, setPendingDoctors] = useState<PendingDoctor[]>([]);
  const [caseNotifs, setCaseNotifs] = useState<CaseNotification[]>([]);
  const [labPendingCases, setLabPendingCases] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Cache session to avoid repeated getUser() calls
  const sessionRef = useRef<{ userId: string; role: UserRole; orgId: string } | null>(null);

  const loadSession = async () => {
    if (sessionRef.current) return sessionRef.current;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', session.user.id)
      .single();
    const result = {
      userId: session.user.id,
      role: (profile?.role ?? null) as UserRole,
      // For org users, their own userId IS their org_id.
      // For lab/doctor users, org_id points to their parent org.
      orgId: (profile?.role === 'organization' ? session.user.id : profile?.org_id) ?? session.user.id,
    };
    sessionRef.current = result;
    return result;
  };

  const fetchData = async () => {
    const sess = await loadSession();
    if (!sess) return;
    setUserRole(sess.role);

    if (sess.role === 'organization') {
      // Fetch full doctor and lab details for pending approvals
      const { data: doctors } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, specialization, created_at, org_name, role')
        .eq('org_id', sess.userId)
        .in('role', ['doctor', 'lab'])
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (doctors) setPendingDoctors(doctors);

    } else if (sess.role === 'lab') {
      // Fetch pending lab requisitions for this lab's org
      const { data: labCases } = await supabase
        .from('cases')
        .select('id, patient_name, tooth_number, diagnosis, doctor_name, created_at, is_urgent')
        .eq('org_id', sess.orgId)
        .eq('status', 'lab-pending')
        .order('created_at', { ascending: false })
        .limit(20);

      if (labCases) setLabPendingCases(labCases);

    } else if (sess.role === 'doctor') {
      // Fetch recent case updates for doctors
      const { data: cases } = await supabase
        .from('cases')
        .select('id, patient_name, tooth_number, diagnosis, is_urgent, status, created_at')
        .eq('doctor_id', sess.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (cases) {
        const mapped: CaseNotification[] = cases.map(c => ({
          id: c.id,
          title: c.is_urgent ? '🚨 Urgent Case' : 'Case Assigned',
          message: `${c.patient_name}: Tooth ${c.tooth_number} — ${c.diagnosis}`,
          type: c.is_urgent ? 'urgent' : 'info',
          time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setCaseNotifs(mapped);
      }
    }
  };

  useEffect(() => {
    if (!open) return;

    // Invalidate session cache when re-opened so role re-resolves
    sessionRef.current = null;
    fetchData();

    // Poll every 1s while open — realtime handles instant updates
    const pollInterval = setInterval(fetchData, 1000);

    const channel = supabase
      .channel('sidebar-realtime-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, fetchData)
      .subscribe();

    // Also refresh when LabDashboard emits a lab count refresh signal
    const labSub = DeviceEventEmitter.addListener('refreshLabCount', fetchData);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      labSub.remove();
    };
  }, [open]);

  const handleAction = async (doctorId: string, status: 'approved' | 'rejected') => {
    // Optimistic removal — instant UI feedback before DB call completes
    setPendingDoctors(prev => prev.filter(d => d.id !== doctorId));
    setProcessingIds(prev => new Set(prev).add(doctorId));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', doctorId);

      if (error) throw error;
      DeviceEventEmitter.emit('refreshPendingCount');
    } catch (err: any) {
      // Revert optimistic update on error
      console.error("Error updating status:", err);
      fetchData(); // Re-fetch to restore correct state
      Alert.alert("Error", "Failed to update doctor status. Please try again.");
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(doctorId);
        return next;
      });
    }
  };

  const handleAcceptLabCase = async (caseId: string) => {
    // Optimistic removal from pending list
    setLabPendingCases(prev => prev.filter(c => c.id !== caseId));
    try {
      const { error } = await supabase
        .from('cases')
        .update({ status: 'lab-received' })
        .eq('id', caseId);
      if (error) throw error;
      DeviceEventEmitter.emit('refreshLabCases');
      DeviceEventEmitter.emit('refreshLabCount');
    } catch (err: any) {
      fetchData();
      Alert.alert('Error', 'Failed to accept lab case: ' + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const totalCount = pendingDoctors.length + caseNotifs.length + labPendingCases.length;

  return (
    <SheetContent open={open} onOpenChange={onOpenChange} side="right" style={[styles.sheetContent, isDark && styles.sheetContentDark]}>
      <SheetHeader style={[styles.header, isDark && styles.headerDark, { paddingTop: Math.max(20, insets.top + 8) }]}>
        <View style={styles.titleRow}>
          <Bell size={20} color={isDark ? "#FFF" : "#0F172A"} />
          <SheetTitle style={[styles.title, isDark && styles.titleDark]}>Notifications</SheetTitle>
          {totalCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{totalCount}</Text>
            </View>
          )}
          <SheetDescription style={{ display: "none" }}>
            View your recent clinical updates and alerts.
          </SheetDescription>
        </View>
        <TouchableOpacity onPress={() => { setPendingDoctors([]); setCaseNotifs([]); }}>
          <Text style={styles.clearAll}>Clear all</Text>
        </TouchableOpacity>
      </SheetHeader>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={totalCount === 0 && { flex: 1 }}>
        {totalCount > 0 ? (
          <>
            {/* Pending Doctor Approvals (org role) */}
            {pendingDoctors.length > 0 && (
              <>
                <View style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
                  <Text style={[styles.sectionLabelText, isDark && styles.sectionLabelTextDark]}>
                    PENDING APPROVALS · {pendingDoctors.length}
                  </Text>
                </View>
                {pendingDoctors.map((doc) => {
                  const isProcessing = processingIds.has(doc.id);
                  return (
                    <View
                      key={doc.id}
                      style={[styles.doctorCard, isDark && styles.doctorCardDark]}
                    >
                      {/* Avatar + Name Row */}
                      <View style={styles.doctorTopRow}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{doc.full_name?.charAt(0)?.toUpperCase() || "D"}</Text>
                        </View>
                        <View style={styles.doctorInfo}>
                          <Text style={[styles.doctorName, isDark && styles.doctorNameDark]} numberOfLines={1}>
                            {doc.full_name || "Unknown"} {doc.role === 'lab' ? '🔬 (Lab)' : '🩺 (Doctor)'}
                          </Text>
                          <Text style={styles.requestedAt}>Requested {formatDate(doc.created_at)}</Text>
                        </View>
                      </View>

                      {/* Detail rows */}
                      <View style={styles.detailList}>
                        {doc.specialization ? (
                          <View style={styles.detailRow}>
                            <Stethoscope size={11} color="#64748B" />
                            <Text style={styles.detailText}>{doc.specialization}</Text>
                          </View>
                        ) : null}
                        {doc.email ? (
                          <View style={styles.detailRow}>
                            <Mail size={11} color="#64748B" />
                            <Text style={styles.detailText} numberOfLines={1}>{doc.email}</Text>
                          </View>
                        ) : null}
                        {doc.phone ? (
                          <View style={styles.detailRow}>
                            <Phone size={11} color="#64748B" />
                            <Text style={styles.detailText}>{doc.phone}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.rejectBtn, isProcessing && styles.btnDisabled]}
                          disabled={isProcessing}
                          onPress={() => handleAction(doc.id, 'rejected')}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <>
                              <UserX size={13} color="#EF4444" />
                              <Text style={styles.rejectBtnText}>Reject</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.approveBtn, isProcessing && styles.btnDisabled]}
                          disabled={isProcessing}
                          onPress={() => handleAction(doc.id, 'approved')}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <>
                              <UserCheck size={13} color="#FFFFFF" />
                              <Text style={styles.approveBtnText}>Approve</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Pending Lab Requisitions (lab role) */}
            {labPendingCases.length > 0 && (
              <>
                <View style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
                  <Text style={[styles.sectionLabelText, isDark && styles.sectionLabelTextDark]}>
                    PENDING LAB REQUISITIONS · {labPendingCases.length}
                  </Text>
                </View>
                {labPendingCases.map((c) => (
                  <View key={c.id} style={[styles.doctorCard, isDark && styles.doctorCardDark, { backgroundColor: isDark ? '#0A1A1A' : '#F0FDF4' }]}>
                    <View style={styles.doctorTopRow}>
                      <View style={[styles.avatar, { backgroundColor: '#DCFCE7', borderColor: '#4ADE80' }]}>
                        <Text style={[styles.avatarText, { color: '#16A34A' }]}>
                          {c.patient_name?.charAt(0)?.toUpperCase() || 'P'}
                        </Text>
                      </View>
                      <View style={styles.doctorInfo}>
                        <Text style={[styles.doctorName, isDark && styles.doctorNameDark]} numberOfLines={1}>
                          {c.patient_name}
                          {c.is_urgent && <Text style={{ color: '#EF4444' }}> · URGENT</Text>}
                        </Text>
                        <Text style={styles.requestedAt}>
                          Tooth #{c.tooth_number} · {formatDate(c.created_at)}
                        </Text>
                      </View>
                    </View>
                    {c.diagnosis ? (
                      <Text style={[styles.detailText, { paddingLeft: 2 }]} numberOfLines={2}>
                        {c.diagnosis}
                      </Text>
                    ) : null}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.approveBtn, { backgroundColor: '#16A34A' }]}
                        onPress={() => handleAcceptLabCase(c.id)}
                      >
                        <CheckCircle2 size={13} color="#FFFFFF" />
                        <Text style={styles.approveBtnText}>Accept &amp; Begin</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Case notifications (doctors) */}
            {caseNotifs.length > 0 && (
              <>
                <View style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>
                  <Text style={[styles.sectionLabelText, isDark && styles.sectionLabelTextDark]}>
                    CASE UPDATES · {caseNotifs.length}
                  </Text>
                </View>
                {caseNotifs.map((n) => (
                  <View
                    key={n.id}
                    style={[styles.caseItem, isDark && styles.caseItemDark]}
                  >
                    <View style={[styles.iconContainer, n.type === "urgent" ? styles.urgentIcon : n.type === "update" ? styles.updateIcon : styles.infoIcon]}>
                      {n.type === "urgent" ? <AlertTriangle size={16} color="#EF4444" /> : n.type === "update" ? <CheckCircle2 size={16} color="#0EA5E9" /> : <Info size={16} color="#64748B" />}
                    </View>
                    <View style={styles.caseContent}>
                      <View style={styles.itemHeader}>
                        <Text style={[styles.itemTitle, isDark && styles.itemTitleDark]} numberOfLines={1}>{n.title}</Text>
                        <Text style={styles.time}>{n.time}</Text>
                      </View>
                      <Text style={[styles.message, isDark && styles.messageDark]} numberOfLines={2}>{n.message}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Bell size={40} color={isDark ? "#334155" : "#E2E8F0"} />
            <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>All caught up!</Text>
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              {userRole === "organization"
                ? "No pending doctor approvals. New requests will appear here automatically."
                : userRole === "lab"
                ? "No pending lab requisitions. New requests will appear here in real time."
                : "No new case updates. Your realtime notification center is active."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SheetContent>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    padding: 0,
    width: "85%",
    backgroundColor: "#FFFFFF",
  },
  sheetContentDark: {
    backgroundColor: "#0F172A",
    borderLeftWidth: 1,
    borderLeftColor: "#1E293B",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    paddingLeft: 20,
    paddingRight: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerDark: { borderBottomColor: "#1E293B" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  titleDark: { color: "#FFFFFF" },
  countBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  clearAll: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  list: { flex: 1 },
  // Section labels
  sectionLabel: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sectionLabelDark: { backgroundColor: "#1E293B", borderBottomColor: "#334155" },
  sectionLabelText: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.8 },
  sectionLabelTextDark: { color: "#64748B" },
  // Doctor approval card
  doctorCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 10,
    backgroundColor: "#FFFBF5",
  },
  doctorCardDark: { backgroundColor: "#1A120A", borderBottomColor: "#2A1E0A" },
  doctorTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#D97706" },
  doctorInfo: { flex: 1, gap: 2 },
  doctorName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  doctorNameDark: { color: "#FFFFFF" },
  requestedAt: { fontSize: 11, color: "#94A3B8" },
  detailList: { gap: 4, paddingLeft: 2 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12, color: "#64748B", flex: 1 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  approveBtn: {
    flex: 1,
    height: 36,
    backgroundColor: "#0EA5E9",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  approveBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  rejectBtn: {
    flex: 1,
    height: 36,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  // Case notification item
  caseItem: {
    flexDirection: "row",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
    alignItems: "flex-start",
  },
  caseItemDark: { borderBottomColor: "#1E293B" },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoIcon: { backgroundColor: "rgba(100, 116, 139, 0.1)" },
  urgentIcon: { backgroundColor: "rgba(239, 68, 68, 0.1)" },
  updateIcon: { backgroundColor: "rgba(14, 165, 233, 0.1)" },
  caseContent: { flex: 1, gap: 2 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemTitle: { fontSize: 13, fontWeight: "600", color: "#0F172A", flex: 1 },
  itemTitleDark: { color: "#FFFFFF" },
  time: { fontSize: 10, color: "#94A3B8", marginLeft: 4 },
  message: { fontSize: 12, color: "#64748B", lineHeight: 17 },
  messageDark: { color: "#94A3B8" },
  // Empty state
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 60,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#0F172A", marginTop: 8 },
  emptyTitleDark: { color: "#FFFFFF" },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 20 },
  emptyTextDark: { color: "#94A3B8" },
});
