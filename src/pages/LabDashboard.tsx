import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Platform, DeviceEventEmitter,
} from "react-native";
import {
  Search, Loader2, ClipboardList, CheckCircle2, FlaskConical,
  Calendar, ArrowRight, Trash2, X,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

// Cross-platform alert helper
const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Cross-platform confirm helper (returns boolean on web)
const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void
) => {
  if (Platform.OS === "web") {
    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Yes, Decline", style: "destructive", onPress: onConfirm },
    ]);
  }
};

// Parse the lab notes string into a structured object for clean display
const parseLabNotes = (notes: string | null) => {
  if (!notes) return null;

  // Extract the [LAB REQUESTED ...] block
  const labBlock = notes.match(/\[LAB REQUESTED[^\]]*\]([\s\S]*)/);
  if (!labBlock) {
    // If no block marker, just return the raw notes (original clinical notes)
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

  // Extract any clinical notes that were written BEFORE the [LAB REQUESTED] block
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

const LabDashboard = () => {
  const [loading, setLoading]           = useState(true);
  const [cases, setCases]               = useState<any[]>([]);
  const [search, setSearch]             = useState("");
  const [profile, setProfile]           = useState<any>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Cache auth info so we never call getUser() inside a polling interval
  const cachedAuth = useRef<{ orgId: string } | null>(null);

  const fetchLabCases = useCallback(async () => {
    try {
      // Only resolve user+profile once; reuse cached value on subsequent polls
      if (!cachedAuth.current) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        const orgId = prof?.org_id || session.user.id;
        cachedAuth.current = { orgId };
        setProfile(prof);
      }

      // JOIN with profiles to always get the actual doctor name
      const { data, error } = await supabase
        .from("cases")
        .select("*, doctor:profiles!doctor_id(full_name)")
        .eq("org_id", cachedAuth.current!.orgId)
        .in("status", ["lab-pending", "lab-received", "completed"])
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Merge joined doctor name into the row
        const enriched = data.map((c: any) => ({
          ...c,
          doctor_name: c.doctor?.full_name || c.doctor_name || null,
        }));
        setCases(enriched);
      }
    } catch (err) {
      console.error("Error fetching lab cases:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabCases();

    // 1-second polling as reliable fallback
    const pollInterval = setInterval(fetchLabCases, 1000);

    // Refresh on DeviceEventEmitter signal (from notification sidebar actions)
    const eventSub = DeviceEventEmitter.addListener("refreshLabCases", fetchLabCases);

    // Supabase Realtime subscription as instant trigger
    let channel: any;
    const setupSubscription = async () => {
      if (!cachedAuth.current) await fetchLabCases();
      if (!cachedAuth.current) return;

      channel = supabase
        .channel(`lab-cases-realtime-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cases",
            filter: `org_id=eq.${cachedAuth.current.orgId}`,
          },
          () => {
            fetchLabCases();
            DeviceEventEmitter.emit("refreshLabCount");
          }
        )
        .subscribe();
    };
    setupSubscription();

    return () => {
      clearInterval(pollInterval);
      eventSub.remove();
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchLabCases]);

  // Accept lab request (lab-pending → lab-received)
  const handleAccept = async (caseId: string) => {
    try {
      setActionLoadingId(caseId);
      const { error } = await supabase
        .from("cases")
        .update({ status: "lab-received" })
        .eq("id", caseId);
      if (error) throw error;
      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, status: "lab-received" } : c))
      );
      DeviceEventEmitter.emit("refreshLabCount");
      showAlert("Accepted", "Lab requisition accepted. Work has started.");
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark work as completed (lab-received → completed)
  const handleComplete = async (caseId: string) => {
    try {
      setActionLoadingId(caseId);
      const { error } = await supabase
        .from("cases")
        .update({ status: "completed" })
        .eq("id", caseId);
      if (error) throw error;
      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, status: "completed" } : c))
      );
      DeviceEventEmitter.emit("refreshLabCount");
      showAlert("Completed", "Lab work marked as completed.");
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline / cancel lab request — sets case back to in-progress
  const handleDecline = (caseId: string) => {
    showConfirm(
      "Decline Request",
      "Are you sure you want to decline this lab requisition? The case will be sent back to the doctor.",
      async () => {
        try {
          setActionLoadingId(caseId);
          const { error } = await supabase
            .from("cases")
            .update({ status: "in-progress" })
            .eq("id", caseId);
          if (error) throw error;
          // Remove from the list immediately
          setCases((prev) => prev.filter((c) => c.id !== caseId));
          DeviceEventEmitter.emit("refreshLabCount");
        } catch (err: any) {
          showAlert("Error", err.message);
        } finally {
          setActionLoadingId(null);
        }
      }
    );
  };


  const filteredCases = cases.filter(
    (c) =>
      (c.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.doctor_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.tooth_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "lab-pending":
        return { bg: "#FEE2E2", text: "#EF4444", border: "#FCA5A5", label: "Requested" };
      case "lab-received":
        return { bg: "#FEF3C7", text: "#D97706", border: "#FCD34D", label: "In Production" };
      case "completed":
        return { bg: "#D1FAE5", text: "#059669", border: "#6EE7B7", label: "Completed" };
      default:
        return { bg: "#F1F5F9", text: "#64748B", border: "#CBD5E1", label: status };
    }
  };

  return (
    <AppLayout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <FlaskConical size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.title}>Lab Requisitions</Text>
              <Text style={styles.subtitle}>
                {profile?.org_name || "Organization"} · Real-time monitoring
              </Text>
            </View>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            placeholder="Search by patient, doctor, tooth #..."
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <Loader2 size={32} color="#0EA5E9" />
            <Text style={styles.loadingText}>Loading requisition list...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {filteredCases.length > 0 ? (
              filteredCases.map((c) => {
                const colors = getStatusColor(c.status);
                const isUrgent = c.is_urgent;
                const labInfo = parseLabNotes(c.notes);
                const isLoading = actionLoadingId === c.id;

                return (
                  <View
                    key={c.id}
                    style={[styles.card, isUrgent && styles.cardUrgent]}
                  >
                    {/* Card Header — Patient + Status */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.patientRow}>
                          <Text style={styles.patientName}>{c.patient_name}</Text>
                          {isUrgent && (
                            <View style={styles.urgentBadge}>
                              <Text style={styles.urgentText}>⚠️ URGENT</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.doctorName}>
                          Requested by Dr.{" "}
                          {c.doctor_name || "—"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: colors.bg, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                          {colors.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Patient Details Grid */}
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Patient</Text>
                        <Text style={styles.detailValue}>{c.patient_name || "N/A"}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Tooth FDI</Text>
                        <Text style={styles.detailValue}>#{c.tooth_number || "N/A"}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Gender / Age</Text>
                        <Text style={styles.detailValue}>
                          {c.gender
                            ? c.gender.charAt(0).toUpperCase() + c.gender.slice(1)
                            : "N/A"}{" "}
                          · {c.age || "N/A"} yrs
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Indication</Text>
                        <Text style={styles.detailValue} numberOfLines={2}>
                          {c.diagnosis || "—"}
                        </Text>
                      </View>
                    </View>

                    {/* Lab Work Info (parsed from notes) */}
                    {labInfo && (
                      <View style={styles.labInfoBox}>
                        <Text style={styles.labInfoTitle}>🔬 Lab Work Details</Text>

                        {(labInfo.procedure || labInfo.subtype) && (
                          <View style={styles.labInfoRow}>
                            <Text style={styles.labInfoLabel}>Procedure</Text>
                            <Text style={styles.labInfoValue}>
                              {[labInfo.procedure, labInfo.subtype]
                                .filter(Boolean)
                                .join(" → ")}
                            </Text>
                          </View>
                        )}
                        {labInfo.material && (
                          <View style={styles.labInfoRow}>
                            <Text style={styles.labInfoLabel}>Material</Text>
                            <Text style={styles.labInfoValue}>{labInfo.material}</Text>
                          </View>
                        )}
                        {labInfo.shade && (
                          <View style={styles.labInfoRow}>
                            <Text style={styles.labInfoLabel}>Shade</Text>
                            <Text style={styles.labInfoValue}>{labInfo.shade}</Text>
                          </View>
                        )}
                        {labInfo.margin && (
                          <View style={styles.labInfoRow}>
                            <Text style={styles.labInfoLabel}>Margin</Text>
                            <Text style={styles.labInfoValue}>{labInfo.margin}</Text>
                          </View>
                        )}
                        {labInfo.instructions && (
                          <View style={styles.labInfoRow}>
                            <Text style={styles.labInfoLabel}>Instructions</Text>
                            <Text style={styles.labInfoValue}>{labInfo.instructions}</Text>
                          </View>
                        )}
                        {labInfo.rawNotes && (
                          <View style={styles.labInfoRow}>
                            <Text style={styles.labInfoLabel}>Clinical Notes</Text>
                            <Text style={styles.labInfoValue}>{labInfo.rawNotes}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Footer — Date + Action Buttons */}
                    <View style={styles.cardFooter}>
                      <View style={styles.timeRow}>
                        <Calendar size={12} color="#94A3B8" />
                        <Text style={styles.timeText}>
                          {new Date(c.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </Text>
                      </View>

                      <View style={styles.actionButtons}>
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#0EA5E9" />
                        ) : (
                          <>
                            {/* lab-pending: Decline (red X) + Accept & Begin */}
                            {c.status === "lab-pending" && (
                              <>
                                <TouchableOpacity
                                  style={[styles.btn, styles.btnDecline]}
                                  onPress={() => handleDecline(c.id)}
                                >
                                  <X size={14} color="#EF4444" />
                                  <Text style={styles.btnDeclineText}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.btn, styles.btnReceive]}
                                  onPress={() => handleAccept(c.id)}
                                >
                                  <Text style={styles.btnReceiveText}>Accept & Begin</Text>
                                  <ArrowRight size={14} color="#FFFFFF" />
                                </TouchableOpacity>
                              </>
                            )}

                            {/* lab-received: Complete Work */}
                            {c.status === "lab-received" && (
                              <TouchableOpacity
                                style={[styles.btn, styles.btnComplete]}
                                onPress={() => handleComplete(c.id)}
                              >
                                <Text style={styles.btnCompleteText}>Complete Work</Text>
                                <CheckCircle2 size={14} color="#FFFFFF" />
                              </TouchableOpacity>
                            )}

                            {/* completed: Done badge */}
                            {c.status === "completed" && (
                              <View style={styles.doneRow}>
                                <CheckCircle2 size={16} color="#059669" />
                                <Text style={styles.doneText}>Ready / Delivered</Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.empty}>
                <ClipboardList size={48} color="#94A3B8" />
                <Text style={styles.emptyText}>No requisitions found.</Text>
                <Text style={styles.emptySubText}>
                  Lab requests from doctors will appear here automatically.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container:     { padding: 20, gap: 20 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logoRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBox:       { width: 48, height: 48, borderRadius: 14, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center" },
  title:         { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  subtitle:      { fontSize: 14, color: "#64748B" },
  searchBar:     { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, paddingHorizontal: 16, height: 52, gap: 12 },
  searchInput:   { flex: 1, fontSize: 15, color: "#0F172A" },
  center:        { padding: 60, alignItems: "center", gap: 12 },
  loadingText:   { fontSize: 14, color: "#64748B" },
  list:          { gap: 16, paddingBottom: 40 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardUrgent:    { borderColor: "#EF4444", borderWidth: 1.5, backgroundColor: "#FFFDFD" },
  cardHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  patientRow:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  patientName:   { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  urgentBadge:   { backgroundColor: "#EF4444", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgentText:    { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  doctorName:    { fontSize: 13, color: "#64748B", marginTop: 2, fontWeight: "500" },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  divider:       { height: 1, backgroundColor: "#F1F5F9" },

  detailsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  detailItem:    { flex: 1, minWidth: 100, gap: 4 },
  detailLabel:   { fontSize: 11, fontWeight: "600", color: "#94A3B8", textTransform: "uppercase" },
  detailValue:   { fontSize: 13, fontWeight: "600", color: "#334155" },

  // Parsed lab work info box
  labInfoBox:    { backgroundColor: "#F0F4FF", borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: "#C7D4FF" },
  labInfoTitle:  { fontSize: 12, fontWeight: "700", color: "#4F46E5", marginBottom: 2 },
  labInfoRow:    { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  labInfoLabel:  { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", minWidth: 90 },
  labInfoValue:  { fontSize: 12, fontWeight: "600", color: "#0F172A", flex: 1 },

  cardFooter:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  timeRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  timeText:      { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  actionButtons: { flexDirection: "row", alignItems: "center", gap: 8 },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 12,
  },
  btnReceive:      { backgroundColor: "#4F46E5" },
  btnReceiveText:  { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  btnComplete:     { backgroundColor: "#059669" },
  btnCompleteText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  btnDecline:      { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  btnDeclineText:  { color: "#EF4444", fontSize: 13, fontWeight: "600" },

  doneRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  doneText: { fontSize: 13, fontWeight: "600", color: "#059669" },

  empty:        { padding: 80, alignItems: "center", gap: 8 },
  emptyText:    { fontSize: 15, color: "#94A3B8", fontWeight: "600" },
  emptySubText: { fontSize: 13, color: "#CBD5E1", textAlign: "center" },
});

export default LabDashboard;
