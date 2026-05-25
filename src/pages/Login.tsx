import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, Dimensions, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Stethoscope, Loader2, Eye, EyeOff } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

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

const Login = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // HARD LOCK: If email is not confirmed, they MUST NOT stay logged in
        if (!session.user.email_confirmed_at) {
          await supabase.auth.signOut();
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.role === 'organization') {
          navigation.navigate("OrgDashboard");
        } else {
          navigation.navigate("Dashboard");
        }
      }
    });
  }, [navigation]);

  const handleLogin = async () => {
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
        showAlert("Invalid Email", "Please enter a valid email address.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        // Any error that isn't specifically about unconfirmed email is likely a credential issue
        if (!error.message.toLowerCase().includes("email not confirmed")) {
          // Reliable existence check via profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('email', trimmedEmail)
            .maybeSingle();

          if (profile) {
            if (profile.role === 'doctor') {
              showAlert("Doctor Account Detected", "This email is registered as a Doctor. Please use the 'I am a Doctor' portal.");
            } else {
              showAlert("Login Failed", "Incorrect email or password. Please try again.");
            }
          } else {
            showAlert("Account Not Found", "This email is not registered. Please register to get access.");
          }
        } else {
          // Trigger OTP flow directly from Login
          setLoading(true);
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: trimmedEmail,
          });
          setLoading(false);
          
          if (!resendError) {
            setShowVerifyModal(true);
          } else {
            showAlert("Verification Error", resendError.message);
          }
        }
        return;
      }
      
      if (data.session) {
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        // Self-Healing: Sync email or create missing profile (fixes older accounts or failed upserts)
        if (!profile) {
          const metadata = data.session.user.user_metadata;
          await supabase.from('profiles').upsert({
            id: data.session.user.id,
            full_name: metadata?.full_name || metadata?.name || "User",
            email: trimmedEmail,
            phone: metadata?.phone || "",
            role: metadata?.role || "organization",
            status: metadata?.role === "organization" ? "approved" : "pending",
            org_id: metadata?.org_id || null,
            org_name: metadata?.org_name || null,
          });
          
          const { data: newProfile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
          profile = newProfile;
        } else if (!profile.email) {
          await supabase.from('profiles').update({ email: trimmedEmail }).eq('id', data.session.user.id);
        }

        if (profile?.role === 'doctor') {
          await supabase.auth.signOut();
          showAlert("Doctor Account Detected", "This portal is for Organizations only. Doctors must sign in using the 'I am a Doctor' portal.");
          return;
        }

        if (profile?.role === 'organization' && !data.session.user.email_confirmed_at) {
          showAlert("Email Verification Required", "Please create your account again and verify your email to sign in.");
          await supabase.auth.signOut();
          return;
        }

        navigation.replace("OrgDashboard");
      }
    } catch (error: any) {
      showAlert("Login Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      showAlert("Invalid OTP", "Please enter the 6-digit verification code.");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp,
        type: 'signup',
      });

      if (error) throw error;

      if (data.session) {
        // Check if profile exists, if not create from metadata
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (!profile) {
          const metadata = data.session.user.user_metadata;
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.session.user.id,
              full_name: metadata?.full_name || metadata?.name || "New User",
              phone: metadata?.phone || "",
              role: metadata?.role || "organization",
              status: metadata?.role === "organization" ? "approved" : "pending",
              specialization: metadata?.specialization || null,
              org_id: metadata?.org_id || null,
              org_name: metadata?.org_name || metadata?.organization_name || null,
            });

          if (profileError) throw profileError;
        }

        setShowVerifyModal(false);
        const role = profile?.role || data.session.user.user_metadata?.role || "organization";
        navigation.replace(role === "organization" ? "OrgDashboard" : "Dashboard");
      }
    } catch (error: any) {
      showAlert("Verification Failed", error.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.formContainer}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Stethoscope size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.logoText}>ClinLab</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Organization Portal</Text>
            <Text style={styles.subtitle}>Sign in to manage your clinic and view reports.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Org Email</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@cityclinic.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
                  <Text style={styles.forgotText}>Forgot?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity 
                  style={styles.eyeIcon} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#94A3B8" />
                  ) : (
                    <Eye size={20} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={18} color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign in as Org</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.doctorLoginButton} 
              onPress={() => navigation.navigate("DoctorLogin")}
            >
              <Stethoscope size={18} color="#0EA5E9" />
              <Text style={styles.doctorLoginButtonText}>I am a Doctor</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New here? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
              <Text style={styles.linkText}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={showVerifyModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalIconBox}>
                <Stethoscope size={32} color="#0EA5E9" />
              </View>

              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <Text style={styles.modalSubtitle}>
                We've sent a 6-digit code to{"\n"}
                <Text style={styles.boldEmail}>{email.trim()}</Text>
              </Text>

              <TextInput
                style={styles.otpInput}
                placeholder="000000"
                maxLength={6}
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                placeholderTextColor="#94A3B8"
              />
              
              <TouchableOpacity 
                style={[styles.modalButton, verifying && styles.buttonDisabled]} 
                onPress={handleVerifyOtp}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setShowVerifyModal(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 40,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#0F172A",
  },
  eyeIcon: {
    padding: 4,
  },
  forgotText: {
    fontSize: 12,
    color: "#0EA5E9",
    fontWeight: "500",
  },
  primaryButton: {
    height: 48,
    backgroundColor: "#0EA5E9",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  doctorLoginButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
  },
  doctorLoginButtonText: {
    color: "#0EA5E9",
    fontSize: 14,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: "#64748B",
  },
  linkText: {
    fontSize: 14,
    color: "#0EA5E9",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 48,
    alignItems: "center",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    marginBottom: 24,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  boldEmail: {
    fontWeight: "700",
    color: "#0EA5E9",
  },
  otpInput: {
    width: "100%",
    height: 56,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalButton: {
    width: "100%",
    height: 56,
    backgroundColor: "#0EA5E9",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCancel: {
    padding: 12,
  },
  modalCancelText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default Login;
