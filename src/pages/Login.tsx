import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, Dimensions, KeyboardAvoidingView, Platform, Alert } from "react-native";
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
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
        showAlert("Invalid Email", "Please enter a valid email address.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          showAlert("Login Failed", "Incorrect email or password. Please ensure you have created an account and verified your email.");
        } else if (error.message.includes("Email not confirmed")) {
          showAlert("Email Verification Required", "Please create your account again and verify your email to sign in.");
        } else {
          throw error;
        }
        return;
      }
      
      if (data.session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (profile?.role === 'organization' && !data.session.user.email_confirmed_at) {
          showAlert("Email Verification Required", "Please create your account again and verify your email to sign in.");
          await supabase.auth.signOut();
          return;
        }

        if (profile?.role === 'doctor' && profile.status !== 'approved') {
          showAlert("Approval Pending", "Your account is waiting for approval from your organization.");
          await supabase.auth.signOut();
          return;
        }

        navigation.replace(profile?.role === "organization" ? "OrgDashboard" : "Dashboard");
      }
    } catch (error: any) {
      showAlert("Login Error", error.message);
    } finally {
      setLoading(false);
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
});

export default Login;
