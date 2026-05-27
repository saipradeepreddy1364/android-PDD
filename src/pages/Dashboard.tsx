import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppData } from "@/lib/AppDataContext";
import {
  FilePlus2,
  ClipboardList,
  Sparkles,
  Users,
  Activity,
  AlertCircle,
  ChevronRight,
  Upload,
  Check,
  Stethoscope,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const Dashboard = () => {
  const navigation = useNavigation<any>();
  const { data: preloadedData, isPreloaded } = useAppData();
  const [userName, setUserName] = useState("Doctor");
  const [orgName, setOrgName] = useState("");
  const [greeting, setGreeting] = useState("Good morning");
  const [stats, setStats] = useState(preloadedData.stats);
  const [recentCases, setRecentCases] = useState<any[]>(preloadedData.recentCases);
  const [loading, setLoading] = useState(!isPreloaded);
  const [role, setRole] = useState<"doctor" | "organization" | "loading">(preloadedData.profile?.role || "loading");
  const [pendingCount, setPendingCount] = useState(preloadedData.pendingCount);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    if (isPreloaded && preloadedData.profile) {
      const userRole = preloadedData.profile.role || 'doctor';
      setRole(userRole);
      setUserName(preloadedData.profile.full_name || "Doctor");
      setOrgName(preloadedData.profile.org_name || "");
      setStats(preloadedData.stats);
      setRecentCases(preloadedData.recentCases.slice(0, 3).map(c => ({
        id: c.id,
        name: c.patient_name,
        tooth: c.tooth_number,
        dx: c.diagnosis,
        urgent: c.is_urgent,
      })));
      setLoading(false);

      if (userRole === 'organization') {
        navigation.replace("OrgDashboard");
      }
      return;
    }

    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (user) {
        setUserName(user.user_metadata?.full_name || "Doctor");
        const metaRole = user.user_metadata?.role;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, id, full_name, org_name')
          .eq('id', user.id)
          .single();

        const userRole = profile?.role || metaRole || 'doctor';
        setRole(userRole);
        setUserName(profile?.full_name || user.user_metadata?.full_name || "Doctor");
        setOrgName(profile?.org_name || user.user_metadata?.org_name || "");

        if (profile && (!profile.full_name || profile.full_name === "Doctor" || profile.full_name === "New User" || !profile.org_name)) {
          const metadata = user.user_metadata;
          const recoveredName = profile.full_name && !["Doctor", "New User", "Dr. User"].includes(profile.full_name) ? profile.full_name : (metadata?.full_name || metadata?.name);
          const recoveredOrg = profile.org_name || metadata?.org_name || metadata?.organization_name || metadata?.org_id;

          if (recoveredName || recoveredOrg) {
            await supabase.from('profiles').update({
              full_name: recoveredName || profile.full_name,
              org_name: recoveredOrg || profile.org_name
            }).eq('id', user.id);
            setUserName(recoveredName || userName);
            setOrgName(recoveredOrg || orgName);
          }
        }

        if (userRole === 'organization') {
          navigation.replace("OrgDashboard");
          return;
        }

        const { data: cases } = await supabase
          .from('cases')
          .select('*')
          .eq('doctor_id', user.id)
          .order('created_at', { ascending: false });

        if (cases) {
          setRecentCases(cases.slice(0, 3).map(c => ({
            id: c.id,
            name: c.patient_name,
            tooth: c.tooth_number,
            dx: c.diagnosis,
            urgent: c.is_urgent,
          })));
          setStats({
            active: cases.filter(c => c.status === 'in-progress').length,
            lab: cases.filter(c => c.status === 'lab-pending' || c.status === 'lab-received').length,
            checkup: cases.filter(c => c.status === 'checkup-pending').length,
            totalDoctors: 0,
          });
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [isPreloaded]);

  if (loading) {
    return (
      <AppLayout>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View style={styles.container}>
        {/* Hero greeting */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <View style={styles.todayBadge}>
              <Activity size={10} color="#FFFFFF" />
              <Text style={styles.todayText}>Today</Text>
            </View>
            <Text style={styles.greetingText}>
              {greeting}, Dr. {userName}
            </Text>
            <Text style={styles.statsSummary}>
              {stats.active} new cases · {stats.lab} lab requests pending
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                onPress={() => navigation.navigate("AIEngine")}
                style={styles.heroButton}
              >
                <Sparkles size={14} color="#FFFFFF" />
                <Text style={styles.heroButtonText}>AI Clinical Guide</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Stats */}
          <View style={styles.statsGrid}>
            {[
              { label: "New", value: stats.active, color: "#0EA5E9", icon: Activity },
              { label: "Lab", value: stats.lab, color: "#8B5CF6", icon: ClipboardList },
              { label: "Checkup", value: stats.checkup, color: "#10B981", icon: Stethoscope },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <s.icon size={16} color={s.color} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent cases */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent cases</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Patients")}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.casesCard}>
              {recentCases.length > 0 ? (
                recentCases.map((c, i) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => navigation.navigate("Patients", { screen: "PatientDetail", params: { id: c.id } })}
                    style={[styles.caseItem, i === recentCases.length - 1 && styles.noBorder]}
                  >
                    <View style={[styles.patientAvatar, { backgroundColor: c.urgent ? "#EF444415" : "#0EA5E915" }]}>
                      <Text style={[styles.avatarText, { color: c.urgent ? "#EF4444" : "#0EA5E9" }]}>
                        {c.name ? c.name.charAt(0) : "P"}
                      </Text>
                    </View>
                    <View style={styles.caseInfo}>
                      <Text style={styles.patientName}>{c.name}</Text>
                      <Text style={styles.caseSubtext}>
                        Tooth {c.tooth} · {c.dx}
                      </Text>
                      {c.doctor && (
                        <Text style={styles.doctorName}>By {c.doctor}</Text>
                      )}
                    </View>
                    {c.urgent ? (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>Urgent</Text>
                      </View>
                    ) : (
                      <ChevronRight size={16} color="#94A3B8" />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No recent cases found.</Text>
                  <TouchableOpacity onPress={() => navigation.navigate("NewCase")}>
                    <Text style={styles.emptyLink}>Create your first case</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 24,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: "#0EA5E9",
    padding: 20,
    overflow: "hidden",
  },
  heroContent: {
    zIndex: 10,
  },
  todayBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 8,
    gap: 4,
  },
  todayText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  greetingText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  statsSummary: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    marginTop: 4,
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  heroButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    height: 36,
    borderRadius: 12,
    gap: 6,
  },
  heroButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  mainContent: {
    gap: 24,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0EA5E9",
  },
  casesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
    overflow: "hidden",
  },
  caseItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.6)",
    gap: 12,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  caseInfo: {
    flex: 1,
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
  doctorName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0EA5E9",
    marginTop: 2,
    textTransform: "uppercase",
  },
  urgentBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  urgentBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
  },
  emptyLink: {
    fontSize: 13,
    color: "#0EA5E9",
    marginTop: 4,
    fontWeight: "500",
  },
  approvalAlert: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FEF3C7",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  alertBody: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
  },
  alertText: {
    fontSize: 12,
    color: "#B45309",
  },
});

export default Dashboard;