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
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);

  const [userName, setUserName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setUserName(String(parsed.userName ?? ''));
        setStartDate(String(parsed.startDate ?? ''));
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

  const handleNameSubmit = () => {
    setIsEditingName(false);
    saveSettings({ userName });
  };

  const displayName = userName || t('profile.defaultName');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={theme.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.headerTitle')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={32} color={theme.accent} />
          </View>
          <View style={styles.profileInfo}>
            {isEditingName ? (
              <TextInput
                style={styles.profileNameInput}
                value={userName}
                onChangeText={setUserName}
                onBlur={handleNameSubmit}
                onSubmitEditing={handleNameSubmit}
                autoFocus
              />
            ) : (
              <TouchableOpacity onPress={() => setIsEditingName(true)}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.tapToEdit}>{t('profile.tapToEdit')}</Text>
              </TouchableOpacity>
            )}
            {startDate ? (
              <Text style={styles.profileDate}>{t('profile.startedDate', { date: startDate })}</Text>
            ) : null}
          </View>
        </View>
      </View>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.primaryText,
    marginBottom: 2,
  },
  profileNameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.primaryText,
    marginBottom: 2,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.accent,
  },
  tapToEdit: {
    fontSize: 12,
    color: theme.tertiaryText,
    marginBottom: 4,
  },
  profileDate: {
    fontSize: 13,
    color: theme.secondaryText,
    marginTop: 4,
  },
});
