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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTranslation } from 'react-i18next';
import { signup, login, saveToken } from '../services/auth';
import { APP_NAME } from '../constants/appConfig';
import { useTheme } from '../context/ThemeContext';

export default function SignupScreen({ onLogin, onGoToLogin }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.logoContainer}>
          {Platform.OS === 'android' ? (
            <Text style={[styles.logoText, { color: '#6366f1' }]}>{APP_NAME}</Text>
          ) : (
            <MaskedView
              maskElement={
                <Text style={styles.logoText}>{APP_NAME}</Text>
              }
            >
              <LinearGradient
                colors={['#5A6CFF', '#8B3DFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.logoText, { opacity: 0 }]}>{APP_NAME}</Text>
              </LinearGradient>
            </MaskedView>
          )}
          <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          {error !== '' && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder={t('signup.usernamePlaceholder')}
            placeholderTextColor={theme.placeholderText}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder={t('signup.emailPlaceholder')}
            placeholderTextColor={theme.placeholderText}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder={t('signup.passwordPlaceholder')}
            placeholderTextColor={theme.placeholderText}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>{t('signup.signupButton')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={onGoToLogin}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              {t('signup.loginLink')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.primaryText,
  },
  subtitle: {
    fontSize: 15,
    color: theme.secondaryText,
    marginTop: 8,
  },
  form: {
    gap: 14,
  },
  errorContainer: {
    backgroundColor: theme.dangerBackground,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
  },
  errorText: {
    color: theme.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.inputBackground,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: theme.primaryText,
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    color: theme.secondaryText,
  },
});
