import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, CheckCircle } from 'lucide-react-native';

interface Breach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
}

interface BreachResult {
  breached: boolean;
  breaches: Breach[];
  error?: string;
}

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BreachResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkBreaches = async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-breaches`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to check breaches');
        return;
      }

      setResult(data);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Image
            source={require('@/assets/images/untitled_(500_x_500_px)_20260104_041744_0000.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Data Breach Alert</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999999"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={checkBreaches}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Check for Breaches</Text>
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <AlertTriangle size={24} color="#D64545" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {result && !result.breached && (
          <View style={styles.successCard}>
            <CheckCircle size={32} color="#2D5F3F" />
            <Text style={styles.successTitle}>Good News!</Text>
            <Text style={styles.successText}>
              This email address has not been found in any known data breaches.
            </Text>
          </View>
        )}

        {result && result.breached && result.breaches.length > 0 && (
          <View style={styles.breachesContainer}>
            <View style={styles.breachesHeader}>
              <AlertTriangle size={28} color="#E8744F" />
              <Text style={styles.breachesTitle}>
                Found in {result.breaches.length} breach{result.breaches.length !== 1 ? 'es' : ''}
              </Text>
            </View>

            {result.breaches.map((breach, index) => (
              <View key={index} style={styles.breachCard}>
                <Text style={styles.breachName}>{breach.Title}</Text>
                {breach.Domain && (
                  <Text style={styles.breachDomain}>{breach.Domain}</Text>
                )}
                <Text style={styles.breachDate}>
                  Breached: {formatDate(breach.BreachDate)}
                </Text>
                <Text style={styles.breachPwnCount}>
                  Affected accounts: {breach.PwnCount.toLocaleString()}
                </Text>
                {breach.DataClasses && breach.DataClasses.length > 0 && (
                  <View style={styles.dataClassesContainer}>
                    <Text style={styles.dataClassesLabel}>
                      Compromised data:
                    </Text>
                    <View style={styles.tags}>
                      {breach.DataClasses.map((dataClass, idx) => (
                        <View key={idx} style={styles.tag}>
                          <Text style={styles.tagText}>{dataClass}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>What should I do?</Text>
              <Text style={styles.recommendationText}>
                • Change your password immediately{'\n'}
                • Enable two-factor authentication{'\n'}
                • Monitor your accounts for suspicious activity{'\n'}
                • Consider using a password manager
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
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
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#D64545',
  },
  errorText: {
    color: '#D64545',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  successCard: {
    backgroundColor: '#F0F9F4',
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#2D5F3F',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D5F3F',
    marginTop: 12,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#2D5F3F',
    textAlign: 'center',
    lineHeight: 21,
  },
  breachesContainer: {
    marginTop: 16,
  },
  breachesHeader: {
    backgroundColor: '#FFF5F0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E8744F',
  },
  breachesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8744F',
    marginLeft: 12,
  },
  breachCard: {
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
  breachName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  breachDomain: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  breachDate: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  breachPwnCount: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  dataClassesContainer: {
    marginTop: 8,
  },
  dataClassesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#FFF5F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E8744F',
  },
  tagText: {
    fontSize: 12,
    color: '#E8744F',
    fontWeight: '500',
  },
  recommendationCard: {
    backgroundColor: '#F0F9F4',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2D5F3F',
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D5F3F',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#2D5F3F',
    lineHeight: 21,
  },
});
