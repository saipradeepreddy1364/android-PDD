import * as React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ViewStyle, TextStyle, StyleProp } from "react-native";
import { X } from "lucide-react-native";

const Sheet = ({ children, open, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
  return <>{children}</>;
};

const SheetTrigger = ({ children, onPress }: { children: React.ReactNode, onPress?: () => void }) => {
  return <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>;
};

const SheetContent = ({ children, side = "right", open, onOpenChange, style }: { children: React.ReactNode, side?: "top" | "bottom" | "left" | "right", open?: boolean, onOpenChange?: (open: boolean) => void, style?: StyleProp<ViewStyle> }) => {
  return (
    <Modal
      transparent
      visible={open}
      animationType="slide"
      onRequestClose={() => onOpenChange?.(false)}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={() => onOpenChange?.(false)} />
        <View style={[styles.content, styles[side], style]}>
          <TouchableOpacity style={styles.close} onPress={() => onOpenChange?.(false)}>
            <X size={20} color="#64748B" />
          </TouchableOpacity>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const SheetHeader = ({ children, style }: { children: React.ReactNode, style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.header, style]}>{children}</View>
);

const SheetFooter = ({ children, style }: { children: React.ReactNode, style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

const SheetTitle = ({ children, style }: { children: React.ReactNode, style?: StyleProp<TextStyle> }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

const SheetDescription = ({ children, style }: { children: React.ReactNode, style?: StyleProp<TextStyle> }) => (
  <Text style={[styles.description, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    position: "absolute",
  },
  right: {
    top: 0,
    right: 0,
    bottom: 0,
    width: "80%",
  },
  left: {
    top: 0,
    left: 0,
    bottom: 0,
    width: "80%",
  },
  top: {
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  bottom: {
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  close: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  header: {
    marginBottom: 16,
  },
  footer: {
    marginTop: "auto",
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
    marginTop: 4,
  },
});

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
