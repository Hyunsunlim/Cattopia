import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  registerForPushNotificationsAsync,
  scheduleMultipleNotifications,
  scheduleWeeklyNotifications,
  cancelAllNotifications,
  scheduleWeeklyReportNotification,
  cancelWeeklyReportNotification,
} from '../utils/notifications';
import { useTheme } from '../context/ThemeContext';

export default function RemindersScreen({ navigation }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState(['21:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(12);
  const [pickerMinute, setPickerMinute] = useState(0);
  const pickerAnim = useRef(new Animated.Value(0)).current;

  const [useAutoPrompts, setUseAutoPrompts] = useState(true);
  const [notificationPreview, setNotificationPreview] = useState('');
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setReminderEnabled(parsed.reminderEnabled === true);
        if (Array.isArray(parsed.reminderTimes)) {
          setReminderTimes(parsed.reminderTimes);
        } else if (parsed.reminderTime) {
          setReminderTimes([String(parsed.reminderTime)]);
        }
        const savedPreview = parsed.notificationPreview;
        const catName = parsed.catName || 'Choco';
        const oldDefaults = ['How was your day?', 'Choco is waiting 🐱 오늘 이야기 들려줄래요?'];
        const newDefault = `${catName} is waiting 🐱 오늘 이야기 들려줄래요?`;
        setNotificationPreview(savedPreview && !oldDefaults.includes(savedPreview) ? savedPreview : newDefault);
        if (parsed.useAutoPrompts !== undefined) {
          setUseAutoPrompts(parsed.useAutoPrompts);
        }
        if (parsed.weeklyReportEnabled !== undefined) {
          setWeeklyReportEnabled(parsed.weeklyReportEnabled);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      const raw = await AsyncStorage.getItem('settings');
      const existing = raw ? JSON.parse(raw) : {};
      const settings = { ...existing, ...newSettings };
      await AsyncStorage.setItem('settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const reschedule = async (times) => {
    if (reminderEnabled && times.length > 0) {
      if (useAutoPrompts) {
        await scheduleWeeklyNotifications(times);
      } else {
        await scheduleMultipleNotifications(times, notificationPreview);
      }
    }
  };

  const handleReminderToggle = async (value) => {
    setReminderEnabled(value);
    saveSettings({ reminderEnabled: value });
    if (value) {
      await registerForPushNotificationsAsync();
      if (useAutoPrompts) {
        await scheduleWeeklyNotifications(reminderTimes);
      } else {
        await scheduleMultipleNotifications(reminderTimes, notificationPreview);
      }
    } else {
      await cancelAllNotifications();
    }
  };

  const openPicker = () => {
    setPickerHour(12);
    setPickerMinute(0);
    setShowTimePicker(true);
    Animated.timing(pickerAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const closePicker = () => {
    Animated.timing(pickerAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setShowTimePicker(false));
  };

  const addTime = async () => {
    const timeStr = `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
    if (reminderTimes.includes(timeStr)) {
      Alert.alert(t('reminders.duplicateTitle'), t('reminders.duplicateMessage', { time: timeStr }));
      return;
    }
    const newTimes = [...reminderTimes, timeStr].sort();
    setReminderTimes(newTimes);
    saveSettings({ reminderTimes: newTimes });
    closePicker();
    await reschedule(newTimes);
  };

  const removeTime = async (time) => {
    const newTimes = reminderTimes.filter(t => t !== time);
    setReminderTimes(newTimes);
    saveSettings({ reminderTimes: newTimes });
    if (newTimes.length === 0) {
      await cancelAllNotifications();
    } else {
      await reschedule(newTimes);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={theme.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('reminders.headerTitle')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('reminders.dailyReminderTitle')}</Text>
            <Text style={styles.settingDescription}>{t('reminders.dailyReminderDesc')}</Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={handleReminderToggle}
            trackColor={{ false: theme.switchTrackOff, true: theme.switchTrackOn }}
            thumbColor={theme.card}
          />
        </View>

        <View style={[styles.settingItemColumn, !reminderEnabled && styles.disabled]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('reminders.reminderTimesTitle')}</Text>
            <Text style={styles.settingDescription}>
              {reminderTimes.length} {t('reminders.reminderTimesDesc')}
            </Text>
          </View>

          <View style={styles.timeChipsContainer}>
            {reminderTimes.map((time) => (
              <View key={time} style={styles.timeChip}>
                <Ionicons name="time-outline" size={14} color={theme.accent} />
                <Text style={styles.timeChipText}>{time}</Text>
                {reminderEnabled && (
                  <TouchableOpacity
                    onPress={() => removeTime(time)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.inactiveTab} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {reminderEnabled && (
              <TouchableOpacity style={styles.addTimeButton} onPress={openPicker}>
                <Ionicons name="add" size={18} color={theme.accent} />
                <Text style={styles.addTimeText}>{t('reminders.addTime')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showTimePicker && reminderEnabled && (
            <Animated.View style={[
              styles.pickerContainer,
              {
                maxHeight: pickerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 250],
                }),
                opacity: pickerAnim,
              },
            ]}>
              <Text style={styles.pickerLabel}>{t('reminders.hour')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pickerScroll}
                contentContainerStyle={styles.pickerScrollContent}
              >
                {hours.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerChip, pickerHour === h && styles.pickerChipSelected]}
                    onPress={() => setPickerHour(h)}
                  >
                    <Text style={[styles.pickerChipText, pickerHour === h && styles.pickerChipTextSelected]}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.pickerLabel}>{t('reminders.minute')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pickerScroll}
                contentContainerStyle={styles.pickerScrollContent}
              >
                {minutes.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerChip, pickerMinute === m && styles.pickerChipSelected]}
                    onPress={() => setPickerMinute(m)}
                  >
                    <Text style={[styles.pickerChipText, pickerMinute === m && styles.pickerChipTextSelected]}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.pickerActions}>
                <Text style={styles.pickerPreview}>
                  {String(pickerHour).padStart(2, '0')}:{String(pickerMinute).padStart(2, '0')}
                </Text>
                <View style={styles.pickerButtons}>
                  <TouchableOpacity style={styles.pickerCancelBtn} onPress={closePicker}>
                    <Text style={styles.pickerCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickerDoneBtn} onPress={addTime}>
                    <Text style={styles.pickerDoneText}>{t('reminders.addTime')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── 주간 리포트 알림 ── */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('meow.reminders.weeklyReportTitle')}</Text>
            <Text style={styles.settingDescription}>
              {t('meow.reminders.weeklyReportDesc')}
            </Text>
          </View>
          <Switch
            value={weeklyReportEnabled}
            onValueChange={async (value) => {
              setWeeklyReportEnabled(value);
              saveSettings({ weeklyReportEnabled: value });
              if (value) {
                await registerForPushNotificationsAsync();
                const id = await scheduleWeeklyReportNotification();
                saveSettings({ weeklyReportNotificationId: id });
              } else {
                await cancelWeeklyReportNotification();
                saveSettings({ weeklyReportNotificationId: null });
              }
            }}
            trackColor={{ false: theme.switchTrackOff, true: '#3d665a' }}
            thumbColor={theme.card}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.primaryText,
  },
  content: {
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingItemColumn: {
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primaryText,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.secondaryText,
  },
  disabled: {
    opacity: 0.5,
  },
  timeChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  timeChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.separator,
    borderStyle: 'dashed',
    gap: 4,
  },
  addTimeText: {
    fontSize: 14,
    color: theme.accent,
    fontWeight: '500',
  },
  pickerContainer: {
    marginTop: 14,
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.secondaryText,
    marginBottom: 6,
    marginTop: 4,
  },
  pickerScroll: {
    marginBottom: 8,
  },
  pickerScrollContent: {
    gap: 6,
    paddingRight: 12,
  },
  pickerChip: {
    width: 42,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerChipSelected: {
    backgroundColor: theme.accent,
  },
  pickerChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.secondaryText,
  },
  pickerChipTextSelected: {
    color: theme.card,
    fontWeight: '700',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  pickerPreview: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.accent,
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickerCancelText: {
    fontSize: 14,
    color: theme.secondaryText,
    fontWeight: '500',
  },
  pickerDoneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.accent,
  },
  pickerDoneText: {
    fontSize: 14,
    color: theme.card,
    fontWeight: '600',
  },
});
