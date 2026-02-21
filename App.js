import { useState, useEffect, useCallback, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Animated } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RootNavigator from './navigation/HomeStack';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import PrivacyOnboardingModal from './components/PrivacyOnboardingModal';
import { getToken, removeToken, getMe } from './services/auth';
import {
  registerForPushNotificationsAsync,
  scheduleMultipleNotifications,
} from './utils/notifications';

export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState('login');
  const [userName, setUserName] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showMain, setShowMain] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token !== null) {
          const user = await getMe(token);
          setUserName(user.username || '');
          setIsLoggedIn(true);
        }
      } catch (e) {
        await removeToken();
      } finally {
        setIsLoading(false);
      }

      // Restore scheduled notifications on app start
      try {
        await registerForPushNotificationsAsync();
        const raw = await AsyncStorage.getItem('settings');
        if (raw) {
          const settings = JSON.parse(raw);
          if (settings.reminderEnabled) {
            const times = Array.isArray(settings.reminderTimes)
              ? settings.reminderTimes
              : settings.reminderTime
                ? [settings.reminderTime]
                : ['21:00'];
            await scheduleMultipleNotifications(
              times,
              settings.notificationPreview || 'How was your day?'
            );
          }
        }
      } catch (e) {
        console.log('Failed to restore notifications:', e);
      }
    })();
  }, []);

  // Fade in when transitioning to main screen
  useEffect(() => {
    if (isLoggedIn && !isTransitioning && !isLoading) {
      setShowMain(true);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoggedIn, isTransitioning, isLoading]);

  const handleLogin = useCallback(async () => {
    setIsTransitioning(true);
    try {
      const token = await getToken();
      if (token) {
        const user = await getMe(token);
        setUserName(user.username || '');
      }
    } catch (e) {
      // ignore
    }

    // Check onboarding only on fresh login
    try {
      const seen = await AsyncStorage.getItem('hasSeenPrivacyOnboarding');
      if (seen !== 'true') {
        setShowOnboarding(true);
      }
    } catch (e) {
      // ignore
    }

    setIsLoggedIn(true);
    setIsTransitioning(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await removeToken();
    setUserName('');
    setIsLoggedIn(false);
    setShowMain(false);
    setAuthScreen('login');
    fadeAnim.setValue(0);
  }, []);

  const handleOnboardingComplete = useCallback(async (useAI) => {
    await AsyncStorage.setItem('hasSeenPrivacyOnboarding', 'true');
    await AsyncStorage.setItem('useAIAnalysis', useAI.toString());
    setShowOnboarding(false);
  }, []);

  if (!fontsLoaded || isLoading || isTransitioning) {
    return (
      <SafeAreaProvider>
        <View style={loadingStyles.container}>
          <Text style={loadingStyles.logo}>LucidNote</Text>
          <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 24 }} />
          {isTransitioning && (
            <Text style={loadingStyles.message}>Signing in...</Text>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaProvider>
        {authScreen === 'signup' ? (
          <SignupScreen
            onLogin={handleLogin}
            onGoToLogin={() => setAuthScreen('login')}
          />
        ) : (
          <LoginScreen
            onLogin={handleLogin}
            onGoToSignup={() => setAuthScreen('signup')}
          />
        )}
      </SafeAreaProvider>
    );
  }

  if (showMain) {
    return (
      <SafeAreaProvider>
        <PrivacyOnboardingModal
          visible={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <NavigationContainer>
            <RootNavigator onLogout={handleLogout} />
          </NavigationContainer>
        </Animated.View>
      </SafeAreaProvider>
    );
  }

  return null;
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f5f5',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  message: {
    marginTop: 16,
    fontSize: 15,
    color: '#999',
  },
});
