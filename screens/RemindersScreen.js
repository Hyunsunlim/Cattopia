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
import {
  registerForPushNotificationsAsync,
  scheduleMultipleNotifications,
  cancelAllNotifications,
} from '../utils/notifications';

export default function RemindersScreen({ navigation }) {
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState(['21:00']);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(12);
  const [pickerMinute, setPickerMinute] = useState(0);
  const pickerAnim = useRef(new Animated.Value(0)).current;

  // Needed for scheduling
  const [useAutoPrompts, setUseAutoPrompts] = useState(true);
  const [notificationPreview, setNotificationPreview] = useState('How was your day?');

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
        setNotificationPreview(String(parsed.notificationPreview ?? 'How was your day?'));
        if (parsed.useAutoPrompts !== undefined) {
          setUseAutoPrompts(parsed.useAutoPrompts);
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

  const getNotificationMessage = () => {
    if (!useAutoPrompts) return notificationPreview;
    return (_time, hour) => {
      const MORNING = [
        "Good morning \u{1F305} What are you feeling right now?",
        "What do you notice in your body this morning?",
        "What do you need most today?",
      ];
      const EVENING = [
        "How was your day? What emotions came up? \u{1F319}",
        "What did you observe today, without judgment?",
        "What needs were met today? What needs weren't?",
      ];
      const prompts = hour < 12 ? MORNING : EVENING;
      return prompts[Math.floor(Math.random() * prompts.length)];
    };
  };

  const reschedule = async (times) => {
    if (reminderEnabled && times.length > 0) {
      await scheduleMultipleNotifications(times, getNotificationMessage());
    }
  };

  const handleReminderToggle = async (value) => {
    setReminderEnabled(value);
    saveSettings({ reminderEnabled: value });
    if (value) {
      await registerForPushNotificationsAsync();
      await scheduleMultipleNotifications(reminderTimes, getNotificationMessage());
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
      Alert.alert('Duplicate', `${timeStr} is already set.`);
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
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reminders</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Reminder Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Daily Reminder</Text>
            <Text style={styles.settingDescription}>
              Get notified to write your note
            </Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={handleReminderToggle}
            trackColor={{ false: '#e0e0e0', true: '#6366f1' }}
            thumbColor="white"
          />
        </View>

        {/* Reminder Times */}
        <View style={[styles.settingItemColumn, !reminderEnabled && styles.disabled]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Reminder Times</Text>
            <Text style={styles.settingDescription}>
              {reminderTimes.length} reminder{reminderTimes.length !== 1 ? 's' : ''} set
            </Text>
          </View>

          <View style={styles.timeChipsContainer}>
            {reminderTimes.map((time) => (
              <View key={time} style={styles.timeChip}>
                <Ionicons name="time-outline" size={14} color="#6366f1" />
                <Text style={styles.timeChipText}>{time}</Text>
                {reminderEnabled && (
                  <TouchableOpacity
                    onPress={() => removeTime(time)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#ccc" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {reminderEnabled && (
              <TouchableOpacity style={styles.addTimeButton} onPress={openPicker}>
                <Ionicons name="add" size={18} color="#6366f1" />
                <Text style={styles.addTimeText}>Add</Text>
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
              <Text style={styles.pickerLabel}>Hour</Text>
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

              <Text style={styles.pickerLabel}>Minute</Text>
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
                    <Text style={styles.pickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickerDoneBtn} onPress={addTime}>
                    <Text style={styles.pickerDoneText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f5f5',
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
    color: '#333',
  },
  content: {
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingItemColumn: {
    backgroundColor: 'white',
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
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
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
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  timeChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    gap: 4,
  },
  addTimeText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  pickerContainer: {
    marginTop: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
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
    backgroundColor: '#ececec',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerChipSelected: {
    backgroundColor: '#6366f1',
  },
  pickerChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  pickerChipTextSelected: {
    color: 'white',
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
    color: '#6366f1',
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
    color: '#999',
    fontWeight: '500',
  },
  pickerDoneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  pickerDoneText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
});
