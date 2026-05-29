import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, Alert } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAppData } from "@/lib/AppDataContext";
import {
  Activity,
  ClipboardList,
  Stethoscope,
  Users,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileText,
  UserCheck,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const { width } = Dimensions.get("window");

const showAlert = (title: string, message: string, actions?: any[]) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
    if (actions && actions[0] && actions[0].onPress) {
      actions[0].onPress();
    }
  } else {
    Alert.alert(title, message, actions);
  }
};

const OrgDashboard = () => {
  const navigation = useNavigation<any>();
  const { data: preloadedData, isPreloaded } = useAppData();
  const [loading, setLoading] = useState(!isPreloaded);
  const [stats, setStats] = useState(preloadedData.stats);
  const [doctors, setDoctors] = useState<any[]>(preloadedData.doctors);
  const [recentCases, setRecentCases] = useState<any[]>(preloadedData.recentCases);
  const [profile, setProfile] = useState<any>(preloadedData.profile);
  const [pendingCount, setPendingCount] = useState(preloadedData.pendingCount);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Fetch Doctors in Org FIRST so we can map them
      const { data: profileList } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', user.id)
        .eq('role', 'doctor')
        .eq('status', 'approved');
      
      if (profileList) {
        setDoctors(profileList);
      }

      // 1. Fetch Stats
      const { data: cases, error: caseError } = await supabase
        .from('cases')
        .select('*')
        .eq('org_id', user.id);

      if (!caseError && cases) {
        setStats({
          active: cases.filter(c => c.status === 'in-progress').length,
          lab: cases.filter(c => c.status === 'lab-pending' || c.status === 'lab-received').length,
          checkup: cases.filter(c => c.status === 'checkup-pending').length,
          totalDoctors: new Set(cases.map(c => c.doctor_id)).size,
        });
        
        // Map doctor names to recent cases
        const mappedRecentCases = cases.slice(0, 5).map(c => {
          const doctorName = profileList?.find(d => d.id === c.doctor_id)?.full_name || "Unknown Doctor";
          return { ...c, doctor_name: doctorName };
        });
        setRecentCases(mappedRecentCases);
      }



      // 3. Fetch Org Profile
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (p) {
        setProfile(p);
        
        // Self-Correction: If name is missing or placeholder, try to restore from metadata
        if (!p.full_name || p.full_name === "New User" || !p.org_name) {
          const metadata = user.user_metadata;
          const recoveredName = p.full_name && p.full_name !== "New User" ? p.full_name : (metadata?.full_name || metadata?.name);
          const recoveredOrg = p.org_name || metadata?.org_name || metadata?.organization_name || recoveredName;
          
          if (recoveredName || recoveredOrg) {
            await supabase.from('profiles').update({
              full_name: recoveredName || p.full_name,
              org_name: recoveredOrg || p.org_name
            }).eq('id', user.id);
            // Refresh local state
            setProfile({ ...p, full_name: recoveredName || p.full_name, org_name: recoveredOrg || p.org_name });
          }
        }
      }

      // 4. Check for Pending Approvals
      console.log("OrgDashboard: Checking pending approvals for Org ID:", user.id);
      const { count, error: pendingError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', user.id)
        .eq('role', 'doctor')
        .eq('status', 'pending');
      
      if (pendingError) console.error("OrgDashboard: Pending Query Error:", pendingError);
      console.log("OrgDashboard: Found pending doctors:", count);
      
      setPendingCount(count || 0);
    } catch (err) {
      console.error("OrgDashboard Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const scanAllDoctors = async () => {
    const { data, count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('role', 'doctor');
    
    if (error) {
      showAlert("Scan Error", error.message);
    } else {
      showAlert("Deep Scan Result", `Found ${count} total doctors in the database. (If this is 0, signup is failing. If this is more than 0 but your dashboard shows 0, it's an RLS policy issue!)`);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    // Add polling since Supabase replication might not be enabled
    const pollInterval = setInterval(() => {
      fetchData();
    }, 1000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchData]);


  if (loading) {
    return (
      <AppLayout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View style={styles.container}>
        {/* Welcome Card (Personalized) */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeInfo}>
            <Text style={styles.welcomeGreeting}>Welcome back,</Text>
            <Text 
              style={styles.welcomeName}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.5}
            >
              {profile?.full_name || profile?.org_name || "Organization"}
            </Text>
            <View style={styles.verifiedBadge}>
              <UserCheck size={12} color="#10B981" />
              <Text style={styles.verifiedText}>Verified Clinical Hub</Text>
            </View>
          </View>
          <View style={styles.welcomeIconBox}>
            <Stethoscope size={32} color="#FFFFFF" />
          </View>
        </View>

        {pendingCount > 0 && (
          <TouchableOpacity 
            style={styles.approvalAlert}
            onPress={() => navigation.navigate("ApprovalCenter")}
          >
            <View style={styles.alertIconBox}>
              <UserCheck size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Pending Clinical Approvals</Text>
              <Text style={styles.alertSubtitle}>
                You have {pendingCount} new {pendingCount === 1 ? 'request' : 'requests'} waiting for your approval.
              </Text>
            </View>
            <ChevronRight size={16} color="#0EA5E9" />
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Clinical Overview</Text>
          <Text style={styles.subtext}>Monitor activity across all {doctors.length} departments.</Text>
        </View>
        

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: "#0EA5E9" }]}
            onPress={() => navigation.navigate("OrgCases")}
          >
            <Activity size={20} color="#0EA5E9" />
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active Cases</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: "#8B5CF6" }]}
            onPress={() => navigation.navigate("OrgCases")}
          >
            <ClipboardList size={20} color="#8B5CF6" />
            <Text style={styles.statValue}>{stats.lab}</Text>
            <Text style={styles.statLabel}>Lab Requests</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statCard, { borderLeftColor: "#10B981" }]}
            onPress={() => navigation.navigate("OrgCases")}
          >
            <Stethoscope size={20} color="#10B981" />
            <Text style={styles.statValue}>{stats.checkup}</Text>
            <Text style={styles.statLabel}>Checkups</Text>
          </TouchableOpacity>
        </View>



        {/* Clinical Staff Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Clinical Staff</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{doctors.length}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("OrgDoctors")}>
              <Text style={styles.seeAll}>Manage Staff</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.doctorScroll}
          >
            {doctors.map((dr) => (
              <TouchableOpacity 
                key={dr.id} 
                style={styles.drCard}
                onPress={() => navigation.navigate("OrgDoctors")}
              >
                <View style={styles.drAvatar}>
                  <Text style={styles.drAvatarText}>{dr.full_name?.charAt(0)}</Text>
                </View>
                <Text style={styles.drName} numberOfLines={1}>{dr.full_name}</Text>
                <Text style={styles.drSpecialty}>Doctor</Text>
                <View style={styles.drStatus}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </TouchableOpacity>
            ))}
            {doctors.length === 0 && (
              <View style={styles.emptyDr}>
                <Text style={styles.emptyText}>No approved doctors found.</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Recent Organization Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Cases</Text>
            <TouchableOpacity onPress={() => navigation.navigate("OrgCases")}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.activityList}>
            {recentCases.map((c, i) => (
              <TouchableOpacity 
                key={c.id} 
                style={[styles.activityItem, i === recentCases.length - 1 && styles.noBorder]}
                onPress={() => navigation.navigate("Patients", { screen: "PatientDetail", params: { id: c.id } })}
              >
                <View style={[styles.activityIcon, { backgroundColor: c.is_urgent ? "#FEF2F2" : "#F0F9FF" }]}>
                  {c.is_urgent ? <AlertCircle size={16} color="#EF4444" /> : <FileText size={16} color="#0EA5E9" />}
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{c.patient_name}</Text>
                  <Text style={styles.activityDesc}>By {c.doctor_name || "Doctor"}</Text>
                </View>
                <View style={styles.activityMeta}>
                  <Text style={styles.activityTime}>{new Date(c.created_at).toLocaleDateString()}</Text>
                  <ChevronRight size={14} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            ))}
            {recentCases.length === 0 && (
              <View style={styles.emptyActivity}>
                <Text style={styles.emptyText}>No recent activity found.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Analytics Card */}
        <TouchableOpacity style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <TrendingUp size={24} color="#FFFFFF" />
            <Text style={styles.analyticsTitle}>Real-time Insights</Text>
          </View>
          <Text style={styles.analyticsText}>
            You have <Text style={{fontWeight: '700', color: '#FFFFFF'}}>{stats.active} active cases</Text> being handled by <Text style={{fontWeight: '700', color: '#FFFFFF'}}>{doctors.length} staff members</Text>. 
            {stats.lab > 0 ? ` There are ${stats.lab} pending lab results to review.` : " All lab results are up to date."}
          </Text>
          <TouchableOpacity 
            style={styles.analyticsButton}
            onPress={() => navigation.navigate("OrgReports")}
          >
            <Text style={styles.analyticsButtonText}>Detailed Reports</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 24,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    gap: 2,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtext: {
    fontSize: 13,
    color: "#64748B",
  },
  welcomeCard: {
    backgroundColor: "#0EA5E9",
    borderRadius: 28,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeInfo: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
  },
  welcomeName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginVertical: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  welcomeIconBox: {
    width: 64,
    height: 64,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderLeftWidth: 4,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0EA5E9",
  },
  badge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  doctorScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  drCard: {
    width: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  drAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#0EA5E915",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  drAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0EA5E9",
  },
  drName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  drSpecialty: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  drStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "500",
  },
  activityList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  activityDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activityTime: {
    fontSize: 11,
    color: "#94A3B8",
  },
  analyticsCard: {
    backgroundColor: "#0F172A",
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  analyticsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  analyticsText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 20,
  },
  analyticsButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 4,
  },
  analyticsButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyDr: {
    width: width - 40,
    padding: 20,
    alignItems: "center",
  },
  emptyActivity: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
  },
  approvalAlert: {
    backgroundColor: "#F0F9FF",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  alertIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  alertSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
});

export default OrgDashboard;
