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
import { useTranslation } from 'react-i18next';
import {
  scheduleMultipleNotifications,
} from '../utils/notifications';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  onSurface: '#1b1c1c',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
};

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
  const { t } = useTranslation();
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
          <Ionicons name="chevron-back" size={28} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.messages')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.settingItemColumn}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('messages.sectionTitle')}</Text>
            <Text style={styles.settingDescription}>{t('messages.sectionDesc')}</Text>
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
                  {t('messages.mindfulTitle')}
                </Text>
              </View>
              <Text style={styles.messageOptionSubtitle}>
                {t('messages.mindfulDesc')}
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
                  {t('messages.customTitle')}
                </Text>
              </View>
              <Text style={styles.messageOptionSubtitle}>
                {t('messages.customDesc')}
              </Text>
            </TouchableOpacity>
          </View>

          {!useAutoPrompts && (
            <TextInput
              style={styles.previewInput}
              value={notificationPreview}
              onChangeText={handlePreviewChange}
              placeholder={t('messages.customPlaceholder')}
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
    backgroundColor: C.background,
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
    color: C.onSurface,
  },
  content: {
    padding: 16,
  },
  settingItemColumn: {
    backgroundColor: C.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.onSurface,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: C.outline,
  },
  messageOptions: {
    marginTop: 14,
    gap: 10,
  },
  messageOption: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: C.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  messageOptionSelected: {
    backgroundColor: C.primaryContainer,
    borderColor: C.primary,
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
    borderColor: C.outlineVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: C.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  messageOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.outline,
  },
  messageOptionTitleSelected: {
    color: C.onSurface,
  },
  messageOptionSubtitle: {
    fontSize: 13,
    color: C.outline,
    marginLeft: 30,
  },
  previewInput: {
    backgroundColor: C.surfaceContainerLow,
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    marginTop: 12,
    color: C.onSurface,
  },
});
