import * as React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ViewStyle, TextStyle } from "react-native";
import { X } from "lucide-react-native";

const Dialog = ({ children, open, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
  return <>{children}</>;
};

const DialogTrigger = ({ children, onPress }: { children: React.ReactNode, onPress?: () => void }) => {
  return <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>;
};

const DialogContent = ({ children, open, onOpenChange, style }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void, style?: ViewStyle }) => {
  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={() => onOpenChange?.(false)}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={() => onOpenChange?.(false)} />
        <View style={[styles.content, style]}>
          <TouchableOpacity style={styles.close} onPress={() => onOpenChange?.(false)}>
            <X size={20} color="#64748B" />
          </TouchableOpacity>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const DialogHeader = ({ children, style }: { children: React.ReactNode, style?: ViewStyle }) => (
  <View style={[styles.header, style]}>{children}</View>
);

const DialogFooter = ({ children, style }: { children: React.ReactNode, style?: ViewStyle }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

const DialogTitle = ({ children, style }: { children: React.ReactNode, style?: TextStyle }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

const DialogDescription = ({ children, style }: { children: React.ReactNode, style?: TextStyle }) => (
  <Text style={[styles.description, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    position: "relative",
  },
  close: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  header: {
    marginBottom: 16,
    gap: 4,
  },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
  },
  description: {
    fontSize: 14,
    color: "#64748B",
  },
});

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
