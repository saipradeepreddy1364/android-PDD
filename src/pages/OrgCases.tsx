import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, AlertCircle, FileText, ChevronRight, Filter } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import AppLayout from "@/components/AppLayout";

const OrgCases = () => {
  const navigation = useNavigation<any>();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCases = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('cases')
          .select('*')
          .eq('org_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setCases(data);
        }
      }
      setLoading(false);
    };

    fetchCases();
    const interval = setInterval(fetchCases, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredCases = cases.filter(c => 
    c.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    c.doctor_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.tooth_number?.toString().includes(search)
  );

  return (
    <AppLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Clinical Cases</Text>
            <Text style={styles.subtitle}>{cases.length} total entries</Text>
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Filter size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <TextInput 
            placeholder="Search by patient, doctor or tooth..." 
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 40 }} />
          ) : filteredCases.length > 0 ? (
            filteredCases.map((c) => (
              <TouchableOpacity 
                key={c.id} 
                onPress={() => navigation.navigate("Patients", { screen: "PatientDetail", params: { id: c.id } })}
                style={styles.caseCard}
              >
                <View style={[styles.statusLine, { backgroundColor: c.is_urgent ? "#EF4444" : "#0EA5E9" }]} />
                <View style={styles.cardContent}>
                  <View style={styles.row}>
                    <Text style={styles.patientName}>{c.patient_name}</Text>
                    <View style={[
                      styles.badge, 
                      { backgroundColor: 
                        c.status === 'in-progress' ? "#E0F2FE" : 
                        c.status.includes('lab') ? "#F5F3FF" :
                        c.status.includes('checkup') ? "#ECFDF5" : "#F1F5F9" 
                      }
                    ]}>
                      <Text style={[
                        styles.badgeText, 
                        { color: 
                          c.status === 'in-progress' ? "#0369A1" : 
                          c.status.includes('lab') ? "#6D28D9" :
                          c.status.includes('checkup') ? "#059669" : "#475569" 
                        }
                      ]}>
                        {c.status.replace('-', ' ')}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Doctor</Text>
                      <Text style={styles.detailValue}>{c.doctor_name || "N/A"}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Tooth</Text>
                      <Text style={styles.detailValue}>#{c.tooth_number || "All"}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>{new Date(c.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={18} color="#CBD5E1" />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.empty}>
              <FileText size={48} color="#E2E8F0" />
              <Text style={styles.emptyText}>No cases found matching your criteria.</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </AppLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
  },
  list: {
    gap: 12,
  },
  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  statusLine: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 8,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailsRow: {
    flexDirection: "row",
    gap: 20,
  },
  detailItem: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  empty: {
    padding: 60,
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  }
});

export default OrgCases;
