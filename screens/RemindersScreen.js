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
  Platform,
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
const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  secondary: '#3d665a',
  secondaryContainer: '#bce9d9',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainer: '#f0eded',
  surfaceContainerLow: '#f6f3f2',
  onSurface: '#1b1c1c',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export default function RemindersScreen({ navigation }) {
  const { t } = useTranslation();

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
    <SafeAreaView style={S.root} edges={['top']}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.outline} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{t('reminders.headerTitle')}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        {/* Daily reminder toggle */}
        <View style={S.card}>
          <View style={S.cardRow}>
            <View style={S.cardInfo}>
              <Text style={S.cardTitle}>{t('reminders.dailyReminderTitle')}</Text>
              <Text style={S.cardDesc}>{t('reminders.dailyReminderDesc')}</Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: C.surfaceContainer, true: C.primaryContainer }}
              thumbColor={reminderEnabled ? C.primary : C.outline}
            />
          </View>
        </View>

        {/* Reminder times */}
        <View style={[S.card, !reminderEnabled && S.disabled]}>
          <Text style={S.cardTitle}>{t('reminders.reminderTimesTitle')}</Text>
          <Text style={S.cardDesc}>{reminderTimes.length} {t('reminders.reminderTimesDesc')}</Text>

          <View style={S.chipsRow}>
            {reminderTimes.map((time) => (
              <View key={time} style={S.chip}>
                <Ionicons name="time-outline" size={14} color={C.primary} />
                <Text style={S.chipText}>{time}</Text>
                {reminderEnabled && (
                  <TouchableOpacity onPress={() => removeTime(time)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={C.outlineVariant} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {reminderEnabled && (
              <TouchableOpacity style={S.addChip} onPress={openPicker}>
                <Ionicons name="add" size={18} color={C.primary} />
                <Text style={S.addChipText}>{t('reminders.addTime')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showTimePicker && reminderEnabled && (
            <Animated.View style={[S.picker, {
              maxHeight: pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }),
              opacity: pickerAnim,
            }]}>
              <Text style={S.pickerLabel}>{t('reminders.hour')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.pickerScroll} contentContainerStyle={S.pickerScrollContent}>
                {hours.map((h) => (
                  <TouchableOpacity key={h} style={[S.pickerChip, pickerHour === h && S.pickerChipOn]} onPress={() => setPickerHour(h)}>
                    <Text style={[S.pickerChipText, pickerHour === h && S.pickerChipTextOn]}>{String(h).padStart(2, '0')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={S.pickerLabel}>{t('reminders.minute')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.pickerScroll} contentContainerStyle={S.pickerScrollContent}>
                {minutes.map((m) => (
                  <TouchableOpacity key={m} style={[S.pickerChip, pickerMinute === m && S.pickerChipOn]} onPress={() => setPickerMinute(m)}>
                    <Text style={[S.pickerChipText, pickerMinute === m && S.pickerChipTextOn]}>{String(m).padStart(2, '0')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={S.pickerActions}>
                <Text style={S.pickerPreview}>{String(pickerHour).padStart(2, '0')}:{String(pickerMinute).padStart(2, '0')}</Text>
                <View style={S.pickerBtns}>
                  <TouchableOpacity style={S.cancelBtn} onPress={closePicker}>
                    <Text style={S.cancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.doneBtn} onPress={addTime}>
                    <Text style={S.doneBtnText}>{t('reminders.addTime')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Weekly report */}
        <View style={S.card}>
          <View style={S.cardRow}>
            <View style={S.cardInfo}>
              <Text style={S.cardTitle}>{t('meow.reminders.weeklyReportTitle')}</Text>
              <Text style={S.cardDesc}>{t('meow.reminders.weeklyReportDesc')}</Text>
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
              trackColor={{ false: C.surfaceContainer, true: C.secondaryContainer }}
              thumbColor={weeklyReportEnabled ? C.secondary : C.outline}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.onSurface, fontFamily: SERIF },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 16 },

  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.onSurface, marginBottom: 3 },
  cardDesc: { fontSize: 13, color: C.outline },

  disabled: { opacity: 0.45 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  chipText: { fontSize: 15, fontWeight: '600', color: C.primary },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: C.outlineVariant, borderStyle: 'dashed',
  },
  addChipText: { fontSize: 14, fontWeight: '500', color: C.primary },

  picker: {
    marginTop: 14, backgroundColor: C.surfaceContainerLow,
    borderRadius: 14, padding: 12, overflow: 'hidden',
  },
  pickerLabel: {
    fontSize: 11, fontWeight: '700', color: C.outline,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 4,
  },
  pickerScroll: { marginBottom: 8 },
  pickerScrollContent: { gap: 6, paddingRight: 12 },
  pickerChip: {
    width: 42, height: 36, borderRadius: 10,
    backgroundColor: C.surfaceContainer, justifyContent: 'center', alignItems: 'center',
  },
  pickerChipOn: { backgroundColor: C.primary },
  pickerChipText: { fontSize: 14, fontWeight: '500', color: C.outline },
  pickerChipTextOn: { color: '#fff', fontWeight: '700' },

  pickerActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10,
  },
  pickerPreview: { fontSize: 24, fontWeight: '700', color: C.primary, fontFamily: SERIF },
  pickerBtns: { flexDirection: 'row', gap: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  cancelBtnText: { fontSize: 14, color: C.outline, fontWeight: '500' },
  doneBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: C.primary },
  doneBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});
