import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Stethoscope, Loader2, ArrowLeft, ShieldCheck, Eye, EyeOff } from "lucide-react-native";
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

const DoctorLogin = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        // Any error that isn't specifically about unconfirmed email is likely a credential issue
        if (!error.message.toLowerCase().includes("email not confirmed")) {
          // Reliable existence check via profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', trimmedEmail)
            .maybeSingle();

          if (profile) {
            showAlert("Incorrect Password", "The password you entered is incorrect. Please try again or reset your password.");
          } else {
            showAlert("Account Not Found", "This email is not registered. Please create an account and verify to sign in.");
          }
        } else {
          setLoading(true);
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: email,
          });
          setLoading(false);
          
          if (!resendError) {
            setShowVerifyModal(true);
          } else {
            showAlert("Verification Error", resendError.message);
          }
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', data.user.id)
          .single();

        if (profile?.role !== 'doctor') {
          await supabase.auth.signOut();
          throw new Error("This login is for Doctors only. Organizations should use the main portal.");
        }

        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          showAlert("Email Verification Required", "Please verify your email before logging in.");
          return;
        }

        if (profile?.status === 'pending') {
          await supabase.auth.signOut();
          showAlert("Approval Pending", "Your account is waiting for approval from your organization. You'll be able to login once they approve.");
          return;
        }

        if (profile?.status === 'rejected') {
          await supabase.auth.signOut();
          showAlert("Access Denied", "Your application was rejected by the organization.");
          return;
        }

        navigation.navigate("Dashboard");
      }
    } catch (error: any) {
      showAlert("Login Failed", error.message);
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
              full_name: metadata?.full_name || metadata?.name || "Dr. User",
              phone: metadata?.phone || "",
              role: metadata?.role || "doctor",
              status: "pending", 
              specialization: metadata?.specialization || null,
              org_id: metadata?.org_id || null,
              org_name: metadata?.org_name || metadata?.organization_name || null,
            });

          if (profileError) throw profileError;
        }

        setShowVerifyModal(false);
        navigation.navigate("Dashboard");
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("Login")}>
          <ArrowLeft size={20} color="#64748B" />
          <Text style={styles.backText}>Organization Portal</Text>
        </TouchableOpacity>

        <View style={styles.formContainer}>
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Stethoscope size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.logoText}>ClinLab <Text style={styles.proText}>Pro</Text></Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Clinical Access</Text>
            <Text style={styles.subtitle}>Secure login for registered medical practitioners.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Professional Email</Text>
              <TextInput
                style={styles.input}
                placeholder="dr.name@clinic.com"
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
                  <Text style={styles.forgotText}>Reset PIN?</Text>
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

            <View style={styles.securityNote}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={styles.securityText}>End-to-end encrypted clinical connection</Text>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Enter Clinic</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Not registered by your Org? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
              <Text style={styles.linkText}>Apply for Access</Text>
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

              <Text style={styles.modalTitle}>Verify Clinical Account</Text>
              <Text style={styles.modalSubtitle}>
                We've sent a code to{"\n"}
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
                  <Text style={styles.modalButtonText}>Verify & Enter Clinic</Text>
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
    backgroundColor: "#F8FAFC",
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 8,
  },
  backText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
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
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  proText: {
    color: "#0EA5E9",
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    marginTop: 8,
    lineHeight: 22,
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
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0F172A",
  },
  eyeIcon: {
    padding: 4,
  },
  forgotText: {
    fontSize: 12,
    color: "#0EA5E9",
    fontWeight: "600",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    padding: 10,
    borderRadius: 12,
  },
  securityText: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
  },
  primaryButton: {
    height: 56,
    backgroundColor: "#0EA5E9",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 40,
  },
  footerText: {
    fontSize: 14,
    color: "#64748B",
  },
  linkText: {
    fontSize: 14,
    color: "#0EA5E9",
    fontWeight: "700",
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

export default DoctorLogin;
