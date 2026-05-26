import React from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";

/**
 * A beautiful multi-color gradient background using overlapping radial blobs.
 * Works on web via CSS radial-gradient, falls back to solid blobs on native.
 * Responsive across laptop, tablet, and mobile screens.
 */
const GradientBackground = ({ children }: { children: React.ReactNode }) => {
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        {/* Web: Use CSS background with multiple radial gradients for a smooth organic look */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(ellipse 80% 60% at 0% 0%, rgba(56, 189, 248, 0.05) 0%, transparent 70%),
              radial-gradient(ellipse 60% 80% at 100% 0%, rgba(125, 211, 252, 0.04) 0%, transparent 60%),
              radial-gradient(ellipse 70% 50% at 100% 100%, rgba(251, 191, 36, 0.03) 0%, transparent 70%),
              radial-gradient(ellipse 50% 60% at 0% 100%, rgba(253, 224, 71, 0.02) 0%, transparent 60%),
              radial-gradient(ellipse 40% 40% at 50% 50%, rgba(147, 197, 253, 0.015) 0%, transparent 50%),
              radial-gradient(ellipse 90% 40% at 30% 20%, rgba(167, 243, 208, 0.02) 0%, transparent 60%),
              radial-gradient(ellipse 60% 30% at 70% 80%, rgba(254, 215, 170, 0.03) 0%, transparent 55%),
              linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 30%, #FFFBEB 70%, #FFF7ED 100%)
            `,
            zIndex: 0,
          }}
        />
        {/* Animated floating orb accents */}
        <div
          style={{
            position: "absolute",
            top: "5%",
            left: "5%",
            width: "min(400px, 50vw)",
            height: "min(400px, 50vw)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(14, 165, 233, 0.02) 0%, transparent 70%)",
            filter: "blur(40px)",
            animation: "float1 8s ease-in-out infinite",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "5%",
            right: "5%",
            width: "min(350px, 45vw)",
            height: "min(350px, 45vw)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(251, 146, 60, 0.02) 0%, transparent 70%)",
            filter: "blur(40px)",
            animation: "float2 10s ease-in-out infinite",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "40%",
            right: "20%",
            width: "min(250px, 30vw)",
            height: "min(250px, 30vw)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(52, 211, 153, 0.1) 0%, transparent 70%)",
            filter: "blur(30px)",
            animation: "float3 12s ease-in-out infinite",
            zIndex: 0,
          }}
        />
        {/* Inject keyframes for floating animation */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes float1 {
                0%, 100% { transform: translate(0, 0) scale(1); }
                50% { transform: translate(20px, 15px) scale(1.05); }
              }
              @keyframes float2 {
                0%, 100% { transform: translate(0, 0) scale(1); }
                50% { transform: translate(-15px, -20px) scale(1.08); }
              }
              @keyframes float3 {
                0%, 100% { transform: translate(0, 0) scale(1); }
                33% { transform: translate(10px, -10px) scale(1.03); }
                66% { transform: translate(-10px, 10px) scale(0.97); }
              }
            `,
          }}
        />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  // Native fallback: Use colored Views as gradient blobs
  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blobTopLeft]} />
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobBottomRight]} />
      <View style={[styles.blob, styles.blobBottomLeft]} />
      <View style={[styles.blob, styles.blobCenter]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    position: "relative",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    zIndex: 1,
    position: "relative",
  },
  // Native blob fallbacks
  blob: {
    position: "absolute",
    borderRadius: 999,
    zIndex: 0,
  },
  blobTopLeft: {
    top: -80,
    left: -80,
    width: 320,
    height: 320,
    backgroundColor: "rgba(56, 189, 248, 0.02)",
  },
  blobTopRight: {
    top: -40,
    right: -60,
    width: 280,
    height: 280,
    backgroundColor: "rgba(167, 243, 208, 0.02)",
  },
  blobBottomRight: {
    bottom: -60,
    right: -40,
    width: 300,
    height: 300,
    backgroundColor: "rgba(251, 191, 36, 0.015)",
  },
  blobBottomLeft: {
    bottom: -80,
    left: -60,
    width: 260,
    height: 260,
    backgroundColor: "rgba(253, 224, 71, 0.012)",
  },
  blobCenter: {
    top: "35%",
    left: "30%",
    width: 200,
    height: 200,
    backgroundColor: "rgba(147, 197, 253, 0.008)",
  },
});

export default GradientBackground;
