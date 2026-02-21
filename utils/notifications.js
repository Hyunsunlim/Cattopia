import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleMultipleNotifications(times, message) {
  await cancelAllNotifications();

  const ids = [];
  for (const time of times) {
    const [hours, minutes] = time.split(':').map(Number);
    const body = typeof message === 'function' ? message(time, hours) : message;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'LucidNote',
        body,
        sound: true,
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

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem('notificationIds');
  await AsyncStorage.removeItem('notificationId');
}
