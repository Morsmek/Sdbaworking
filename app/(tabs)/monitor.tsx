import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Plus, Trash2, Bell, Clock, AlertCircle } from 'lucide-react-native';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

interface MonitoredEmail {
  id: string;
  email: string;
  scan_interval: 'daily' | 'hourly' | 'every_10_minutes';
  last_scan: string;
  is_active: boolean;
  created_at: string;
}

interface BreachRecord {
  id: string;
  breach_title: string;
  breach_date: string;
  detected_at: string;
  is_new: boolean;
  pwn_count: number;
}

export default function MonitorScreen() {
  const [monitoredEmails, setMonitoredEmails] = useState<MonitoredEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [scanInterval, setScanInterval] = useState<'daily' | 'hourly' | 'every_10_minutes'>('daily');
  const [newBreachCount, setNewBreachCount] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadMonitoredEmails();
    loadNewBreachCount();
  }, []);

  const loadMonitoredEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('monitored_emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMonitoredEmails(data || []);
    } catch (error) {
      console.error('Error loading monitored emails:', error);
    }
  };

  const loadNewBreachCount = async () => {
    try {
      const { data, error } = await supabase
        .from('breach_records')
        .select('id', { count: 'exact' })
        .eq('is_new', true);

      if (error) throw error;
      setNewBreachCount(data?.length || 0);
    } catch (error) {
      console.error('Error loading breach count:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMonitoredEmails(), loadNewBreachCount()]);
    setRefreshing(false);
  };

  const addMonitoredEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('monitored_emails')
        .insert([
          {
            email: newEmail.trim(),
            scan_interval: scanInterval,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setMonitoredEmails([data, ...monitoredEmails]);
      setNewEmail('');
      setShowAddForm(false);
      Alert.alert('Success', 'Email added to monitoring list');

      // Trigger initial scan
      await scanEmail(data.id, data.email);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add email');
    } finally {
      setLoading(false);
    }
  };

  const scanEmail = async (emailId: string, email: string) => {
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/monitor-breaches`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ monitored_email_id: emailId, email }),
      });

      if (!response.ok) {
        throw new Error('Failed to scan email');
      }

      await loadMonitoredEmails();
      await loadNewBreachCount();
    } catch (error) {
      console.error('Error scanning email:', error);
    }
  };

  const deleteMonitoredEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from('monitored_emails')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMonitoredEmails(monitoredEmails.filter((e) => e.id !== id));
      Alert.alert('Success', 'Email removed from monitoring');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove email');
    }
  };

  const confirmDelete = (id: string, email: string) => {
    Alert.alert(
      'Remove Email',
      `Stop monitoring ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteMonitoredEmail(id) },
      ]
    );
  };

  const getScanIntervalLabel = (interval: string) => {
    switch (interval) {
      case 'every_10_minutes':
        return 'Every 10 min';
      case 'hourly':
        return 'Hourly';
      case 'daily':
        return 'Daily';
      default:
        return interval;
    }
  };

  const getTimeSinceLastScan = (lastScan: string) => {
    const now = new Date();
    const scanDate = new Date(lastScan);
    const diffMs = now.getTime() - scanDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const scanAllEmails = async () => {
    setScanning(true);
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/scan-all-monitored`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan emails');
      }

      await loadMonitoredEmails();
      await loadNewBreachCount();

      if (data.new_breaches > 0) {
        Alert.alert(
          'Scan Complete',
          `Scanned ${data.scanned} email${data.scanned !== 1 ? 's' : ''}. Found ${data.new_breaches} new breach${data.new_breaches !== 1 ? 'es' : ''}!`
        );
      } else {
        Alert.alert(
          'Scan Complete',
          `Scanned ${data.scanned} email${data.scanned !== 1 ? 's' : ''}. No new breaches detected.`
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to scan emails');
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B6B" />
        }>

        <View style={styles.header}>
          <Text style={styles.title}>Email Monitor</Text>
          <Text style={styles.subtitle}>Track breaches for multiple emails</Text>

          {newBreachCount > 0 && (
            <View style={styles.alertBanner}>
              <AlertCircle size={20} color="#E8744F" />
              <Text style={styles.alertText}>
                {newBreachCount} new breach{newBreachCount !== 1 ? 'es' : ''} detected!
              </Text>
            </View>
          )}
        </View>

        {monitoredEmails.length > 0 && (
          <TouchableOpacity
            style={[styles.scanAllButton, scanning && styles.buttonDisabled]}
            onPress={scanAllEmails}
            disabled={scanning}>
            {scanning ? (
              <ActivityIndicator color="#2D5F3F" />
            ) : (
              <>
                <Bell size={20} color="#2D5F3F" />
                <Text style={styles.scanAllButtonText}>Scan All Emails Now</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!showAddForm && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}>
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Email to Monitor</Text>
          </TouchableOpacity>
        )}

        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              placeholderTextColor="#999999"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.formLabel}>Scan Interval</Text>
            <View style={styles.intervalSelector}>
              <TouchableOpacity
                style={[
                  styles.intervalButton,
                  scanInterval === 'every_10_minutes' && styles.intervalButtonActive,
                ]}
                onPress={() => setScanInterval('every_10_minutes')}>
                <Text
                  style={[
                    styles.intervalButtonText,
                    scanInterval === 'every_10_minutes' && styles.intervalButtonTextActive,
                  ]}>
                  Every 10 min
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.intervalButton,
                  scanInterval === 'hourly' && styles.intervalButtonActive,
                ]}
                onPress={() => setScanInterval('hourly')}>
                <Text
                  style={[
                    styles.intervalButtonText,
                    scanInterval === 'hourly' && styles.intervalButtonTextActive,
                  ]}>
                  Hourly
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.intervalButton,
                  scanInterval === 'daily' && styles.intervalButtonActive,
                ]}
                onPress={() => setScanInterval('daily')}>
                <Text
                  style={[
                    styles.intervalButtonText,
                    scanInterval === 'daily' && styles.intervalButtonTextActive,
                  ]}>
                  Daily
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddForm(false);
                  setNewEmail('');
                }}
                disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.buttonDisabled]}
                onPress={addMonitoredEmail}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Email</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.listContainer}>
          {monitoredEmails.length === 0 ? (
            <View style={styles.emptyState}>
              <Bell size={48} color="#CCCCCC" />
              <Text style={styles.emptyStateTitle}>No Monitored Emails</Text>
              <Text style={styles.emptyStateText}>
                Add email addresses to monitor for data breaches
              </Text>
            </View>
          ) : (
            monitoredEmails.map((email) => (
              <View key={email.id} style={styles.emailCard}>
                <View style={styles.emailCardHeader}>
                  <Text style={styles.emailAddress}>{email.email}</Text>
                  <TouchableOpacity
                    onPress={() => confirmDelete(email.id, email.email)}
                    style={styles.deleteButton}>
                    <Trash2 size={18} color="#D64545" />
                  </TouchableOpacity>
                </View>

                <View style={styles.emailCardFooter}>
                  <View style={styles.infoRow}>
                    <Clock size={14} color="#666666" />
                    <Text style={styles.infoText}>
                      {getScanIntervalLabel(email.scan_interval)}
                    </Text>
                  </View>

                  <Text style={styles.lastScan}>
                    Last scan: {getTimeSinceLastScan(email.last_scan)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginTop: 40,
    marginBottom: 24,
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
  },
  alertBanner: {
    backgroundColor: '#FFF5F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#E8744F',
  },
  alertText: {
    fontSize: 14,
    color: '#E8744F',
    fontWeight: '600',
    marginLeft: 8,
  },
  scanAllButton: {
    backgroundColor: '#F0F9F4',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2D5F3F',
  },
  scanAllButtonText: {
    color: '#2D5F3F',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    marginBottom: 16,
  },
  intervalSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  intervalButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  intervalButtonActive: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B6B',
  },
  intervalButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  intervalButtonTextActive: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  listContainer: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  emailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  emailAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  deleteButton: {
    padding: 4,
  },
  emailCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
  },
  lastScan: {
    fontSize: 12,
    color: '#999999',
  },
});
