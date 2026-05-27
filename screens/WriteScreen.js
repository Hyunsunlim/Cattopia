import { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { trackWriteEntry } from '../services/analytics';
import { useCatName } from '../context/CatNameContext';
import { createNote } from '../services/notes';

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
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
  orange: '#f97316',
};

function formatDate(date, locale) {
  const lang = (locale || 'en').split('-')[0];
  return date.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

export default function WriteScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { catName } = useCatName();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const today = new Date();
  const dateStr = formatDate(today, i18n.language);
  const canSave = content.trim().length > 0;

  const handleComplete = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const entry = {
        id: Date.now().toString(),
        content: content.trim(),
        timestamp: today.toISOString(),
      };
      const saved = await createNote(entry);
      trackWriteEntry();
      const raw = await AsyncStorage.getItem('diaries');
      const all = raw ? JSON.parse(raw) : [];
      navigation.replace('WriteComplete', {
        count: all.length,
        serverId: saved._serverId ?? null,
        content: entry.content,
      });
    } catch (e) {
      console.error('WriteScreen save error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('meow.write.title')}</Text>
          <TouchableOpacity
            onPress={handleComplete}
            disabled={!canSave || saving}
            activeOpacity={0.75}
            style={[styles.doneBtn, canSave && styles.doneBtnActive]}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Text style={[styles.doneBtnText, canSave && styles.doneBtnTextActive]}>{t('meow.write.done')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Fixed top section ──────────────────────────────── */}
        <View style={styles.topSection}>
          <Text style={styles.dateText}>{dateStr}</Text>
          <View style={styles.catBanner}>
            <View style={styles.catBannerIcon}>
              <Text style={{ fontSize: 28 }}>🐱</Text>
            </View>
            <View>
              <Text style={styles.catBannerTitle}>{t('meow.write.catHungry', { catName })}</Text>
              <Text style={styles.catBannerSub}>{t('meow.write.storyIsFood')}</Text>
            </View>
          </View>
        </View>

        {/* ── Editor ───────────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
          style={styles.editorArea}
        >
          <TextInput
            ref={inputRef}
            style={styles.editor}
            multiline
            placeholder={t('meow.write.placeholder')}
            placeholderTextColor={C.outlineVariant}
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
            autoFocus
            scrollEnabled
          />
        </TouchableOpacity>

      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.onSurface,
    fontFamily: 'Georgia',
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: C.surfaceContainerLow,
    minWidth: 52,
    alignItems: 'center',
  },
  doneBtnActive: {
    backgroundColor: 'rgba(255,216,190,0.6)',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.outlineVariant,
  },
  doneBtnTextActive: {
    color: C.primary,
  },

  // Fixed top block
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 14,
  },

  // Date
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.onSurfaceVariant,
    letterSpacing: 0.2,
  },

  // Cat banner
  catBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(188,233,217,0.28)',
    borderRadius: 16,
    padding: 14,
  },
  catBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.secondary,
    marginBottom: 2,
  },
  catBannerSub: {
    fontSize: 12,
    color: C.outline,
  },

  // Editor — flex: 1 so it fills all remaining space, scrollEnabled handles internal scroll
  editorArea: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(211,196,187,0.4)',
    padding: 16,
  },
  editor: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    color: C.onSurface,
  },

});
