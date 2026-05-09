import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Stethoscope, Loader2, ChevronDown, Search, Eye, EyeOff } from "lucide-react-native";
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

const Signup = () => {
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [authType, setAuthType] = useState<"doctor" | "organization">("doctor");
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [otp, setOtp] = useState("");
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    specialization: "",
    organization: { id: "", name: "" },
    role: "dentist",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [googleResults, setGoogleResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only auto-redirect if they are already logged in AND verified
      if (session && session.user.email_confirmed_at) {
        navigation.navigate(session.user.user_metadata?.role === "organization" ? "OrgDashboard" : "Dashboard");
      }
    });

    const fetchOrgs = async () => {
      setLoadingOrgs(true);
      console.log("Signup: Fetching organizations from Supabase...");
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'organization');
      
      if (error) {
        console.error("Signup: Supabase Error:", error);
        Alert.alert("Database Error", "Could not load organizations. Please check your Supabase RLS policies.");
      }
      if (data) {
        console.log("Signup: Successfully loaded from Supabase:", data.length, "organizations");
        setOrganizations(data);
      }
      setLoadingOrgs(false);
    };

    fetchOrgs();
  }, [navigation]);

  // Debounced Background Search (Web Search Simulation)
  useEffect(() => {
    if (authType !== 'organization' || formData.name.length < 3) {
      setGoogleResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (formData.name.length < 3) {
        setGoogleResults([]);
        return;
      }

      setIsSearching(true);
      console.log("Signup: Live searching global directory for:", formData.name);
      
      try {
        // Using Photon (OpenStreetMap) API - Expanded to include all medical types
        // We search for Hospital, Clinic, Dentist, Doctors, and Pharmacy to match "Google-like" results
        const query = encodeURIComponent(formData.name);
        const response = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=10`);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          // Filter for medical-related places to keep results clean
          const medicalKeywords = ['hospital', 'clinic', 'dentist', 'doctor', 'medical', 'health', 'care', 'pharmacy', 'center'];
          
          const results = data.features
            .filter((f: any) => {
              const props = f.properties;
              const type = (props.osm_value || "").toLowerCase();
              const category = (props.osm_key || "").toLowerCase();
              const name = (props.name || "").toLowerCase();
              
              return medicalKeywords.some(kw => 
                type.includes(kw) || category.includes(kw) || name.includes(kw)
              );
            })
            .map((f: any) => {
              const p = f.properties;
              const name = p.name || p.street || "Medical Center";
              const city = p.city || p.town || p.district || "";
              const state = p.state || p.country || "";
              
              const location = [city, state].filter(Boolean).join(", ");
              return location ? `${name} (${location})` : name;
            });

          if (results.length > 0) {
            setGoogleResults(results.slice(0, 8));
          } else {
            setGoogleResults(["NO_RESULTS"]);
          }
        } else {
          setGoogleResults(["NO_RESULTS"]);
        }
      } catch (error) {
        console.error("Live Search Error:", error);
        // Fallback to a few common ones if API fails
        setGoogleResults(["NO_RESULTS"]);
      } finally {
        setIsSearching(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [formData.name, authType]);

  // Scroll to top when switching auth type
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [authType]);

  // Background auto-login polling if stuck on Signup modal
  useEffect(() => {
    if (!pendingModalVisible || authType !== 'doctor') return;

    const pollSignIn = setInterval(async () => {
      // Try to silently sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (data?.session) {
        // Successful login, check profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', data.session.user.id)
          .single();

        if (profile?.status === 'approved') {
          clearInterval(pollSignIn);
          setPendingModalVisible(false);
          navigation.replace("Dashboard");
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(pollSignIn);
  }, [pendingModalVisible, formData.email, formData.password]);

  const handleSignup = async () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.name || !formData.phone) {
      showAlert("Missing Fields", "Please fill in all mandatory fields.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showAlert("Passwords Mismatch", "The passwords you entered do not match.");
      return;
    }

    if (authType === "doctor" && (!formData.specialization || !formData.organization.id)) {
      showAlert("Clinical Details Required", "Please select your role and organization.");
      return;
    }

    try {
      // 1. Check for duplicate Organization name if signing up as organization
      if (authType === "organization") {
        const { data: existingOrg } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'organization')
          .eq('full_name', formData.name)
          .maybeSingle();
        
        if (existingOrg) {
          showAlert("Organization Exists", "An organization with this name is already registered. Please login or use a different name.");
          setLoading(false);
          return;
        }
      }

      // 2. Check if user exists but is unverified
      // We attempt a signup - if it fails with 'already registered', 
      // we know we might need to clean up.
      let { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (error && error.message.includes("already registered")) {
        showAlert("Account Unverified", "This account exists but is not verified. Please sign up again.");
        setLoading(false);
        return;
      }

      if (error) throw error;

      if (data.user) {
        setTempUserId(data.user.id);
        setVerifying(true);
        setVerifyModalVisible(true);
      }
    } catch (error: any) {
      showAlert("Registration Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      showAlert("Invalid OTP", "Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      // 1. Verify the OTP with Supabase
      const { data, error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: otp,
        type: 'signup',
      });

      if (error) throw error;

      if (data.session) {
        // 2. NOW we create the database record based on the role
        const profileData = {
          id: data.session.user.id,
          full_name: formData.name,
          phone: formData.phone,
          role: authType,
          status: authType === "organization" ? "approved" : "pending", // Doctors stay pending
          specialization: authType === "doctor" ? formData.specialization : null,
          org_id: authType === "doctor" ? formData.organization.id : null,
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData); // Use upsert to prevent "duplicate key" errors

        if (profileError) throw profileError;

        setVerifyModalVisible(false);

        if (authType === "doctor") {
          // Redirect Doctors to the waiting screen
          setPendingModalVisible(true);
        } else {
          // Redirect Organizations to dashboard
          showAlert("Welcome", "Your organization is verified!", [
            { text: "Enter Dashboard", onPress: () => navigation.replace("OrgDashboard") }
          ]);
        }
      }
    } catch (error: any) {
      showAlert("Verification Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSignup = async () => {
    // If user cancels during OTP, we clean up the unverified auth record immediately
    if (tempUserId) {
      await supabase.rpc('delete_rejected_user', { target_user_id: tempUserId });
    }
    
    setVerifyModalVisible(false);
    setOtp("");
    setTempUserId(null);
    showAlert("Registration Cancelled", "The verification process was aborted and your temporary details have been removed.");
    navigation.navigate("Login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView 
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
          scrollEnabled={true}
          keyboardShouldPersistTaps="always"
        >
        <View style={styles.hero}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Fill in your details to get started.</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, authType === "doctor" && styles.tabActive]}
            onPress={() => setAuthType("doctor")}
          >
            <Text style={[styles.tabText, authType === "doctor" && styles.tabTextActive]}>Doctor</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, authType === "organization" && styles.tabActive]}
            onPress={() => setAuthType("organization")}
          >
            <Text style={[styles.tabText, authType === "organization" && styles.tabTextActive]}>Organization</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {authType === "organization" ? "Organization Name" : "Full name"}
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={authType === "organization" ? "e.g. City Dental Clinic" : "Dr. Aarav Singh"}
                value={formData.name}
                onChangeText={(v) => {
                  setFormData({ ...formData, name: v });
                  if (authType === "organization") setShowSuggestions(true);
                }}
                placeholderTextColor="#94A3B8"
              />
              {isSearching && (
                <View style={styles.inputLoader}>
                  <ActivityIndicator size="small" color="#0EA5E9" />
                </View>
              )}
            </View>
            
            {authType === "organization" && showSuggestions && googleResults.length > 0 && (
              <View style={styles.inlineDropdown}>
                <Text style={styles.dropdownLabel}>Suggested Official Names (Web Search)</Text>
                {googleResults[0] === "NO_RESULTS" ? (
                  <View style={styles.inlineOption}>
                    <Text style={[styles.inlineOptionText, { color: '#94A3B8' }]}>No official names found. You can keep typing yours.</Text>
                  </View>
                ) : (
                  googleResults.map((res, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={styles.inlineOption}
                      onPress={() => {
                        setFormData({ ...formData, name: res });
                        setShowSuggestions(false);
                        setGoogleResults([]);
                      }}
                    >
                      <Text style={styles.inlineOptionText}>{res}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@clinic.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(v) => setFormData({ ...formData, email: v })}
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 ..."
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(v) => setFormData({ ...formData, phone: v })}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                value={formData.password}
                onChangeText={(v) => setFormData({ ...formData, password: v })}
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[
              styles.passwordContainer, 
              formData.confirmPassword.length > 0 && 
              formData.password !== formData.confirmPassword && 
              { borderColor: '#EF4444', borderWidth: 1.5 }
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                value={formData.confirmPassword}
                onChangeText={(v) => setFormData({ ...formData, confirmPassword: v })}
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
              </TouchableOpacity>
            </View>
            {formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword && (
              <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '500', marginTop: 4 }}>
                Passwords do not match yet
              </Text>
            )}
          </View>

          {authType === "doctor" && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Specialization</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Orthodontist"
                  value={formData.specialization}
                  onChangeText={(v) => setFormData({ ...formData, specialization: v })}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Select Organization</Text>
                <TouchableOpacity 
                  style={styles.pickerTrigger}
                  onPress={() => setOrgModalVisible(true)}
                >
                  <Text style={styles.pickerValue} numberOfLines={2}>
                    {formData.organization.name || "Choose Clinic/Hospital"}
                  </Text>
                  <ChevronDown size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
            </>
          )}

          {authType === "doctor" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Clinical Role</Text>
              <TouchableOpacity 
                style={styles.pickerTrigger}
                onPress={() => setRoleModalVisible(true)}
              >
                <Text style={styles.pickerValue}>{formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}</Text>
                <ChevronDown size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.heroButton, (loading || verifying) && styles.buttonDisabled]} 
            onPress={handleSignup}
            disabled={loading || verifying}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} /> : null}
            <Text style={styles.heroButtonText}>
              {verifying ? "Waiting for Verification..." : "Create account"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.footer}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.linkText}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={roleModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setRoleModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Clinical Role</Text>
            {["dentist", "assistant", "therapist"].map(v => (
              <TouchableOpacity 
                key={v} 
                style={styles.modalOption}
                onPress={() => {
                  setFormData({ ...formData, role: v });
                  setRoleModalVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={orgModalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setOrgModalVisible(false); setSearchQuery(""); }}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalHeader}>Registered Organizations</Text>
            
            <View style={styles.searchContainer}>
              <Search size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search clinic name..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.diagBox}>
              <Text style={styles.diagText}>Database Status: {organizations.length > 0 ? "Connected" : "Searching..."}</Text>
              <Text style={styles.diagText}>Matches Found: {organizations.filter(o => o.full_name?.toLowerCase().includes(searchQuery.toLowerCase())).length}</Text>
            </View>
            <TouchableOpacity 
              style={styles.refreshBtn} 
              onPress={() => {
                supabase.from('profiles').select('id, full_name').eq('role', 'organization').then(({data, error}) => {
                  if(error) Alert.alert("Error", error.message);
                  if(data) setOrganizations(data);
                });
              }}
            >
              <Text style={styles.refreshBtnText}>Refresh from Supabase</Text>
            </TouchableOpacity>
            <View style={{ maxHeight: 400 }}>
              <ScrollView 
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {organizations.length > 0 ? (
                  organizations
                    .filter(org => org.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(org => (
                      <TouchableOpacity 
                        key={org.id} 
                        style={styles.modalOption}
                        onPress={() => {
                          setFormData({ ...formData, organization: { id: org.id, name: org.full_name } });
                          setOrgModalVisible(false);
                          setSearchQuery("");
                        }}
                      >
                        <Text style={styles.modalOptionText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{org.full_name}</Text>
                      </TouchableOpacity>
                    ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.noData}>No organizations found in Supabase.</Text>
                    <Text style={styles.hintText}>Make sure your clinic has registered as an "Organization" first.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={verifyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40 }]}>
            <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Stethoscope size={32} color="#0EA5E9" />
            </View>

            <Text style={[styles.modalHeader, { textAlign: 'center' }]}>Verify Your Email</Text>
            <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 24, lineHeight: 22, fontSize: 15 }}>
              We've sent a 6-digit verification code to{"\n"}
              <Text style={{ fontWeight: '700', color: '#0EA5E9' }}>{formData.email}</Text>.{"\n"}
              Please enter it below to activate your account.
            </Text>

            <View style={styles.otpInputGroup}>
              <TextInput
                style={styles.otpInput}
                placeholder="000000"
                maxLength={6}
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                placeholderTextColor="#94A3B8"
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.heroButton, { width: '100%', marginBottom: 16 }]} 
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.heroButtonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={async () => {
                setLoading(true);
                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: formData.email,
                });
                setLoading(false);
                if (error) showAlert("Resend Failed", error.message);
                else showAlert("Sent!", "A new 6-digit code has been sent to your email.");
              }}
              style={{ alignSelf: 'center', padding: 15, width: '100%', alignItems: 'center' }}
            >
              <Text style={{ color: '#0EA5E9', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' }}>Resend Verification Code</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />

            <TouchableOpacity 
              onPress={handleCancelSignup}
              style={{ alignSelf: 'center', padding: 10 }}
            >
              <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>Cancel Registration</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={pendingModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40 }]}>
            <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Stethoscope size={32} color="#F59E0B" />
            </View>

            <Text style={[styles.modalHeader, { textAlign: 'center' }]}>Waiting for Approval</Text>
            <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 24, lineHeight: 22, fontSize: 15 }}>
              Your application has been sent to{"\n"}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{formData.organization.name}</Text>.{"\n\n"}
              You will be able to log in once the organization administrator approves your access.
            </Text>
            <View style={{ marginTop: 8, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={{ marginTop: 12, color: '#F59E0B', fontWeight: '600' }}>Checking status automatically...</Text>
            </View>
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
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === "ios" ? 20 : 40,
    paddingBottom: 250, // Massive space to ensure button is reachable
    gap: 16,
    flexGrow: 1,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  hero: {
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
  },
  form: {
    gap: 12,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  tab: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#0EA5E9",
  },
  inputGroup: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  input: {
    height: 44,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#0F172A",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
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
  inputWrapper: {
    position: 'relative',
    width: '100%',
  },
  inputLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 10,
  },
  dropdownLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    padding: 8,
    backgroundColor: "#F8FAFC",
    textTransform: "uppercase",
  },
  inlineDropdown: {
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    maxHeight: 200,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    zIndex: 10,
  },
  inlineOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  inlineOptionText: {
    fontSize: 14,
    color: "#0F172A",
  },
  pickerTrigger: {
    minHeight: 44,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pickerValue: {
    fontSize: 13,
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },
  heroButton: {
    height: 50,
    backgroundColor: "#0EA5E9",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  heroButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    marginTop: 4,
  },
  footerText: {
    fontSize: 13,
    color: "#64748B",
  },
  linkText: {
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    maxHeight: '80%',
  },
  otpInputGroup: {
    marginVertical: 20,
    alignItems: 'center',
  },
  otpInput: {
    width: 240,
    height: 56,
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#0EA5E9",
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: "#0F172A",
    letterSpacing: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as any,
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  refreshBtn: {
    backgroundColor: "#F1F5F9",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  refreshBtnText: {
    color: "#0EA5E9",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    padding: 16,
    alignItems: "center",
  },
  noData: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
  },
  hintText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
  },
  modalOption: {
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
    textAlign: "center",
    flexWrap: "wrap",
  },
  diagBox: {
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  diagText: {
    fontSize: 11,
    color: "#64748B",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default Signup;
