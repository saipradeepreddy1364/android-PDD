import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import {
  BarChart3,
  Clock,
  Activity,
  Target
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const Insights = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    completed: 0,
  });

  React.useEffect(() => {
    const fetchMetrics = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || 'doctor';

      let query = supabase.from('cases').select('status');
      if (role === 'organization') {
        query = query.eq('org_id', user.id);
      } else {
        query = query.eq('doctor_id', user.id);
      }

      const { data } = await query;

      if (data) {
        setMetrics({
          total: data.length,
          active: data.filter(c => c.status === 'active' || c.status === 'in-progress').length,
          completed: data.filter(c => c.status === 'completed').length,
        });
      }
      setLoading(false);
    };

    fetchMetrics();
  }, []);

  const stats = [
    { label: "Total Cases", value: metrics.total.toString(), icon: Activity, color: "#0EA5E9" },
    { label: "Active Cases", value: metrics.active.toString(), icon: Clock, color: "#8B5CF6" },
    { label: "Completed Cases", value: metrics.completed.toString(), icon: Target, color: "#10B981" },
  ];

  return (
    <AppLayout>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Clinical Insights</Text>
            <Text style={styles.subtitle}>Your practice performance & AI impact</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.iconBox, { backgroundColor: `${stat.color}15` }]}>
                <stat.icon size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{loading ? "-" : stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>AI Assistant Impact</Text>
            <Text style={styles.heroText}>
              Your use of the AI Clinical Guide has grown significantly.
              You are currently ranked in the top 10% of tech-enabled clinicians in your region.
            </Text>
            <TouchableOpacity style={styles.heroButton}>
              <Text style={styles.heroButtonText}>View Detailed Report</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroGraphic}>
            <BarChart3 size={80} color="#FFFFFF" opacity={0.8} />
          </View>
        </View>
      </ScrollView>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  heroCard: {
    backgroundColor: "#0EA5E9",
    borderRadius: 24,
    padding: 24,
    flexDirection: "row",
    overflow: "hidden",
  },
  heroContent: {
    flex: 1,
    zIndex: 2,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  heroText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 20,
    marginBottom: 16,
    paddingRight: 20,
  },
  heroButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  heroButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0EA5E9",
  },
  heroGraphic: {
    position: "absolute",
    right: -20,
    bottom: -20,
    zIndex: 1,
  },
});

export default Insights;