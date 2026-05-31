import * as React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ViewStyle, TextStyle, Animated, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = Math.min(280, SCREEN_WIDTH * 0.8);

// --- Context ---
const SidebarContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

// --- Provider ---
export const SidebarProvider = ({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <View style={styles.providerRoot}>{children}</View>
    </SidebarContext.Provider>
  );
};

// --- Sidebar ---
export const Sidebar = ({ children, side = "left", style }: { children: React.ReactNode; side?: "left" | "right"; style?: ViewStyle }) => {
  const { open, setOpen } = React.useContext(SidebarContext);
  const translateX = React.useRef(new Animated.Value(side === "left" ? -SIDEBAR_WIDTH : SIDEBAR_WIDTH)).current;

  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: open ? 0 : (side === "left" ? -SIDEBAR_WIDTH : SIDEBAR_WIDTH),
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [open]);

  return (
    <>
      {open && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)} />
      )}
      <Animated.View style={[
        styles.sidebar,
        side === "left" ? styles.sidebarLeft : styles.sidebarRight,
        { transform: [{ translateX }] },
        style,
      ]}>
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </Animated.View>
    </>
  );
};

export const SidebarTrigger = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => {
  const { open, setOpen } = React.useContext(SidebarContext);
  return (
    <TouchableOpacity onPress={() => setOpen(!open)} style={style}>
      {children}
    </TouchableOpacity>
  );
};

export const SidebarContent = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.content, style]}>{children}</View>
);

export const SidebarHeader = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.header, style]}>{children}</View>
);

export const SidebarFooter = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

export const SidebarMenu = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.menu, style]}>{children}</View>
);

export const SidebarMenuItem = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.menuItem, style]}>{children}</View>
);

export const SidebarMenuButton = ({ children, onPress, isActive, style }: { children: React.ReactNode; onPress?: () => void; isActive?: boolean; style?: ViewStyle }) => (
  <TouchableOpacity onPress={onPress} style={[styles.menuButton, isActive && styles.menuButtonActive, style]}>
    {children}
  </TouchableOpacity>
);

export const SidebarMenuSub = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.menuSub, style]}>{children}</View>
);

export const SidebarMenuSubItem = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.menuItem, style]}>{children}</View>
);

export const SidebarMenuSubButton = ({ children, onPress, isActive, style }: { children: React.ReactNode; onPress?: () => void; isActive?: boolean; style?: ViewStyle }) => (
  <TouchableOpacity onPress={onPress} style={[styles.menuButton, isActive && styles.menuButtonActive, styles.subButton, style]}>
    {children}
  </TouchableOpacity>
);

export const SidebarGroup = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.group, style]}>{children}</View>
);

export const SidebarGroupLabel = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => (
  <Text style={[styles.groupLabel, style]}>{children}</Text>
);

export const SidebarGroupContent = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={style}>{children}</View>
);

export const SidebarGroupAction = ({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: ViewStyle }) => (
  <TouchableOpacity onPress={onPress} style={[styles.groupAction, style]}>{children}</TouchableOpacity>
);

export const SidebarSeparator = () => <View style={styles.separator} />;

export const SidebarInset = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.inset, style]}>{children}</View>
);

export const SidebarRail = () => null;

// Hook
export const useSidebar = () => React.useContext(SidebarContext);

const styles = StyleSheet.create({
  providerRoot: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 99 },
  sidebar: {
    position: "absolute", top: 0, bottom: 0, width: SIDEBAR_WIDTH,
    backgroundColor: "#FFFFFF", zIndex: 100, paddingVertical: 16,
    borderColor: "#E2E8F0",
    shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  sidebarLeft: { left: 0, borderRightWidth: 1 },
  sidebarRight: { right: 0, borderLeftWidth: 1 },
  content: { flex: 1, paddingHorizontal: 8 },
  header: { paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", marginBottom: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F1F5F9", marginTop: 8 },
  menu: { gap: 2 },
  menuItem: {},
  menuButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, gap: 10 },
  menuButtonActive: { backgroundColor: "#F1F5F9" },
  menuSub: { marginLeft: 28, gap: 2, marginTop: 2 },
  subButton: { paddingVertical: 8 },
  group: { marginBottom: 16 },
  groupLabel: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 11, fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8 },
  groupAction: { position: "absolute", right: 0, top: 0, padding: 6 },
  separator: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 8, marginHorizontal: 8 },
  inset: { flex: 1 },
});
