import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Stethoscope, ArrowLeft, ShieldCheck, Mail, KeyRound, Lock } from "lucide-react-native";
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

const ForgotPassword = () => {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if we arrived here via a recovery link
  React.useEffect(() => {
    const checkRecovery = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && window.location.hash.includes('type=recovery')) {
        setStep(3);
      }
    };
    if (Platform.OS === 'web') checkRecovery();
  }, []);

  const handleSendOtp = async () => {
    if (!email) {
      showAlert("Error", "Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: Platform.OS === 'web' ? window.location.origin + '/reset-password' : 'clinlab://reset-password',
      });

      if (error) throw error;
      
      showAlert("OTP Sent", "If an account exists for this email, we've sent a recovery link/code. Since you requested OTP flow, please check your email.");
      setStep(2);
    } catch (error: any) {
      showAlert("Request Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      showAlert("Error", "Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'recovery',
      });

      if (error) throw error;
      setStep(3);
    } catch (error: any) {
      showAlert("Verification Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 6) {
      showAlert("Weak Password", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      showAlert("Success", "Your password has been reset successfully. You can now log in with your new password.", [
        { text: "Go to Login", onPress: () => navigation.navigate("Login") }
      ]);
    } catch (error: any) {
      showAlert("Reset Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#64748B" />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconBox}>
              {step === 1 ? <Mail size={24} color="#0EA5E9" /> : 
               step === 2 ? <KeyRound size={24} color="#0EA5E9" /> : 
               <Lock size={24} color="#0EA5E9" />}
            </View>
            <Text style={styles.title}>
              {step === 1 ? "Forgot Password?" : 
               step === 2 ? "Verify OTP" : 
               "Reset Password"}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 ? "Enter your email to receive a recovery link and code." : 
               step === 2 ? `Check your email ${email}. You can either click the recovery link or enter the 6-digit code below.` : 
               "Create a strong new password for your account."}
            </Text>
          </View>

          {step === 1 && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="admin@clinic.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send Code</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  maxLength={6}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.textButton}>
                <Text style={styles.textButtonText}>Change Email</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleResetPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.securityNote}>
            <ShieldCheck size={14} color="#10B981" />
            <Text style={styles.securityText}>Secure biometric-grade encryption</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  keyboardView: { flex: 1 },
  backButton: { flexDirection: "row", alignItems: "center", padding: 20, gap: 8 },
  backText: { fontSize: 14, color: "#64748B", fontWeight: "500" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  header: { marginBottom: 32, alignItems: 'center' },
  iconBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#F0F9FF", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A", textAlign: 'center' },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 8, textAlign: 'center', lineHeight: 20 },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  input: { height: 48, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC" },
  otpInput: { textAlign: 'center', fontSize: 24, fontWeight: '700', letterSpacing: 4, height: 56 },
  primaryButton: { height: 48, backgroundColor: "#0EA5E9", borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  textButton: { alignSelf: 'center', padding: 8 },
  textButtonText: { color: "#0EA5E9", fontSize: 14, fontWeight: "600" },
  securityNote: { flexDirection: "row", alignItems: "center", justifyContent: 'center', gap: 8, marginTop: 40 },
  securityText: { fontSize: 12, color: "#166534", fontWeight: "500" }
});

export default ForgotPassword;
