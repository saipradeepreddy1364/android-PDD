import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Platform, Linking } from "react-native";
import { BarChart3, FlaskConical, CheckCircle2, AlertCircle, Search, ClipboardList, TrendingUp, Download, Eye, FileText } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const LabInsights = () => {
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProduction: 0,
    completed: 0,
    urgent: 0,
  });

  const fetchInsights = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      const orgId = profile?.org_id || user.id;
      if (orgId) {
        const { data: allCases, error } = await supabase
          .from('cases')
          .select('*')
          .eq('org_id', orgId)
          .in('status', ['lab-pending', 'lab-received', 'completed']);

        if (!error && allCases) {
          setCases(allCases);

          // Calculate stats
          const statsObj = {
            total: allCases.length,
            pending: allCases.filter(c => c.status === 'lab-pending').length,
            inProduction: allCases.filter(c => c.status === 'lab-received').length,
            completed: allCases.filter(c => c.status === 'completed').length,
            urgent: allCases.filter(c => c.is_urgent).length,
          };
          setStats(statsObj);
        }
      }
    } catch (err) {
      console.error("Error loading lab insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const filteredReports = cases.filter(c =>
    (c.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.doctor_name || "Doctor").toLowerCase().includes(search.toLowerCase()) ||
    (c.tooth_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'lab-pending':
        return { bg: '#FEE2E2', text: '#EF4444', label: 'Requested' };
      case 'lab-received':
        return { bg: '#FEF3C7', text: '#D97706', label: 'In Production' };
      case 'completed':
        return { bg: '#D1FAE5', text: '#059669', label: 'Completed' };
      default:
        return { bg: '#F1F5F9', text: '#64748B', label: status };
    }
  };

  return (
    <AppLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <BarChart3 size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.title}>Lab Insights & Reports</Text>
              <Text style={styles.subtitle}>Performance overview & request reports</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Stat Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                  <FlaskConical size={20} color="#4F46E5" />
                </View>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total Requests</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <AlertCircle size={20} color="#EF4444" />
                </View>
                <Text style={styles.statValue}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending Accept</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <TrendingUp size={20} color="#D97706" />
                </View>
                <Text style={styles.statValue}>{stats.inProduction}</Text>
                <Text style={styles.statLabel}>In Production</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: '#D1FAE5' }]}>
                  <CheckCircle2 size={20} color="#059669" />
                </View>
                <Text style={styles.statValue}>{stats.completed}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>

            {/* Urgent vs Normal Distribution card */}
            <View style={styles.distCard}>
              <Text style={styles.cardTitle}>Priority Distribution</Text>
              <View style={styles.progressTrack}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: `${stats.total > 0 ? (stats.urgent / stats.total) * 100 : 0}%`,
                      backgroundColor: '#EF4444' 
                    }
                  ]} 
                />
              </View>
              <View style={styles.distLabelRow}>
                <View style={styles.distLabel}>
                  <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.distText}>Urgent ({stats.urgent})</Text>
                </View>
                <View style={styles.distLabel}>
                  <View style={[styles.dot, { backgroundColor: '#E2E8F0' }]} />
                  <Text style={styles.distText}>Normal ({stats.total - stats.urgent})</Text>
                </View>
              </View>
            </View>

            {/* Reports List */}
            <View style={styles.reportsSection}>
              <View style={styles.reportsHeader}>
                <Text style={styles.sectionTitle}>Lab Work Reports Directory</Text>
                <View style={styles.searchBar}>
                  <Search size={16} color="#94A3B8" />
                  <TextInput
                    placeholder="Quick search reports..."
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCol, { flex: 2 }]}>Patient</Text>
                  <Text style={styles.tableCol}>Tooth</Text>
                  <Text style={styles.tableCol}>Status</Text>
                  <Text style={styles.tableCol}>Date</Text>
                </View>

                {filteredReports.length > 0 ? (
                  filteredReports.map((r) => {
                    const st = getStatusStyle(r.status);
                    return (
                      <View key={r.id} style={styles.tableRow}>
                        <View style={[styles.tableCol, { flex: 2 }]}>
                          <Text style={styles.patientName}>{r.patient_name}</Text>
                          <Text style={styles.drName}>Dr. {r.doctor_name || "Dentist"}</Text>
                        </View>
                        <Text style={styles.tableCol}>#{r.tooth_number}</Text>
                        <View style={styles.tableCol}>
                          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.tableCol}>
                          {new Date(r.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyTable}>
                    <Text style={styles.emptyText}>No matching report logs found</Text>
                  </View>
                )}
              </View>
            </View>
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
    backgroundColor: "#6366F1",
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
  scrollContent: {
    gap: 20,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: 8,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  distCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  distLabelRow: {
    flexDirection: "row",
    gap: 16,
  },
  distLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  distText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  reportsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 20,
    gap: 16,
  },
  reportsHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
    width: 220,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  table: {
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 16,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  tableCol: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  patientName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  drName: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  emptyTable: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  center: {
    padding: 80,
    alignItems: "center",
  },
});

export default LabInsights;
