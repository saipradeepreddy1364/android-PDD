import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Bell, Info, AlertTriangle, CheckCircle2 } from "lucide-react-native";
import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { supabase } from "@/lib/supabase";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "./ThemeProvider";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "urgent" | "update";
  time: string;
  read: boolean;
};

export const NotificationSidebar = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const fetchRecentChanges = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cases } = await supabase
        .from('cases')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      let newNotifs: Notification[] = [];

      if (cases) {
        const mapped: Notification[] = cases.map(c => ({
          id: c.id,
          title: c.is_urgent ? "🚨 Urgent Case" : "New Case Assigned",
          message: `${c.patient_name}: Tooth ${c.tooth_number} - ${c.diagnosis}`,
          type: c.is_urgent ? "urgent" : "info",
          time: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false
        }));
        newNotifs = [...newNotifs, ...mapped];
      }

      // If Organization, fetch pending doctors
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'organization') {
        const { data: pendingDoctors } = await supabase
          .from('profiles')
          .select('*')
          .eq('org_id', user.id)
          .eq('role', 'doctor')
          .eq('status', 'pending');
        
        if (pendingDoctors && pendingDoctors.length > 0) {
          const doctorAlerts: Notification[] = pendingDoctors.map(d => ({
            id: `pending-${d.id}`,
            title: "👨‍⚕️ Doctor Approval",
            message: `${d.full_name} is waiting for access approval.`,
            type: "urgent",
            time: "Just Now",
            read: false
          }));
          newNotifs = [...doctorAlerts, ...newNotifs];
        }
      }

      setNotifications(newNotifs);
    };

    if (open) {
      fetchRecentChanges();

      // Subscribe to realtime changes while open
      const channel = supabase
        .channel('sidebar-realtime-' + Date.now())
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cases' },
          () => {
            fetchRecentChanges();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open]);

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "urgent": return <AlertTriangle size={18} color="#EF4444" />;
      case "update": return <CheckCircle2 size={18} color="#0EA5E9" />;
      default: return <Info size={18} color="#64748B" />;
    }
  };

  const handleNotificationPress = (n: Notification) => {
    onOpenChange(false); // Close sidebar
    if (n.id.startsWith("pending-")) {
      navigation.navigate("ApprovalCenter");
    }
  };

  return (
    <SheetContent open={open} onOpenChange={onOpenChange} side="right" style={[styles.sheetContent, isDark && styles.sheetContentDark]}>
      <SheetHeader style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.titleRow}>
          <Bell size={20} color={isDark ? "#FFF" : "#0F172A"} />
          <SheetTitle style={[styles.title, isDark && styles.titleDark]}>Notifications</SheetTitle>
          <SheetDescription style={{ display: "none" }}>
            View your recent clinical updates and alerts.
          </SheetDescription>
        </View>
        <TouchableOpacity onPress={() => setNotifications([])}>
          <Text style={styles.clearAll}>Clear all</Text>
        </TouchableOpacity>
      </SheetHeader>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={notifications.length === 0 && { flex: 1 }}>
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <TouchableOpacity 
              key={n.id} 
              onPress={() => handleNotificationPress(n)}
              style={[
                styles.notificationItem, 
                !n.read && (isDark ? styles.unreadItemDark : styles.unreadItem),
                isDark && styles.notificationItemDark
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, (styles as any)[`${n.type}Icon`]]}>
                {getIcon(n.type)}
              </View>
              <View style={styles.content}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemTitle, isDark && styles.itemTitleDark]}>{n.title}</Text>
                  <Text style={styles.time}>{n.time}</Text>
                </View>
                <Text style={[styles.message, isDark && styles.messageDark]} numberOfLines={2}>{n.message}</Text>
                {n.id.startsWith("pending-") && (
                  <Text style={styles.clickToApprove}>Click to open Approval Center</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>Welcome to ClinLab</Text>
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              Your realtime notification center is now active. You'll see clinical updates and case alerts here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SheetContent>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    padding: 0,
    width: "85%",
    backgroundColor: "#FFFFFF",
  },
  sheetContentDark: {
    backgroundColor: "#0F172A",
    borderLeftWidth: 1,
    borderLeftColor: "#1E293B",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    paddingLeft: 20,
    paddingRight: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerDark: {
    borderBottomColor: "#1E293B",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  titleDark: {
    color: "#FFFFFF",
  },
  clearAll: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  list: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  notificationItemDark: {
    borderBottomColor: "#1E293B",
  },
  unreadItem: {
    backgroundColor: "rgba(14, 165, 233, 0.02)",
  },
  unreadItemDark: {
    backgroundColor: "rgba(14, 165, 233, 0.05)",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoIcon: {
    backgroundColor: "rgba(100, 116, 139, 0.1)",
  },
  urgentIcon: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  updateIcon: {
    backgroundColor: "rgba(14, 165, 233, 0.1)",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  itemTitleDark: {
    color: "#FFFFFF",
  },
  time: {
    fontSize: 10,
    color: "#94A3B8",
  },
  message: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
  messageDark: {
    color: "#94A3B8",
  },
  clickToApprove: {
    fontSize: 11,
    color: "#0EA5E9",
    fontWeight: "600",
    marginTop: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  emptyTitleDark: {
    color: "#FFFFFF",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyTextDark: {
    color: "#94A3B8",
  },
});
