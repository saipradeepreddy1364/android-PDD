import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ShieldCheck, Lock, ArrowLeft, CheckCircle2 } from "lucide-react-native";
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

const ResetPassword = () => {
  const navigation = useNavigation<any>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // For web, the hash contains the recovery token which Supabase JS automatically consumes
      // to establish a session. We just check if a session exists and if we're in a recovery flow.
      const { data: { session } } = await supabase.auth.getSession();
      
      // On web, Supabase handles the hash fragment automatically. 
      // If we have a session, we are likely in the recovery flow if the URL has type=recovery
      const isRecovery = Platform.OS === 'web' && (window.location.hash.includes('type=recovery') || window.location.href.includes('type=recovery'));
      
      if (session) {
        setIsValidSession(true);
      } else if (!isRecovery) {
        // If no session and no recovery hash, this page is invalid
        showAlert("Invalid Link", "This password reset link is invalid or has expired.", [
          { text: "Go to Login", onPress: () => navigation.navigate("Login") }
        ]);
      }
      setChecking(false);
    };

    checkSession();
  }, [navigation]);

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

      setSuccess(true);
      showAlert("Success", "Your password has been reset successfully.", [
        { text: "Go to Login", onPress: () => navigation.navigate("Login") }
      ]);
    } catch (error: any) {
      showAlert("Reset Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Verifying reset link...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("Login")}>
          <ArrowLeft size={20} color="#64748B" />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconBox, success && styles.successIconBox]}>
              {success ? <CheckCircle2 size={28} color="#10B981" /> : <Lock size={28} color="#0EA5E9" />}
            </View>
            <Text style={styles.title}>
              {success ? "Password Updated" : "Create New Password"}
            </Text>
            <Text style={styles.subtitle}>
              {success ? "Your password has been changed successfully. You can now log in with your new credentials." : 
               "Please enter a strong new password to secure your account."}
            </Text>
          </View>

          {!success ? (
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
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
              <Text style={styles.buttonText}>Back to Login</Text>
            </TouchableOpacity>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 16, color: '#64748B', fontSize: 14 },
  backButton: { flexDirection: "row", alignItems: "center", padding: 20, gap: 8 },
  backText: { fontSize: 14, color: "#64748B", fontWeight: "500" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  header: { marginBottom: 32, alignItems: 'center' },
  iconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#F0F9FF", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successIconBox: { backgroundColor: "#ECFDF5" },
  title: { fontSize: 26, fontWeight: "700", color: "#0F172A", textAlign: 'center' },
  subtitle: { fontSize: 15, color: "#64748B", marginTop: 10, textAlign: 'center', lineHeight: 22 },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  input: { height: 52, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC" },
  primaryButton: { height: 52, backgroundColor: "#0EA5E9", borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  securityNote: { flexDirection: "row", alignItems: "center", justifyContent: 'center', gap: 8, marginTop: 48 },
  securityText: { fontSize: 12, color: "#166534", fontWeight: "500" }
});

export default ResetPassword;
