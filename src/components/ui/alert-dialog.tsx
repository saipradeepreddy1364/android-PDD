import * as React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ViewStyle, TextStyle } from "react-native";
import { Button } from "./button";

const AlertDialog = ({ children, open, onOpenChange }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void }) => {
  return <>{children}</>;
};

const AlertDialogTrigger = ({ children, onPress }: { children: React.ReactNode, onPress?: () => void }) => {
  return <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>;
};

const AlertDialogContent = ({ children, open, onOpenChange, style }: { children: React.ReactNode, open?: boolean, onOpenChange?: (open: boolean) => void, style?: ViewStyle }) => {
  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={() => onOpenChange?.(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop} />
        <View style={[styles.content, style]}>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const AlertDialogHeader = ({ children, style }: { children: React.ReactNode, style?: ViewStyle }) => (
  <View style={[styles.header, style]}>{children}</View>
);

const AlertDialogFooter = ({ children, style }: { children: React.ReactNode, style?: ViewStyle }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

const AlertDialogTitle = ({ children, style }: { children: React.ReactNode, style?: TextStyle }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

const AlertDialogDescription = ({ children, style }: { children: React.ReactNode, style?: TextStyle }) => (
  <Text style={[styles.description, style]}>{children}</Text>
);

const AlertDialogAction = ({ children, onPress, style }: { children: React.ReactNode, onPress?: () => void, style?: ViewStyle }) => (
  <Button onPress={onPress} style={style}>{children}</Button>
);

const AlertDialogCancel = ({ children, onPress, style }: { children: React.ReactNode, onPress?: () => void, style?: ViewStyle }) => (
  <Button variant="outline" onPress={onPress} style={style}>{children}</Button>
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

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
