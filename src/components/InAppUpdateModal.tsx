import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as Updates from "expo-updates";
import { ArrowDownToLine, RefreshCw } from "lucide-react-native";

export const InAppUpdateModal = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // Only check in production builds (not in Expo Go/local development or on Web)
    if (__DEV__ || Platform.OS === "web") return;

    const checkUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.warn("Check for updates failed:", error);
      }
    };

    // Delay checking by 3 seconds so the app splash and main screen load first
    const timer = setTimeout(() => {
      checkUpdates();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      setStatus("Downloading update...");
      await Updates.fetchUpdateAsync();
      
      setStatus("Applying update...");
      // Delay slightly for smoother visual transition before reloading
      setTimeout(async () => {
        await Updates.reloadAsync();
      }, 1000);
    } catch (error) {
      setLoading(false);
      setStatus("");
      console.error("Update failed:", error);
    }
  };

  if (!updateAvailable) return null;

  return (
    <Modal visible={updateAvailable} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <ArrowDownToLine size={28} color="#0EA5E9" />
          </View>
          <Text style={styles.title}>Update Available! 🚀</Text>
          <Text style={styles.description}>
            A new version of ClinLab AI Assist is ready. Update now to access the latest features and bug fixes.
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#0EA5E9" style={{ marginBottom: 8 }} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.8}>
              <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Update & Restart</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#0EA5E9",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 12,
  },
  statusText: {
    fontSize: 14,
    color: "#0EA5E9",
    fontWeight: "500",
  },
});
