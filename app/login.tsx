import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

export default function LoginScreen() {
  const { signInWithGoogle, user, loading } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in:', error);
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/untitled_(500_x_500_px)_20260104_041744_0000.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>SDBA</Text>
        <Text style={styles.subtitle}>Stagic Data Breach Alert</Text>
        <Text style={styles.description}>
          Monitor your email addresses for data breaches and get instant alerts when your information is compromised.
        </Text>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={signingIn}>
          {signingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By signing in, you agree to monitor your email addresses for security breaches.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    color: '#7F8C8D',
    marginBottom: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: '#95A5A6',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 22,
    maxWidth: 400,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 12,
    color: '#BDC3C7',
    textAlign: 'center',
    maxWidth: 350,
  },
});
