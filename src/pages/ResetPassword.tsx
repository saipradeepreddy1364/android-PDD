import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ShieldCheck, Lock, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react-native";
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
  const [showPassword, setShowPassword] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = password.length >= 6;

  useEffect(() => {
    let mounted = true;

    const setupRecoverySession = async () => {
      // First, check if we already have a session (e.g., Supabase already parsed the hash)
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        setIsValidSession(true);
        setChecking(false);
        return;
      }

      // Listen for the PASSWORD_RECOVERY event from Supabase's onAuthStateChange.
      // This fires after Supabase parses the #access_token hash from the reset URL.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event === 'PASSWORD_RECOVERY' && session) {
          setIsValidSession(true);
          setChecking(false);
        } else if (event === 'SIGNED_IN' && session) {
          // Some Supabase versions fire SIGNED_IN instead of PASSWORD_RECOVERY
          setIsValidSession(true);
          setChecking(false);
        }
      });

      // Timeout: if no auth event fires within 5 seconds, the link is invalid/expired
      const timeout = setTimeout(() => {
        if (mounted && !isValidSession) {
          setChecking(false);
          showAlert("Invalid Link", "This password reset link is invalid or has expired.", [
            { text: "Go to Login", onPress: () => navigation.navigate("Login") }
          ]);
        }
      }, 5000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    };

    setupRecoverySession();

    return () => {
      mounted = false;
    };
  }, [navigation]);

  const handleResetPassword = async () => {
    if (!isPasswordValid) {
      showAlert("Weak Password", "Password must be at least 6 characters.");
      return;
    }
    if (!passwordsMatch) {
      showAlert("Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      // Force sign out so that they aren't logged in automatically, since updating the password updates their active session.
      await supabase.auth.signOut();

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
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    {showPassword ? <EyeOff size={20} color="#94A3B8" /> : <Eye size={20} color="#94A3B8" />}
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={[styles.passwordInputContainer, confirmPassword.length > 0 && !passwordsMatch && styles.inputError]}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    {showPassword ? <EyeOff size={20} color="#94A3B8" /> : <Eye size={20} color="#94A3B8" />}
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
                {password.length > 0 && !isPasswordValid && (
                  <Text style={styles.errorText}>Password must be at least 6 characters</Text>
                )}
              </View>
              <TouchableOpacity 
                style={[styles.primaryButton, (!passwordsMatch || !isPasswordValid) && styles.disabledButton]} 
                onPress={handleResetPassword} 
                disabled={loading || !passwordsMatch || !isPasswordValid}
              >
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
  passwordInputContainer: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, backgroundColor: "#F8FAFC" },
  passwordInput: { flex: 1, height: '100%', paddingHorizontal: 16, fontSize: 15, color: "#0F172A" },
  eyeIcon: { padding: 14 },
  inputError: { borderColor: "#EF4444" },
  errorText: { color: "#EF4444", fontSize: 12, marginTop: -4 },
  primaryButton: { height: 52, backgroundColor: "#0EA5E9", borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
  disabledButton: { backgroundColor: "#94A3B8", opacity: 0.7 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  securityNote: { flexDirection: "row", alignItems: "center", justifyContent: 'center', gap: 8, marginTop: 48 },
  securityText: { fontSize: 12, color: "#166534", fontWeight: "500" }
});

export default ResetPassword;
