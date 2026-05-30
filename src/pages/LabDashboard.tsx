import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform, DeviceEventEmitter } from "react-native";
import { Search, Loader2, ClipboardList, CheckCircle2, FlaskConical, Calendar, ArrowRight } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const LabDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<any>(null);
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
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const orgId = prof?.org_id || session.user.id;
        cachedAuth.current = { orgId };
        setProfile(prof);
      }

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('org_id', cachedAuth.current.orgId)
        .in('status', ['lab-pending', 'lab-received', 'completed'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCases(data);
      }
    } catch (err) {
      console.error("Error fetching lab cases:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabCases();

    // Realtime channel handles instant updates; 1-second poll is the reliable fallback.
    // caching ensures we only fetch auth once, so 1-second polling is safe.
    const pollInterval = setInterval(() => {
      fetchLabCases();
    }, 1000);

    // Also refresh on DeviceEventEmitter signal (from notification sidebar actions)
    const eventSub = DeviceEventEmitter.addListener('refreshLabCases', fetchLabCases);

    // Also set up Supabase Realtime subscription as an additional trigger
    let channel: any;

    const setupSubscription = async () => {
      // Reuse cached auth if available, otherwise resolve once
      if (!cachedAuth.current) {
        await fetchLabCases();
      }
      if (!cachedAuth.current) return;

      channel = supabase
        .channel(`lab-cases-realtime-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cases',
            filter: `org_id=eq.${cachedAuth.current.orgId}`,
          },
          () => {
            fetchLabCases();
            // Notify AppLayout bell badge to refresh
            DeviceEventEmitter.emit('refreshLabCount');
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

  const handleUpdateStatus = async (caseId: string, nextStatus: string) => {
    try {
      setActionLoadingId(caseId);
      const { error } = await supabase
        .from('cases')
        .update({ status: nextStatus })
        .eq('id', caseId);

      if (error) throw error;
      
      // Optimistic updates
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: nextStatus } : c));
      Alert.alert("Success", `Case marked as ${nextStatus.replace('-', ' ')}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredCases = cases.filter(c =>
    (c.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.doctor_name || "Doctor").toLowerCase().includes(search.toLowerCase()) ||
    (c.tooth_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'lab-pending':
        return { bg: '#FEE2E2', text: '#EF4444', border: '#FCA5A5', label: 'Requested' };
      case 'lab-received':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D', label: 'In Production' };
      case 'completed':
        return { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7', label: 'Completed' };
      default:
        return { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1', label: status };
    }
  };

  return (
    <AppLayout>
      <View style={styles.container}>
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
            <Loader2 size={32} color="#0EA5E9" style={styles.spinner} />
            <Text style={styles.loadingText}>Loading requisition list...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {filteredCases.length > 0 ? (
              filteredCases.map((c) => {
                const colors = getStatusColor(c.status);
                const isUrgent = c.is_urgent;

                return (
                  <View key={c.id} style={[styles.card, isUrgent && styles.cardUrgent]}>
                    <View style={styles.cardHeader}>
                      <View>
                        <View style={styles.patientRow}>
                          <Text style={styles.patientName}>{c.patient_name}</Text>
                          {isUrgent && (
                            <View style={styles.urgentBadge}>
                              <Text style={styles.urgentText}>⚠️ URGENT</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.doctorName}>
                          Requested by Dr. {c.doctor_name || "Dentist"}
                        </Text>
                      </View>
                      
                      <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                          {colors.label}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Tooth FDI</Text>
                        <Text style={styles.detailValue}>#{c.tooth_number || "N/A"}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Gender / Age</Text>
                        <Text style={styles.detailValue}>
                          {c.gender ? c.gender.charAt(0).toUpperCase() + c.gender.slice(1) : "N/A"} · {c.age || "N/A"} yrs
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Indication</Text>
                        <Text style={styles.detailValue} numberOfLines={2}>
                          {c.diagnosis || "No complaint recorded"}
                        </Text>
                      </View>
                    </View>

                    {c.notes && (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesTitle}>Clinical Notes & Work Info</Text>
                        <Text style={styles.notesContent} numberOfLines={3}>{c.notes}</Text>
                      </View>
                    )}

                    <View style={styles.cardFooter}>
                      <View style={styles.timeRow}>
                        <Calendar size={12} color="#94A3B8" />
                        <Text style={styles.timeText}>
                          {new Date(c.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>

                      <View style={styles.actionButtons}>
                        {actionLoadingId === c.id ? (
                          <ActivityIndicator size="small" color="#0EA5E9" />
                        ) : (
                          <>
                            {c.status === 'lab-pending' && (
                              <TouchableOpacity
                                style={[styles.btn, styles.btnReceive]}
                                onPress={() => handleUpdateStatus(c.id, 'lab-received')}
                              >
                                <Text style={styles.btnReceiveText}>Accept & Begin</Text>
                                <ArrowRight size={14} color="#FFFFFF" />
                              </TouchableOpacity>
                            )}

                            {c.status === 'lab-received' && (
                              <TouchableOpacity
                                style={[styles.btn, styles.btnComplete]}
                                onPress={() => handleUpdateStatus(c.id, 'completed')}
                              >
                                <Text style={styles.btnCompleteText}>Complete Work</Text>
                                <CheckCircle2 size={14} color="#FFFFFF" />
                              </TouchableOpacity>
                            )}

                            {c.status === 'completed' && (
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
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
  },
  center: {
    padding: 60,
    alignItems: "center",
    gap: 12,
  },
  spinner: {
    // animate
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  list: {
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  cardUrgent: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
    backgroundColor: "#FFFDFD",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  patientName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  urgentBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  doctorName: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  detailItem: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  notesBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  notesContent: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 12,
  },
  btnReceive: {
    backgroundColor: "#4F46E5",
  },
  btnReceiveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  btnComplete: {
    backgroundColor: "#059669",
  },
  btnCompleteText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doneText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  empty: {
    padding: 80,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#94A3B8",
    fontWeight: "500",
  },
});

export default LabDashboard;
