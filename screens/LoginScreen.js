import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Svg, Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { getRandomBytes } from 'expo-crypto';
import { login, googleLogin, saveToken } from '../services/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '989988743907-1rb2kb430v789dpsvu47mlpi94lqmm1q.apps.googleusercontent.com';
const PROXY_REDIRECT_URI = 'https://auth.expo.io/@hyunsun/BetterDiary';

export default function LoginScreen({ onLogin, onGoToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      // Expo Go local URI (browser return address)
      const returnUrl = AuthSession.makeRedirectUri();
      const nonce = generateRandomString(32);
      const state = generateRandomString(16);

      // Google OAuth URL - get id_token via implicit flow
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(PROXY_REDIRECT_URI)}` +
        '&response_type=id_token' +
        '&scope=openid+profile+email' +
        `&nonce=${nonce}` +
        `&state=${state}`;

      // Proxy start URL: proxy redirects to Google, then returns to returnUrl after callback
      const proxyStartUrl =
        `https://auth.expo.io/@hyunsun/BetterDiary/start` +
        `?authUrl=${encodeURIComponent(authUrl)}` +
        `&returnUrl=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(proxyStartUrl, returnUrl);

      if (result.type === 'success' && result.url) {
        // id_token can come as URL fragment(#) or query param(?)
        const idToken =
          parseQueryParam(result.url, 'id_token') ||
          parseFragmentParam(result.url, 'id_token');

        if (idToken) {
          await handleGoogleLogin(idToken);
        } else {
          console.error('No id_token in result URL:', result.url);
          setError('Failed to get ID token from Google.');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setGoogleLoading(false);
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async (idToken) => {
    const data = await googleLogin(idToken);
    const token = data.access_token || data.token || '';
    if (token) {
      await saveToken(token);
    }
    onLogin();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email/username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await login(email.trim(), password);
      const token = data.access_token || data.token || '';
      if (token) {
        await saveToken(token);
      }
      onLogin();
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.logoContainer}>
          {Platform.OS === 'android' ? (
            <Text style={[styles.logoText, { color: '#6366f1' }]}>LucidNote</Text>
          ) : (
            <MaskedView
              maskElement={<Text style={styles.logoText}>LucidNote</Text>}
            >
              <LinearGradient
                colors={['#5A6CFF', '#8B3DFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.logoText, { opacity: 0 }]}>
                  LucidNote
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
          <Text style={styles.subtitle}>Your AI Emotion Note</Text>
        </View>

        <View style={styles.form}>
          {error !== '' && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email or Username"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#333" />
            ) : (
              <View style={styles.googleButtonContent}>
                <GoogleIcon />
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={onGoToSignup}
          >
            <Text style={styles.linkText}>
              Don't have an account? Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const randomBytes = getRandomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

function parseQueryParam(url, param) {
  const match = url.match(new RegExp(`[?&]${param}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function parseFragmentParam(url, param) {
  const fragmentIndex = url.indexOf('#');
  if (fragmentIndex === -1) return null;
  const fragment = url.substring(fragmentIndex + 1);
  const match = fragment.match(new RegExp(`(?:^|&)${param}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f5f5' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoText: { fontSize: 36, fontWeight: 'bold' },
  subtitle: { fontSize: 15, color: '#999', marginTop: 8 },
  form: { gap: 14 },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: 'white', fontSize: 17, fontWeight: '600' },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: '#999' },
  googleButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  linkButton: { alignItems: 'center', marginTop: 8 },
  linkText: { fontSize: 14, color: '#999' },
});
