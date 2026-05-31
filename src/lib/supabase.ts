import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Support both Vite (web) and Expo (mobile) environment variable formats safely
let supabaseUrl = "";
let supabaseAnonKey = "";

try {
  // @ts-ignore
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.EXPO_PUBLIC_SUPABASE_URL;
  // @ts-ignore
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
} catch (e) {
  // Fallback for React Native/Metro where import.meta is undefined
  supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
}

const isInvalidVar = (val: string) => {
  return !val || 
    val === "undefined" || 
    val === "null" || 
    val.trim() === "" || 
    val.includes("YOUR_") ||
    val.includes("placeholder");
};

if (isInvalidVar(supabaseUrl) || !supabaseUrl.startsWith("http")) {
  supabaseUrl = "https://zruonfdnfvgmaebanvdm.supabase.co";
}
if (isInvalidVar(supabaseAnonKey) || supabaseAnonKey.length < 50) {
  supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydW9uZmRuZnZnbWFlYmFudmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTczODksImV4cCI6MjA5MjU5MzM4OX0.AfutlmSt6ix8TNm0Lc70P2R2U554CXSaa7DxPyY8Hz4";
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Must be true on web so Supabase can parse the recovery access_token from the URL hash
    detectSessionInUrl: Platform.OS === 'web',
  },
});
