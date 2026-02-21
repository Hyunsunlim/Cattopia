import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  scheduleMultipleNotifications,
} from '../utils/notifications';

const MORNING_PROMPTS = [
  "Good morning \u{1F305} What are you feeling right now?",
  "What do you notice in your body this morning?",
  "What do you need most today?",
];

const EVENING_PROMPTS = [
  "How was your day? What emotions came up? \u{1F319}",
  "What did you observe today, without judgment?",
  "What needs were met today? What needs weren't?",
];

export default function MessagesScreen({ navigation }) {
  const [useAutoPrompts, setUseAutoPrompts] = useState(true);
  const [notificationPreview, setNotificationPreview] = useState('How was your day?');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState(['21:00']);

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

  const handleAutoPromptsToggle = async (value) => {
    setUseAutoPrompts(value);
    saveSettings({ useAutoPrompts: value });
    if (reminderEnabled) {
      const msg = value
        ? (_time, hour) => {
            const prompts = hour < 12 ? MORNING_PROMPTS : EVENING_PROMPTS;
            return prompts[Math.floor(Math.random() * prompts.length)];
          }
        : notificationPreview;
      await scheduleMultipleNotifications(reminderTimes, msg);
    }
  };

  const handlePreviewChange = async (text) => {
    setNotificationPreview(text);
    saveSettings({ notificationPreview: text });
    if (reminderEnabled && !useAutoPrompts) {
      await scheduleMultipleNotifications(reminderTimes, text);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.settingItemColumn}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Notification Message</Text>
            <Text style={styles.settingDescription}>
              Choose how your reminders speak to you
            </Text>
          </View>

          <View style={styles.messageOptions}>
            <TouchableOpacity
              style={[
                styles.messageOption,
                useAutoPrompts && styles.messageOptionSelected,
              ]}
              onPress={() => handleAutoPromptsToggle(true)}
            >
              <View style={styles.messageOptionHeader}>
                <View style={[
                  styles.radioOuter,
                  useAutoPrompts && styles.radioOuterSelected,
                ]}>
                  {useAutoPrompts && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.messageOptionTitle,
                  useAutoPrompts && styles.messageOptionTitleSelected,
                ]}>
                  Mindful prompts
                </Text>
              </View>
              <Text style={styles.messageOptionSubtitle}>
                Morning & evening NVC-inspired questions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.messageOption,
                !useAutoPrompts && styles.messageOptionSelected,
              ]}
              onPress={() => handleAutoPromptsToggle(false)}
            >
              <View style={styles.messageOptionHeader}>
                <View style={[
                  styles.radioOuter,
                  !useAutoPrompts && styles.radioOuterSelected,
                ]}>
                  {!useAutoPrompts && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.messageOptionTitle,
                  !useAutoPrompts && styles.messageOptionTitleSelected,
                ]}>
                  Custom message
                </Text>
              </View>
              <Text style={styles.messageOptionSubtitle}>
                Write your own reminder text
              </Text>
            </TouchableOpacity>
          </View>

          {!useAutoPrompts && (
            <TextInput
              style={styles.previewInput}
              value={notificationPreview}
              onChangeText={handlePreviewChange}
              placeholder="Enter notification message"
              placeholderTextColor="#999"
            />
          )}
        </View>
      </View>
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
  messageOptions: {
    marginTop: 14,
    gap: 10,
  },
  messageOption: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  messageOptionSelected: {
    backgroundColor: '#f0f0ff',
    borderColor: '#6366f1',
  },
  messageOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#6366f1',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
  },
  messageOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  messageOptionTitleSelected: {
    color: '#333',
  },
  messageOptionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginLeft: 30,
  },
  previewInput: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    marginTop: 12,
    color: '#333',
  },
});
