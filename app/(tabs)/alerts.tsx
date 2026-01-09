import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, CheckCircle, Trash2, Eye } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface BreachAlert {
  id: string;
  monitored_email_id: string;
  breach_name: string;
  breach_title: string;
  breach_date: string;
  detected_at: string;
  is_new: boolean;
  pwn_count: number;
  data_classes: string[];
  email?: string;
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<BreachAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const { data: breachData, error: breachError } = await supabase
        .from('breach_records')
        .select('*, monitored_emails:monitored_email_id(email)')
        .order('detected_at', { ascending: false });

      if (breachError) throw breachError;

      const alertsWithEmail = breachData?.map((breach: any) => ({
        ...breach,
        email: breach.monitored_emails?.email,
      })) || [];

      setAlerts(alertsWithEmail);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('breach_records')
        .update({ is_new: false })
        .eq('id', id);

      if (error) throw error;

      setAlerts(alerts.map((alert) =>
        alert.id === id ? { ...alert, is_new: false } : alert
      ));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('breach_records')
        .update({ is_new: false })
        .eq('is_new', true);

      if (error) throw error;

      setAlerts(alerts.map((alert) => ({ ...alert, is_new: false })));
      Alert.alert('Success', 'All alerts marked as read');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark all as read');
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      const { error } = await supabase
        .from('breach_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlerts(alerts.filter((alert) => alert.id !== id));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete alert');
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAlert(id) },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatBreachDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const newAlertsCount = alerts.filter((a) => a.is_new).length;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>Breach Alerts</Text>
        <Text style={styles.subtitle}>
          {newAlertsCount > 0
            ? `${newAlertsCount} new alert${newAlertsCount !== 1 ? 's' : ''}`
            : 'No new alerts'}
        </Text>

        {newAlertsCount > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Eye size={16} color="#2D5F3F" />
            <Text style={styles.markAllButtonText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B6B" />
        }>

        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle size={64} color="#2D5F3F" />
            <Text style={styles.emptyStateTitle}>No Alerts</Text>
            <Text style={styles.emptyStateText}>
              You'll be notified here when new breaches are detected for your monitored emails
            </Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View
              key={alert.id}
              style={[styles.alertCard, alert.is_new && styles.alertCardNew]}>

              <View style={styles.alertHeader}>
                <View style={styles.alertHeaderLeft}>
                  {alert.is_new ? (
                    <AlertTriangle size={24} color="#E8744F" />
                  ) : (
                    <AlertTriangle size={24} color="#999999" />
                  )}
                  <View style={styles.alertHeaderText}>
                    <Text style={[styles.alertTitle, alert.is_new && styles.alertTitleNew]}>
                      {alert.breach_title}
                    </Text>
                    {alert.email && (
                      <Text style={styles.alertEmail}>{alert.email}</Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => confirmDelete(alert.id)}
                  style={styles.deleteButton}>
                  <Trash2 size={18} color="#D64545" />
                </TouchableOpacity>
              </View>

              <Text style={styles.alertDate}>
                Breach date: {formatBreachDate(alert.breach_date)}
              </Text>

              <Text style={styles.alertPwnCount}>
                {alert.pwn_count.toLocaleString()} accounts affected
              </Text>

              {alert.data_classes && alert.data_classes.length > 0 && (
                <View style={styles.dataClassesContainer}>
                  <Text style={styles.dataClassesLabel}>Compromised data:</Text>
                  <View style={styles.tags}>
                    {alert.data_classes.map((dataClass, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{dataClass}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.alertFooter}>
                <Text style={styles.detectedAt}>
                  Detected {formatDate(alert.detected_at)}
                </Text>

                {alert.is_new && (
                  <TouchableOpacity
                    onPress={() => markAsRead(alert.id)}
                    style={styles.markReadButton}>
                    <Text style={styles.markReadButtonText}>Mark as read</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D5F3F',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  markAllButtonText: {
    fontSize: 14,
    color: '#2D5F3F',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 21,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  alertCardNew: {
    borderLeftWidth: 4,
    borderLeftColor: '#E8744F',
    backgroundColor: '#FFF9F7',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  alertHeaderText: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  alertTitleNew: {
    color: '#E8744F',
    fontWeight: 'bold',
  },
  alertEmail: {
    fontSize: 13,
    color: '#666666',
  },
  deleteButton: {
    padding: 4,
  },
  alertDate: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  alertPwnCount: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  dataClassesContainer: {
    marginTop: 8,
  },
  dataClassesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#FFF5F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E8744F',
  },
  tagText: {
    fontSize: 11,
    color: '#E8744F',
    fontWeight: '500',
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detectedAt: {
    fontSize: 12,
    color: '#999999',
  },
  markReadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F9F4',
    borderRadius: 6,
  },
  markReadButtonText: {
    fontSize: 12,
    color: '#2D5F3F',
    fontWeight: '600',
  },
});
