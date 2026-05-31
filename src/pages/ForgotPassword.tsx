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
  const [step, setStep] = useState(1); // 1: Email, 2: Success Message
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendLink = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      showAlert("Error", "Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: Platform.OS === 'web' ? window.location.origin + '/reset-password' : 'clinlab://reset-password',
      });

      if (error) throw error;
      
      setStep(2);
    } catch (error: any) {
      showAlert("Request Failed", error.message);
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
              {step === 1 ? <KeyRound size={24} color="#0EA5E9" /> : <Mail size={24} color="#0EA5E9" />}
            </View>
            <Text style={styles.title}>
              {step === 1 ? "Forgot Password?" : "Check Your Email"}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 
                ? "Enter your email address and we'll send you a link to reset your password." 
                : `We've sent a password reset link to ${email}. Please check your inbox and click the link to create a new password.`}
            </Text>
          </View>

          {step === 1 && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSendLink} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
                <Text style={styles.buttonText}>Return to Login</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.textButton}>
                <Text style={styles.textButtonText}>Try a different email</Text>
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
