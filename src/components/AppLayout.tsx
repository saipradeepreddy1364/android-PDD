import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, DeviceEventEmitter } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import {
  LayoutDashboard,
  FilePlus2,
  Sparkles,
  ClipboardList,
  Users,
  Moon,
  Sun,
  Stethoscope,
  Bell,
  LogOut,
  LayoutGrid,
  FileSearch,
  BarChart3,
} from "lucide-react-native";
import { useTheme } from "./ThemeProvider";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationSidebar } from "./NotificationSidebar";

type Tab = {
  name: string;
  label: string;
  icon: any;
  primary?: boolean;
};

const doctorTabs: Tab[] = [
  { name: "Dashboard", label: "Home", icon: LayoutDashboard },
  { name: "NewCase", label: "New", icon: FilePlus2 },
  { name: "AIEngine", label: "AI", icon: Sparkles, primary: true },
  { name: "Patients", label: "Records", icon: Users },
  { name: "Insights", label: "Insights", icon: BarChart3 },
];

const orgTabs: Tab[] = [
  { name: "OrgDashboard", label: "Overview", icon: LayoutGrid },
  { name: "OrgDoctors", label: "Doctors", icon: Users },
  { name: "OrgCases", label: "Cases", icon: ClipboardList },
  { name: "OrgReports", label: "Reports", icon: FileSearch },
];

const labTabs: Tab[] = [
  { name: "LabDashboard", label: "Dashboard", icon: LayoutDashboard },
  { name: "LabInsights", label: "Insights", icon: BarChart3 },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { theme, toggle } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get("window").width);
  const insets = useSafeAreaInsets();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [orgUserId, setOrgUserId] = useState<string | null>(null);
  const [pendingLabCount, setPendingLabCount] = useState(0);
  const [labOrgId, setLabOrgId] = useState<string | null>(null);
  
  useNotifications();

  useEffect(() => {
    const onChange = ({ window }: { window: any }) => setWindowWidth(window.width);
    const subscription = Dimensions.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  const fetchPendingCount = React.useCallback(async (userId?: string) => {
    if (role !== "organization") return;
    const uid = userId || orgUserId;
    if (!uid) return;
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', uid)
      .in('role', ['doctor', 'lab'])
      .eq('status', 'pending');
    if (!error && count !== null) setPendingApprovalsCount(count);
  }, [role, orgUserId]);

  const fetchLabPendingCount = React.useCallback(async (orgId?: string) => {
    if (role !== 'lab') return;
    const oid = orgId || labOrgId;
    if (!oid) return;
    const { count, error } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', oid)
      .eq('status', 'lab-pending');
    if (!error && count !== null) setPendingLabCount(count);
  }, [role, labOrgId]);

  useFocusEffect(
    React.useCallback(() => {
      fetchPendingCount();
    }, [role])
  );

  // ── Org approvals bell ───────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "organization" || !orgUserId) {
      setPendingApprovalsCount(0);
      return;
    }
    fetchPendingCount(orgUserId);
    const pollInterval = setInterval(() => fetchPendingCount(orgUserId), 5000);
    const realtimeSub = supabase
      .channel(`app-layout-approvals-${Date.now()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'profiles'
      }, () => fetchPendingCount(orgUserId))
      .subscribe();
    const eventSub = DeviceEventEmitter.addListener('refreshPendingCount', () => fetchPendingCount(orgUserId));
    return () => {
      supabase.removeChannel(realtimeSub);
      eventSub.remove();
      clearInterval(pollInterval);
    };
  }, [role, orgUserId]);

  // ── Lab requisitions bell ────────────────────────────────────────────────
  useEffect(() => {
    if (role !== 'lab' || !labOrgId) {
      setPendingLabCount(0);
      return;
    }
    fetchLabPendingCount(labOrgId);
    const pollInterval = setInterval(() => fetchLabPendingCount(labOrgId), 5000);
    const realtimeSub = supabase
      .channel(`app-layout-lab-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cases',
        filter: `org_id=eq.${labOrgId}`,
      }, () => fetchLabPendingCount(labOrgId))
      .subscribe();
    const eventSub = DeviceEventEmitter.addListener('refreshLabCount', () => fetchLabPendingCount(labOrgId));
    return () => {
      supabase.removeChannel(realtimeSub);
      eventSub.remove();
      clearInterval(pollInterval);
    };
  }, [role, labOrgId]);

  useEffect(() => {
    let authListener: any;
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigation.navigate("Login");
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', session.user.id)
        .single();
      if (profile) {
        setRole(profile.role);
        if (profile.role === 'organization') {
          setOrgUserId(session.user.id);
        }
        if (profile.role === 'lab') {
          setLabOrgId(profile.org_id || session.user.id);
        }
      }
    };

    checkUser();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) checkUser(); else setRole(null);
    });
    authListener = data;
    return () => authListener?.subscription.unsubscribe();
  }, [navigation]);

  const activeTabs = (!role || role === "loading") 
    ? [] 
    : (role === "organization" 
      ? orgTabs 
      : (role === "lab" ? labTabs : doctorTabs));
  const isDesktop = windowWidth >= 768;
  const isDark = theme === "dark";
  const handleLogout = async () => { await supabase.auth.signOut(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); };

  const renderNav = () => (
    <>
      {activeTabs.map((tab) => {
        const isActive = route.name === tab.name;
        if (isDesktop) {
          return (
            <TouchableOpacity 
              key={tab.name} 
              onPress={() => navigation.navigate(tab.name)} 
              style={[
                styles.navItemDesktop, 
                isActive && (isDark ? styles.navItemActiveDesktopDark : styles.navItemActiveDesktop)
              ]}
            >
              <tab.icon size={20} color={isActive ? "#0EA5E9" : (isDark ? "#94A3B8" : "#64748B")} />
              <Text style={[
                styles.navTextDesktop, 
                isDark && styles.navTextDesktopDark,
                isActive && styles.navTextActiveDesktop
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        }
        if (tab.primary) return (
          <TouchableOpacity key={tab.name} onPress={() => navigation.navigate(tab.name)} style={styles.primaryTab}>
            <View style={styles.primaryTabInner}><Sparkles size={24} color="#FFFFFF" /></View>
          </TouchableOpacity>
        );
        return (
          <TouchableOpacity key={tab.name} onPress={() => navigation.navigate(tab.name)} style={styles.tabItem}>
            <tab.icon size={20} color={isActive ? "#0EA5E9" : "#94A3B8"} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {isDesktop && (
        <View style={[styles.sidebar, isDark && styles.sidebarDark]}>
          <View style={styles.sidebarTop}>
            <View style={styles.brandHeader}>
              <View style={styles.logoContainer}><Stethoscope size={20} color="#FFFFFF" /></View>
              <Text style={[styles.sidebarBrandText, isDark && styles.sidebarBrandTextDark]}>ClinLab</Text>
            </View>
            <View style={styles.navContainer}>{renderNav()}</View>
          </View>
          <View style={styles.sidebarBottom}>
            <View style={[
              styles.roleBadge, 
              role === "organization" 
                ? styles.roleBadgeOrg 
                : (role === "lab" ? styles.roleBadgeLab : styles.roleBadgeDr)
            ]}>
              <Text style={[
                styles.roleBadgeText,
                { color: role === "organization" ? "#64748B" : (role === "lab" ? "#4F46E5" : "#0369A1") }
              ]}>{role}</Text>
            </View>
            <View style={styles.sidebarBottomRow}>
              <TouchableOpacity onPress={() => setIsNotificationsOpen(true)} style={styles.iconButton}>
                <Bell size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                {role === "organization" && pendingApprovalsCount > 0 && (
                  <View style={styles.orangeDot} />
                )}
                {role === "lab" && pendingLabCount > 0 && (
                  <View style={[styles.orangeDot, { backgroundColor: '#16A34A' }]} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={toggle} style={styles.iconButton}>
                {isDark ? <Sun size={20} color="#94A3B8" /> : <Moon size={20} color="#64748B" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
                <LogOut size={20} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.main}>
        {!isDesktop && (
          <View style={[styles.header, isDark && styles.headerDark, { paddingTop: insets.top }]}>
            <Text style={styles.brandText}>ClinLab</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={toggle}>
                {isDark ? <Sun size={20} color="#FFF" /> : <Moon size={20} color="#000" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsNotificationsOpen(true)}>
                <Bell size={20} color={isDark ? "#FFF" : "#000"} />
                {role === "organization" && pendingApprovalsCount > 0 && (
                  <View style={styles.orangeDotMobileHeader} />
                )}
                {role === "lab" && pendingLabCount > 0 && (
                  <View style={[styles.orangeDotMobileHeader, { backgroundColor: '#16A34A' }]} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout}>
                <LogOut size={20} color={isDark ? "#FFF" : "#000"} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {children}
        </ScrollView>
        {!isDesktop && <View style={[styles.tabBar, isDark && styles.tabBarDark, { paddingBottom: insets.bottom || 16 }]}>{renderNav()}</View>}
      </View>
      <NotificationSidebar open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: "#F8FAFC",
    ...(Platform.OS === 'web' ? { 
      position: 'fixed' as any, 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0,
      height: '100%' as any,
      width: '100%' as any,
    } : {}),
  },
  containerDark: { backgroundColor: "#0F172A" },
  main: { flex: 1, flexDirection: 'column', height: '100%' },
  sidebar: { 
    width: 240, 
    borderRightWidth: 1, 
    borderRightColor: "#E2E8F0", 
    padding: 20, 
    justifyContent: 'space-between',
    backgroundColor: "#FFFFFF",
  },
  sidebarDark: { 
    borderRightColor: "#1E293B",
    backgroundColor: "#0F172A"
  },
  sidebarTop: { gap: 32 },
  sidebarBottom: { gap: 12 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sidebarBrandText: { fontSize: 20, fontWeight: "bold", color: "#0F172A" },
  sidebarBrandTextDark: { color: "#FFFFFF" },
  navContainer: { gap: 4 },
  navItemDesktop: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 10, 
    paddingHorizontal: 12, 
    borderRadius: 8,
  },
  navItemActiveDesktop: { backgroundColor: "#F1F5F9" },
  navItemActiveDesktopDark: { backgroundColor: "#1E293B" },
  navTextDesktop: { color: "#64748B", fontWeight: "600", fontSize: 14 },
  navTextDesktopDark: { color: "#94A3B8" },
  navTextActiveDesktop: { color: "#0EA5E9" },
  header: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: "#FFFFFF" },
  headerDark: { backgroundColor: "#0F172A" },
  content: { 
    flex: 1,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' as any } : {}),
  },
  contentInner: {
    paddingBottom: 20,
  },
  tabBar: { height: 70, flexDirection: "row", paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  tabBarDark: { backgroundColor: "#0F172A", borderTopColor: "#1E293B" },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 10, color: "#94A3B8" },
  tabLabelActive: { color: "#0EA5E9" },
  primaryTab: { flex: 1, alignItems: "center", justifyContent: "center" },
  primaryTabInner: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#0EA5E9", alignItems: "center", justifyContent: "center", marginTop: -20 },
  logoContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#0EA5E9", alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 18, fontWeight: "bold", color: "#0EA5E9" },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  roleBadgeOrg: { backgroundColor: "#F1F5F9" },
  roleBadgeDr: { backgroundColor: "#E0F2FE" },
  roleBadgeLab: { backgroundColor: "#EEF2FF" },
  roleBadgeText: { fontSize: 10, fontWeight: "700", color: "#0369A1", textTransform: "uppercase" },
  iconButton: { padding: 8 },
  sidebarBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  orangeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  orangeDotMobileHeader: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
});

export default AppLayout;
