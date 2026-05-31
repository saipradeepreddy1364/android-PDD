import React, { useEffect } from "react";
import { View, StyleSheet, Image, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { useAppData } from "@/lib/AppDataContext";

const SplashScreen = () => {
  const navigation = useNavigation<any>();
  const { data, setData, setIsPreloaded } = useAppData();

  useEffect(() => {
    const checkAuth = async () => {
      // Prevent redirecting to login if we are on a deep link like reset-password
      const isResetPasswordRoute = Platform.OS === 'web' && typeof window !== 'undefined' && 
        (window.location.pathname.includes('reset-password') || window.location.href.includes('type=recovery') || window.location.hash.includes('access_token'));

      // Run auth check, data pre-fetch, and minimum 4s display timer all at once
      const [authResult] = await Promise.all([
        // Auth check + data prefetch
        (async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return { session: null, role: null };

          // HARD LOCK: If email is not confirmed, they MUST NOT stay logged in (unless on reset password flow)
          if (!session.user.email_confirmed_at && !isResetPasswordRoute) {
            await supabase.auth.signOut();
            return { session: null, role: null };
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const role = profile?.role || session.user.user_metadata?.role || 'doctor';

          // Pre-fetch dashboard data in the background while splash shows
          if (role === 'organization') {
            const [doctorsResult, casesResult, pendingResult] = await Promise.all([
              supabase.from('profiles').select('*').eq('org_id', session.user.id).eq('role', 'doctor').eq('status', 'approved'),
              supabase.from('cases').select('*').eq('org_id', session.user.id).order('created_at', { ascending: false }),
              supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('org_id', session.user.id).eq('role', 'doctor').eq('status', 'pending'),
            ]);

            const doctors = doctorsResult.data || [];
            const cases = casesResult.data || [];
            const pendingCount = pendingResult.count || 0;

            setData({
              profile,
              doctors,
              cases,
              pendingCount,
              recentCases: cases.slice(0, 5).map(c => ({
                ...c,
                doctor_name: doctors.find((d: any) => d.id === c.doctor_id)?.full_name || "Unknown Doctor",
              })),
              stats: {
                active: cases.filter(c => c.status === 'in-progress').length,
                lab: cases.filter(c => c.status === 'lab-sent').length,
                checkup: cases.filter(c => c.status === 'checkup').length,
                totalDoctors: new Set(cases.map(c => c.doctor_id)).size,
              },
            });
          } else {
            const { data: cases } = await supabase
              .from('cases')
              .select('*')
              .eq('doctor_id', session.user.id)
              .order('created_at', { ascending: false });

            setData({
              profile,
              cases: cases || [],
              recentCases: (cases || []).slice(0, 5),
              stats: {
                active: (cases || []).filter(c => c.status === 'in-progress').length,
                lab: (cases || []).filter(c => c.status === 'lab-sent').length,
                checkup: (cases || []).filter(c => c.status === 'checkup').length,
                totalDoctors: 0,
              },
            });
          }

          setIsPreloaded(true);
          return { session, role };
        })(),
        // Minimum 4-second display timer (skip if already loaded data)
        new Promise(resolve => setTimeout(resolve, data?.profile ? 0 : 4000)),
      ]);

      if (isResetPasswordRoute) {
        // Explicitly navigate to ResetPassword to ensure the user isn't stuck or sent to Login
        navigation.replace("ResetPassword");
        return;
      }

      // Navigate only after BOTH data is ready AND 4 seconds have passed
      if (authResult.session) {
        if (authResult.role === 'organization') {
          navigation.replace("OrgDashboard");
        } else {
          navigation.replace("Dashboard");
        }
      } else {
        navigation.replace("Login");
      }
    };

    checkAuth();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Image 
          source={{ uri: Platform.OS === 'web' ? "/favicon.png" : "https://clinlab-ai-assist.vercel.app/favicon.png" }} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
});

export default SplashScreen;
