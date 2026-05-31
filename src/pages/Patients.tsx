import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, Plus, AlertCircle, Loader2, FileText, Calendar } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const Patients = () => {
  const navigation = useNavigation<any>();
  const [cases, setCases] = useState<any[]>([]);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("doctor");

  // Store user info in refs so polling interval can access latest values
  const userRef = useRef<any>(null);
  const roleRef = useRef<string>("doctor");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);

  const fetchCases = async (isInitial = false) => {
    if (isInitial) setLoading(true);

    const guestValue = await AsyncStorage.getItem("guestMode");
    const isGuest = guestValue === "true";
    if (isGuest) {
      setCases([]);
      if (isInitial) setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      if (isInitial) setLoading(false);
      return;
    }

    // Only fetch profile/role on first load
    if (isInitial) {
      const metaRole = user.user_metadata?.role;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = profile?.role || metaRole || 'doctor';
      setRole(userRole);
      roleRef.current = userRole;
      userRef.current = user;
    }

    const currentRole = roleRef.current;
    const currentUser = userRef.current || user;

    let query = supabase.from('cases').select('*');
    if (currentRole === 'organization') {
      query = query.eq('org_id', currentUser.id);
    } else {
      query = query.eq('doctor_id', currentUser.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) setCases(data);

    // Fetch file counts
    const counts: Record<string, number> = {};
    if (data && data.length > 0) {
      await Promise.all(data.map(async (c: any) => {
        try {
          const { data: files } = await supabase.storage.from('clinical-files').list(c.id);
          if (files) {
            counts[c.patient_name] = files.filter(f => f.name !== '.emptyFolderPlaceholder').length;
          }
        } catch (err) {
          console.error(`Error counting files for case ${c.id}:`, err);
        }
      }));
    }
    setFileCounts(counts);

    if (isInitial) setLoading(false);
  };

  useEffect(() => {
    // 1. Initial load
    fetchCases(true);

    // 2. Supabase real-time subscription for instant updates
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      channelRef.current = supabase
        .channel('cases-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cases' },
          () => {
            fetchCases(false); // re-fetch silently on any change
          }
        )
        .subscribe();
    };

    setupRealtime();

    // 3. 1-second polling as fallback
    pollingRef.current = setInterval(() => {
      fetchCases(false);
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const filteredCases = cases.filter(c =>
    c.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    c.tooth_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.countText}>{filteredCases.length} cases</Text>
          {role !== "organization" && (
            <TouchableOpacity
              onPress={() => navigation.navigate("NewCase")}
              style={styles.addButton}
            >
              <Plus size={14} color="#FFFFFF" />
              <Text style={styles.addButtonText}>New</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchIcon}>
            <Search size={18} color="#94A3B8" />
          </View>
          <TextInput
            placeholder="Search patients, tooth #..."
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.list}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Loader2 size={24} color="#0EA5E9" />
              <Text style={styles.loadingText}>Loading records...</Text>
            </View>
          ) : filteredCases.length > 0 ? (
            filteredCases.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => navigation.navigate("PatientDetail", { id: p.id })}
                style={styles.caseCard}
              >
                <View style={[styles.avatar, styles.avatarNormal]}>
                  <Text style={[styles.avatarText, styles.avatarTextNormal]}>
                    {p.patient_name ? p.patient_name.charAt(0) : "P"}
                  </Text>
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.patientName}>{p.patient_name}</Text>
                  </View>
                  <View style={styles.dateRow}>
                    <Calendar size={10} color="#94A3B8" />
                    <Text style={styles.dateText}>
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}
                      {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={styles.caseSubtext}>Tooth {p.tooth_number} · {p.diagnosis}</Text>
                    <View style={styles.fileCountBadge}>
                      <FileText size={11} color={fileCounts[p.patient_name] > 0 ? "#0EA5E9" : "#94A3B8"} />
                      <Text style={[styles.fileCountText, fileCounts[p.patient_name] > 0 && styles.fileCountTextActive]}>
                        {fileCounts[p.patient_name] || 0} {fileCounts[p.patient_name] === 1 ? "report" : "reports"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>
                    {p.status.replace('-', ' ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No records found.</Text>
              <TouchableOpacity onPress={() => navigation.navigate("NewCase")}>
                <Text style={styles.emptyLink}>Create a new case</Text>
              </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countText: {
    fontSize: 14,
    color: "#64748B",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    gap: 6,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  list: {
    gap: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarNormal: {
    backgroundColor: "rgba(14, 165, 233, 0.05)",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  avatarTextNormal: {
    color: "#0EA5E9",
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  patientName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  caseSubtext: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  dateText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusText: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "capitalize",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "rgba(248, 250, 252, 0.5)",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
  },
  emptyLink: {
    fontSize: 14,
    color: "#0EA5E9",
    fontWeight: "600",
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  fileCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  fileCountText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
  },
  fileCountTextActive: {
    color: "#0EA5E9",
  },
});

export default Patients;