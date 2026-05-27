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
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { signup, login, saveToken } from '../services/auth';
import { trackSignUp } from '../services/analytics';
import { APP_NAME } from '../constants/appConfig';

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

export default function SignupScreen({ onLogin, onGoToLogin }) {
  const { t } = useTranslation();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError(t('signup.validationError'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signup(email.trim(), password, username.trim());
      const data = await login(email.trim(), password);
      const token = data.access_token || data.token || '';
      if (typeof token === 'string' && token.length > 0) {
        await saveToken(token);
      }
      trackSignUp(data.user_id ?? email.trim(), email.trim());
      Alert.alert(
        t('signup.welcomeTitle'),
        t('signup.welcomeMessage', { username: username.trim() }),
        [{ text: t('signup.getStarted'), onPress: onLogin }],
      );
    } catch (err) {
      setError(err.message || t('signup.signupFailed'));
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
            <Text style={S.logoText}>{APP_NAME}</Text>
            <Text style={S.logoSub}>{t('signup.subtitle')}</Text>
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
              placeholder={t('signup.usernamePlaceholder')}
              placeholderTextColor={C.outlineVariant}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TextInput
              style={S.input}
              placeholder={t('signup.emailPlaceholder')}
              placeholderTextColor={C.outlineVariant}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <TextInput
              style={S.input}
              placeholder={t('signup.passwordPlaceholder')}
              placeholderTextColor={C.outlineVariant}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={[S.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.primaryBtnText}>{t('signup.signupButton')}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={S.linkBtn} onPress={onGoToLogin} activeOpacity={0.7}>
              <Text style={S.linkText}>{t('signup.loginLink')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },

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

  primaryBtn: {
    backgroundColor: C.primary,
    paddingVertical: 17, borderRadius: 99,
    alignItems: 'center', marginTop: 4,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: SERIF },

  linkBtn: { alignItems: 'center', marginTop: 6, paddingVertical: 4 },
  linkText: { fontSize: 14, color: C.secondary, fontWeight: '500' },
});
