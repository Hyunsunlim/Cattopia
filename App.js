import { useState, useEffect, useCallback, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Animated, Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { initI18n } from './i18n';
import RootNavigator from './navigation/HomeStack';
import { APP_NAME } from './constants/appConfig';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CatNameProvider, useCatName } from './context/CatNameContext';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import PrivacyOnboardingModal from './components/PrivacyOnboardingModal';
import CatNameSetupScreen from './screens/CatNameSetupScreen';
import { getToken, removeToken, getMe } from './services/auth';
import { acceptInvite } from './services/friends';
import { migrateLocalNotesIfNeeded, createNote, getCachedNotes } from './services/notes';
import {
  registerForPushNotificationsAsync,
  scheduleMultipleNotifications,
  scheduleWeeklyNotifications,
  setupNotificationCategories,
  scheduleNotePromptNotification,
  scheduleWriteReminderNotification,
} from './utils/notifications';

const navigationRef = createNavigationContainerRef();

const KEYWORD_MAP = {
  good:     { keyword: 'Good',     emoji: '😊', emotion: 'joy' },
  bad:      { keyword: 'Not great', emoji: '😔', emotion: 'sadness' },
  stressed: { keyword: 'Stressed', emoji: '😤', emotion: 'anger' },
  tired:    { keyword: 'Tired',    emoji: '😴', emotion: 'neutral' },
};

function AppContent() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { setCatName } = useCatName();
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
  const [pendingInvite, setPendingInvite] = useState(null);
  const [showCatNameSetup, setShowCatNameSetup] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token !== null) {
          try {
            const user = await getMe(token);
            setUserName(user.username || '');
          } catch (e) {
            // 타임아웃이나 네트워크 오류 시 토큰은 유지하고 로그인 상태 유지
            // 401 Unauthorized일 때만 토큰 제거
            const isAuthError = e.message && (
              e.message.includes('401') ||
              e.message.includes('Unauthorized') ||
              e.message.toLowerCase().includes('invalid token') ||
              e.message.toLowerCase().includes('could not validate')
            );
            if (isAuthError) {
              await removeToken();
            } else {
              // 네트워크/타임아웃 오류: 토큰 유지, 오프라인으로 로그인 유지
              setIsLoggedIn(true);
              setIsLoading(false);
              return;
            }
          }
          setIsLoggedIn(true);
        }
      } catch (e) {
        // getToken 자체 실패
      } finally {
        setIsLoading(false);
      }

      // Migrate local notes to server on first login
      migrateLocalNotesIfNeeded().catch(() => {});

      // Restore scheduled notifications on app start
      try {
        await registerForPushNotificationsAsync();
        await setupNotificationCategories();
        const raw = await AsyncStorage.getItem('settings');
        if (raw) {
          const settings = JSON.parse(raw);
          if (settings.reminderEnabled) {
            const times = Array.isArray(settings.reminderTimes)
              ? settings.reminderTimes
              : settings.reminderTime
                ? [settings.reminderTime]
                : ['21:00'];
            if (settings.useAutoPrompts !== false) {
              await scheduleWeeklyNotifications(times);
            } else {
              const oldDefault = 'How was your day?';
              const defaultMsg = 'Choco is waiting 🐱 오늘 이야기 들려줄래요?';
              const msg = (settings.notificationPreview && settings.notificationPreview !== oldDefault)
                ? settings.notificationPreview
                : defaultMsg;
              await scheduleMultipleNotifications(times, msg);
            }
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

  // Handle notification action button responses
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data || {};

      if (KEYWORD_MAP[actionIdentifier]) {
        const { keyword, emoji, emotion } = KEYWORD_MAP[actionIdentifier];
        const newDiary = {
          id: Date.now().toString(),
          title: `${emoji} ${keyword}`,
          content: keyword,
          date: new Date().toLocaleDateString('en-US'),
          timestamp: new Date().toISOString(),
          emotion,
          emoji,
        };
        try {
          await createNote(newDiary);
          await scheduleNotePromptNotification(newDiary.id);
        } catch (e) {
          console.error('Failed to save keyword diary:', e);
        }
      } else if (actionIdentifier === 'five-min' && data.diaryId) {
        await scheduleWriteReminderNotification(5, data.diaryId);
      } else if (actionIdentifier === 'one-hour' && data.diaryId) {
        await scheduleWriteReminderNotification(60, data.diaryId);
      } else if (
        actionIdentifier === 'now' ||
        (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && data.diaryId)
      ) {
        const diaryId = data.diaryId;
        if (diaryId) {
          const navigate = () => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('MainTabs', {
                screen: 'Home',
                params: { openEditNote: diaryId },
              });
            } else {
              setTimeout(navigate, 200);
            }
          };
          navigate();
        }
      } else if (
        actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER &&
        data.type === 'weekly-report'
      ) {
        const navigate = () => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('Report');
          } else {
            setTimeout(navigate, 200);
          }
        };
        navigate();
      }
    });

    return () => subscription.remove();
  }, []);

  const processInviteLink = useCallback(async (params) => {
    if (!params?.code) return;
    try {
      const friend = await acceptInvite(params.code);
      Alert.alert(
        t('privacy.inviteSuccessTitle'),
        t('privacy.inviteSuccessMessage', { name: friend.username }),
        [{ text: t('privacy.inviteConfirm') }]
      );
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Already friends')) return;
      const isTokenError = msg.toLowerCase().includes('invalid token') || msg.includes('401');
      Alert.alert(
        t('privacy.inviteErrorTitle'),
        isTokenError
          ? t('privacy.inviteErrorExpired')
          : (msg || t('privacy.inviteErrorDefault')),
        [{ text: t('privacy.inviteConfirm') }]
      );
    }
  }, [t]);

  // Deep link handler
  const handledUrlsRef = useRef(new Set());
  useEffect(() => {
    const handleUrl = (url) => {
      if (!url) return;
      if (handledUrlsRef.current.has(url)) return;
      try {
        const parsed = Linking.parse(url);
        if (parsed.hostname === 'invite') {
          const params = parsed.queryParams ?? {};
          if (params.code) handledUrlsRef.current.add(url);
          if (isLoggedIn) {
            processInviteLink(params);
          } else {
            setPendingInvite(params);
          }
        }
      } catch (e) {}
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [isLoggedIn, processInviteLink]);

  // Process invite after login
  useEffect(() => {
    if (isLoggedIn && pendingInvite) {
      processInviteLink(pendingInvite);
      setPendingInvite(null);
    }
  }, [isLoggedIn, pendingInvite, processInviteLink]);

  const handleLogin = useCallback(async () => {
    setIsTransitioning(true);
    try {
      const token = await getToken();
      if (token) {
        const user = await getMe(token);
        setUserName(user.username || '');

        // 서버에 cat_name이 있으면 로컬에 동기화
        if (user.cat_name) {
          const raw = await AsyncStorage.getItem('settings');
          const settings = raw ? JSON.parse(raw) : {};
          if (!settings.catName) {
            await AsyncStorage.setItem('settings', JSON.stringify({ ...settings, catName: user.cat_name }));
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // Check privacy onboarding
    try {
      const seen = await AsyncStorage.getItem('hasSeenPrivacyOnboarding');
      if (seen !== 'true') setShowOnboarding(true);
    } catch (e) {}

    // Check cat name setup (로컬 + 서버 둘 다 없으면 설정 화면)
    try {
      const raw = await AsyncStorage.getItem('settings');
      const settings = raw ? JSON.parse(raw) : {};
      if (!settings.catName) setShowCatNameSetup(true);
    } catch (e) {}

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

  const handleCatNameComplete = useCallback(async (name) => {
    await setCatName(name);
    setShowCatNameSetup(false);
  }, [setCatName]);

  if (!fontsLoaded || isLoading || isTransitioning) {
    return (
      <SafeAreaProvider>
        <View style={loadingStyles.container}>
          {/* Cat glow */}
          <View style={loadingStyles.catWrap}>
            <View style={loadingStyles.catGlow} />
            <View style={loadingStyles.catCircle}>
              <Text style={loadingStyles.catEmoji}>🐱</Text>
            </View>
          </View>
          <Text style={loadingStyles.logo}>{APP_NAME}</Text>
          <Text style={loadingStyles.sub}>Grow with your cat</Text>
          <ActivityIndicator
            size="small"
            color="#755844"
            style={{ marginTop: 32 }}
          />
          {isTransitioning && (
            <Text style={loadingStyles.message}>{t('app.signingIn')}</Text>
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

  if (showCatNameSetup) {
    return (
      <SafeAreaProvider>
        <CatNameSetupScreen onComplete={handleCatNameComplete} />
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
          <NavigationContainer ref={navigationRef}>
            <RootNavigator onLogout={handleLogout} />
          </NavigationContainer>
        </Animated.View>
      </SafeAreaProvider>
    );
  }

  return null;
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) return null;

  return (
    <ThemeProvider>
      <CatNameProvider>
        <AppContent />
      </CatNameProvider>
    </ThemeProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fbf9f8',
  },
  catWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 130,
    height: 130,
    marginBottom: 24,
  },
  catGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,216,190,0.5)',
  },
  catCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#f0eded',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#755844',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  catEmoji: { fontSize: 52 },
  logo: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 34,
    fontWeight: '700',
    color: '#1b1c1c',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14,
    color: '#81756d',
    marginTop: 6,
    fontStyle: 'italic',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#81756d',
  },
});
