import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
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

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { theme, toggle } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get("window").width);
  const insets = useSafeAreaInsets();
  
  useNotifications();

  useEffect(() => {
    const onChange = ({ window }: { window: any }) => setWindowWidth(window.width);
    const subscription = Dimensions.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let authListener: any;
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigation.navigate("Login");
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile) setRole(profile.role);
    };

    checkUser();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) checkUser(); else setRole(null);
    });
    authListener = data;
    return () => authListener?.subscription.unsubscribe();
  }, [navigation]);

  const activeTabs = (!role || role === "loading") ? [] : (role === "organization" ? orgTabs : doctorTabs);
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
            <View style={[styles.roleBadge, role === "organization" ? styles.roleBadgeOrg : styles.roleBadgeDr]}>
              <Text style={styles.roleBadgeText}>{role}</Text>
            </View>
            <View style={styles.sidebarBottomRow}>
              <TouchableOpacity onPress={() => setIsNotificationsOpen(true)} style={styles.iconButton}>
                <Bell size={20} color={isDark ? "#94A3B8" : "#64748B"} />
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
            <TouchableOpacity onPress={() => setIsNotificationsOpen(true)}><Bell size={20} color={isDark ? "#FFF" : "#000"} /></TouchableOpacity>
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
  header: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
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
  roleBadgeText: { fontSize: 10, fontWeight: "700", color: "#0369A1", textTransform: "uppercase" },
  iconButton: { padding: 8 },
  sidebarBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
});

export default AppLayout;
