import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_NAME } from '../constants/appConfig';
import i18n from '../i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('mood-check', [
    { identifier: 'good', buttonTitle: i18n.t('notifications.moodGood'), options: { opensAppToForeground: false } },
    { identifier: 'bad', buttonTitle: i18n.t('notifications.moodNotGreat'), options: { opensAppToForeground: false } },
    { identifier: 'stressed', buttonTitle: i18n.t('notifications.moodStressed'), options: { opensAppToForeground: false } },
    { identifier: 'tired', buttonTitle: i18n.t('notifications.moodTired'), options: { opensAppToForeground: false } },
  ]);

  await Notifications.setNotificationCategoryAsync('note-prompt', [
    { identifier: 'now', buttonTitle: i18n.t('notifications.promptNow'), options: { opensAppToForeground: true } },
    { identifier: 'five-min', buttonTitle: i18n.t('notifications.promptFiveMin'), options: { opensAppToForeground: false } },
    { identifier: 'one-hour', buttonTitle: i18n.t('notifications.promptOneHour'), options: { opensAppToForeground: false } },
  ]);
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: 'Daily Reminder',
      importance: Notifications.AndroidImportance.HIGH,
      sound: true,
    });
    await Notifications.setNotificationChannelAsync('quick-actions', {
      name: 'Quick Actions',
      importance: Notifications.AndroidImportance.HIGH,
      sound: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

async function getCatName() {
  const raw = await AsyncStorage.getItem('settings');
  const settings = raw ? JSON.parse(raw) : {};
  return settings.catName || 'Choco';
}

const getWeekdayMessages = (name) => [
  i18n.t('notifications.autoPromptSun', { catName: name }),
  i18n.t('notifications.autoPromptMon', { catName: name }),
  i18n.t('notifications.autoPromptTue', { catName: name }),
  i18n.t('notifications.autoPromptWed', { catName: name }),
  i18n.t('notifications.autoPromptThu', { catName: name }),
  i18n.t('notifications.autoPromptFri', { catName: name }),
  i18n.t('notifications.autoPromptSat', { catName: name }),
];

export async function scheduleWeeklyNotifications(times) {
  await cancelAllNotifications();
  const catName = await getCatName();
  const messages = getWeekdayMessages(catName);
  const ids = [];
  for (const time of times) {
    const [hours, minutes] = time.split(':').map(Number);
    // expo-notifications: weekday 1=Sun, 2=Mon, ..., 7=Sat
    for (let weekday = 1; weekday <= 7; weekday++) {
      const body = messages[weekday - 1];
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: APP_NAME,
          body,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: hours,
          minute: minutes,
          channelId: Platform.OS === 'android' ? 'daily-reminder' : undefined,
        },
      });
      ids.push(id);
    }
  }
  await AsyncStorage.setItem('notificationIds', JSON.stringify(ids));
  return ids;
}

export async function scheduleMultipleNotifications(times, message) {
  await cancelAllNotifications();

  const ids = [];
  for (const time of times) {
    const [hours, minutes] = time.split(':').map(Number);
    const body = typeof message === 'function' ? message(time, hours) : message;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: APP_NAME,
        body,
        sound: true,
        categoryIdentifier: 'mood-check',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
        channelId: Platform.OS === 'android' ? 'daily-reminder' : undefined,
      },
    });
    ids.push(id);
  }

  await AsyncStorage.setItem('notificationIds', JSON.stringify(ids));
  return ids;
}

// Keep for backward compat
export async function scheduleDailyNotification(time, message) {
  return scheduleMultipleNotifications([time], message);
}

export async function scheduleNotePromptNotification(diaryId) {
  const catName = await getCatName();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: APP_NAME,
      body: i18n.t('notifications.notePromptBody', { catName }),
      sound: true,
      categoryIdentifier: 'note-prompt',
      data: { diaryId, type: 'note-prompt' },
    },
    trigger: {
      seconds: 2,
      channelId: Platform.OS === 'android' ? 'quick-actions' : undefined,
    },
  });
}

export async function scheduleWriteReminderNotification(delayMinutes, diaryId) {
  const catName = await getCatName();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: APP_NAME,
      body: i18n.t('notifications.writeReminderBody', { catName }),
      sound: true,
      data: { diaryId, type: 'write-reminder' },
    },
    trigger: {
      seconds: delayMinutes * 60,
      channelId: Platform.OS === 'android' ? 'quick-actions' : undefined,
    },
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem('notificationIds');
  await AsyncStorage.removeItem('notificationId');
}

// ── 주간 리포트 알림 (매주 월요일 오전 9시) ──────────────────────────────────

export async function scheduleWeeklyReportNotification() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('weekly-report', {
      name: 'Weekly Report',
      importance: Notifications.AndroidImportance.HIGH,
      sound: true,
    });
  }
  const catName = await getCatName();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: APP_NAME,
      body: i18n.t('notifications.weeklyReportReadyBody', { catName }),
      sound: true,
      data: { type: 'weekly-report' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // 2 = Monday (expo-notifications: 1=Sun, 2=Mon, ..., 7=Sat)
      hour: 9,
      minute: 0,
      channelId: Platform.OS === 'android' ? 'weekly-report' : undefined,
    },
  });
  return id;
}

export async function cancelWeeklyReportNotification() {
  const raw = await AsyncStorage.getItem('settings');
  const settings = raw ? JSON.parse(raw) : {};
  const id = settings.weeklyReportNotificationId;
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}
