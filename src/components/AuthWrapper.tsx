import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Platform } from "react-native";

const APP_LOGO = require("../assets/logo.png");
import { supabase } from "@/lib/supabase";
import { Clock, AlertCircle, LogOut, CheckCircle } from "lucide-react-native";

export const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showRejectedPopup, setShowRejectedPopup] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Capture the URL synchronously BEFORE Supabase has a chance to strip the hash
      const isRecovery = Platform.OS === 'web' && typeof window !== 'undefined' && 
        (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery') || window.location.pathname.includes('reset-password') || window.location.hash.includes('access_token'));

      const { data: { session } } = await supabase.auth.getSession();
      
      setSession(session);

      if (session?.user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          if (profile.status === 'blocked' || profile.status === 'rejected') {
            // Force logout for blocked or rejected users
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            return;
          }
          if (prevStatusRef.current === 'pending' && profile.status === 'approved') {
            setShowSuccessPopup(true);
          }
          prevStatusRef.current = profile.status;
          setProfile(profile);
        } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows') || error.message?.includes('JSON object requested'))) {
          // Profile was deleted/not found, but auth session remains. Force logout.
          if (prevStatusRef.current === 'pending') {
            setShowRejectedPopup(true);
          }
          prevStatusRef.current = null;
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
        } else {
          // This is a network error, database connection issue, or other temporary issue.
          // DO NOT force logout, just log it.
          console.log("Profile fetch failed (possibly network/connectivity issue):", error);
        }
      }
      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setProfile(null);
        prevStatusRef.current = null;
      } else {
        checkAuth();
      }
    });

    // Polling for profile updates (approval or rejection) since realtime might be off
    let pollInterval: ReturnType<typeof setInterval>;
    if (session?.user && profile?.status === 'pending') {
      pollInterval = setInterval(() => {
        checkAuth();
      }, 1000); // Check every 1 second while pending
    }

    return () => {
      authListener.subscription.unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [session?.user?.id, profile?.status]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // If user is already deleted from auth, signOut might throw an error. Force clear session.
      console.log("Forced clear due to signout error");
    } finally {
      setSession(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    if (showSuccessPopup) {
      const timer = setTimeout(() => setShowSuccessPopup(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showSuccessPopup]);

  useEffect(() => {
    if (showRejectedPopup) {
      const timer = setTimeout(() => setShowRejectedPopup(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showRejectedPopup]);

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoWrapper}>
          <Image 
            source={APP_LOGO}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator size="small" color="#0EA5E9" style={styles.loader} />
        <Text style={styles.tagline}>AI Dental Clinical Assistant</Text>
      </View>
    );
  }

  if (showSuccessPopup) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: "#D1FAE5" }]}>
            <CheckCircle size={32} color="#10B981" />
          </View>
          <Text style={[styles.title, { color: "#065F46" }]}>Approval Successful!</Text>
          <Text style={styles.message}>
            The organization has approved your application. You now have full clinical access.
          </Text>
          
          <View style={{ marginTop: 24, alignItems: "center" }}>
            <ActivityIndicator color="#10B981" />
            <Text style={{ marginTop: 8, color: "#10B981", fontWeight: "600" }}>Taking you to dashboard...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (showRejectedPopup) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: "#FEE2E2" }]}>
            <AlertCircle size={32} color="#EF4444" />
          </View>
          <Text style={[styles.title, { color: "#B91C1C" }]}>Access Rejected</Text>
          <Text style={styles.message}>
            Your request to join the organization was rejected. Your application has been removed.
            If you believe this is an error, please contact your clinic manager.
          </Text>
          
          <View style={{ marginTop: 24, alignItems: "center" }}>
            <ActivityIndicator color="#EF4444" />
            <Text style={{ marginTop: 8, color: "#EF4444", fontWeight: "600" }}>Signing out...</Text>
          </View>
        </View>
      </View>
    );
  }

  // If not logged in, just show children (Login/Signup pages)
  if (!session) return <>{children}</>;

  // If doctor or lab and pending approval
  if ((profile?.role === 'doctor' || profile?.role === 'lab') && profile?.status === 'pending') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Clock size={32} color="#0EA5E9" />
          </View>
          <Text style={styles.title}>Approval Pending</Text>
          <Text style={styles.message}>
            Your account has been created for <Text style={styles.bold}>{profile.org_name || "your organization"}</Text>. 
            Please wait for an administrator to verify and approve your clinical access.
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Status: Pending Verification</Text>
          </View>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={16} color="#64748B" />
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Old 'rejected' card removed because we handle it above via state

  return <>{children}</>;
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  logoWrapper: {
    width: 280,
    height: 280,
    marginBottom: 20,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  logo: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  loader: {
    marginVertical: 20,
  },
  tagline: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  message: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
  },
  bold: {
    fontWeight: "600",
    color: "#0F172A",
  },
  statusBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    padding: 12,
  },
  logoutText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  }
});
