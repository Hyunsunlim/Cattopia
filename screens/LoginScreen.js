import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { login, googleLogin, saveToken } from '../services/auth';

// Google Sign-In requires a native dev build — stubbed until activated
const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: async () => { throw new Error('Google 로그인은 아직 준비 중이에요.'); },
};

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  secondary: '#3d665a',
  secondaryContainer: '#bce9d9',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  surfaceContainer: '#f0eded',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export default function LoginScreen({ onLogin, onGoToSignup }) {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? userInfo.idToken;
      if (!idToken) throw new Error('Google sign-in failed: no ID token');
      const data = await googleLogin(idToken);
      const token = data.access_token || data.token || '';
      if (token) await saveToken(token);
      onLogin();
    } catch (err) {
      setError(err.message || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('login.validationError'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      const token = data.access_token || data.token || '';
      if (token) await saveToken(token);
      onLogin();
    } catch (err) {
      setError(err.message || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ── */}
          <View style={S.logoSection}>
            <View style={S.catWrap}>
              <View style={S.catGlow} />
              <View style={S.catCircle}>
                <Text style={S.catEmoji}>🐱</Text>
              </View>
            </View>
            <Text style={S.logoText}>Meow</Text>
            <Text style={S.logoSub}>Grow with your cat</Text>
          </View>

          {/* ── Form ── */}
          <View style={S.form}>
            {error !== '' && (
              <View style={S.errorBox}>
                <Text style={S.errorText}>{error}</Text>
              </View>
            )}

            <TextInput
              style={S.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={C.outlineVariant}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />

            <TextInput
              style={S.input}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor={C.outlineVariant}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={[S.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.primaryBtnText}>{t('login.loginButton')}</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={S.divider}>
              <View style={S.dividerLine} />
              <Text style={S.dividerText}>{t('login.orDivider')}</Text>
              <View style={S.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={[S.googleBtn, loading && { opacity: 0.7 }]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.82}
            >
              <GoogleIcon />
              <Text style={S.googleBtnText}>{t('login.googleButton')}</Text>
            </TouchableOpacity>

            {/* Signup link */}
            <TouchableOpacity style={S.linkBtn} onPress={onGoToSignup} activeOpacity={0.7}>
              <Text style={S.linkText}>{t('login.signupLink')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 0,
  },

  // Logo section
  logoSection: { alignItems: 'center', marginBottom: 40 },
  catWrap: { alignItems: 'center', justifyContent: 'center', width: 130, height: 130, marginBottom: 20 },
  catGlow: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,216,190,0.5)',
  },
  catCircle: {
    width: 108, height: 108, borderRadius: 54,
    backgroundColor: C.surface,
    borderWidth: 2.5, borderColor: C.surfaceContainer,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 6,
  },
  catEmoji: { fontSize: 52 },
  logoText: {
    fontFamily: SERIF,
    fontSize: 34, fontWeight: '700',
    color: C.onSurface, letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 14, color: C.outline,
    marginTop: 6, fontStyle: 'italic',
  },

  // Form
  form: { gap: 12 },
  errorBox: {
    backgroundColor: C.errorContainer,
    padding: 12, borderRadius: 12,
  },
  errorText: { color: C.error, fontSize: 13, textAlign: 'center' },
  input: {
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 16, paddingVertical: 15,
    borderRadius: 14, fontSize: 15, color: C.onSurface,
    borderWidth: 1, borderColor: C.outlineVariant,
  },

  // Primary button
  primaryBtn: {
    backgroundColor: C.primary,
    paddingVertical: 17, borderRadius: 99,
    alignItems: 'center', marginTop: 4,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: SERIF },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.outlineVariant },
  dividerText: { marginHorizontal: 14, fontSize: 12, color: C.outline },

  // Google button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: C.surface,
    paddingVertical: 15, borderRadius: 99,
    borderWidth: 1.5, borderColor: C.outlineVariant,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: C.onSurface },

  // Link
  linkBtn: { alignItems: 'center', marginTop: 6, paddingVertical: 4 },
  linkText: { fontSize: 14, color: C.secondary, fontWeight: '500' },
});
