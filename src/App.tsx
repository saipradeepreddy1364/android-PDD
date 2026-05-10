import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";

import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthWrapper } from "@/components/AuthWrapper";
import { NetworkGuard } from "@/components/NetworkGuard";
import { AppDataProvider } from "@/lib/AppDataContext";
import SplashScreen from "./pages/SplashScreen";
import Login from "./pages/Login";
import DoctorLogin from "./pages/DoctorLogin";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import OrgDashboard from "./pages/OrgDashboard";
import OrgCases from "./pages/OrgCases";
import OrgReports from "./pages/OrgReports";
import OrgDoctors from "./pages/OrgDoctors";
import NewCase from "./pages/NewCase";
import AIEngine from "./pages/AIEngine";
import LabRequisition from "./pages/LabRequisition";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Insights from "./pages/Insights";
import ApprovalCenter from "./pages/ApprovalCenter";
import NotFound from "./pages/NotFound";

import { useRealtimeNotifications } from "./lib/useRealtimeNotifications";

const Stack = createStackNavigator();
const queryClient = new QueryClient();

const App = () => {
  useRealtimeNotifications();

  const linking = {
    prefixes: [Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.origin : 'https://clinlab-ai-assist.vercel.app') : 'clinlab://'],
    config: {
      screens: {
        ResetPassword: 'reset-password',
        ForgotPassword: 'forgot-password',
      },
    },
  };
  
  return (
    <QueryClientProvider client={queryClient}>
      <AppDataProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <NetworkGuard />
            <AuthWrapper>
              <NavigationContainer linking={linking}>
              <StatusBar style="auto" />
              <Stack.Navigator 
                initialRouteName="SplashScreen"
                screenOptions={{
                  headerShown: false,
                }}
              >
                {/* Entry / Splash */}
                <Stack.Screen name="SplashScreen" component={SplashScreen} />
                
                {/* Public Routes */}
                <Stack.Screen name="Login" component={Login} />
                <Stack.Screen name="DoctorLogin" component={DoctorLogin} />
                <Stack.Screen name="Signup" component={Signup} />
                <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
                <Stack.Screen name="ResetPassword" component={ResetPassword} />
                
                {/* Authenticated Routes */}
                <Stack.Screen name="Dashboard" component={Dashboard} />
                <Stack.Screen name="OrgDashboard" component={OrgDashboard} />
                <Stack.Screen name="OrgCases" component={OrgCases} />
                <Stack.Screen name="OrgReports" component={OrgReports} />
                <Stack.Screen name="OrgDoctors" component={OrgDoctors} />
                <Stack.Screen name="NewCase" component={NewCase} />
                <Stack.Screen name="AIEngine" component={AIEngine} />
                <Stack.Screen name="LabRequisition" component={LabRequisition} />
                <Stack.Screen name="Patients" component={Patients} />
                <Stack.Screen name="PatientDetail" component={PatientDetail} />
                <Stack.Screen name="Insights" component={Insights} />
                <Stack.Screen name="ApprovalCenter" component={ApprovalCenter} />
                <Stack.Screen name="NotFound" component={NotFound} />
              </Stack.Navigator>
            </NavigationContainer>
          </AuthWrapper>
        </SafeAreaProvider>
      </ThemeProvider>
      </AppDataProvider>
    </QueryClientProvider>
  );
};

export default App;
