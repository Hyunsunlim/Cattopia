import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, Platform, Alert, Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCatName } from '../context/CatNameContext';
import { deleteNote, updateNote } from '../services/notes';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  secondary: '#3d665a',
  secondaryContainer: '#bce9d9',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const EMOTION_EMOJI = {
  joy: '😊',
  happiness: '😊',
  sadness: '🌧️',
  sad: '🌧️',
  anger: '😤',
  angry: '😤',
  fear: '😨',
  surprise: '😮',
  disgust: '😣',
  calm: '😌',
  anxiety: '😰',
  love: '🥰',
  neutral: '·',
};

function formatDate(ts, lang) {
  const d = new Date(ts);
  const locale = lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-TW' : 'en-US';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}
function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Diary item ────────────────────────────────────────────────────────────────

function DiaryItem({ item, onDelete, onEdit }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.split('-')[0];
  const isPrivate = item.visibility !== 'friends';

  const showMenu = () => {
    Alert.alert(
      formatDate(item.timestamp, lang),
      undefined,
      [
        { text: t('common.edit'), onPress: () => onEdit(item) },
        { text: t('common.delete'), style: 'destructive', onPress: () => {
          Alert.alert(t('meow.myLogs.deleteTitle'), t('meow.myLogs.deleteMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(item.id) },
          ]);
        }},
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const preview = (item.content || item.title || '').slice(0, 90);

  return (
    <TouchableOpacity style={S.item} onLongPress={showMenu} activeOpacity={0.85}>
      <View style={S.itemHeader}>
        <Text style={S.itemDate}>{formatDate(item.timestamp, lang)}</Text>
        <View style={S.itemHeaderRight}>
          <Text style={S.itemTime}>{formatTime(item.timestamp)}</Text>
          <TouchableOpacity onPress={showMenu} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={16} color={C.outlineVariant} />
          </TouchableOpacity>
        </View>
      </View>
      {preview ? (
        <Text style={S.itemPreview} numberOfLines={2}>{preview}</Text>
      ) : (
        <Text style={S.itemEmpty}>{t('meow.myLogs.noContent')}</Text>
      )}
      <View style={S.itemFooter}>
        {item.emotion && item.emotion !== 'neutral' ? (
          <View style={[S.badge, S.badgePrivate]}>
            <Text style={[S.badgeText, S.badgeTextPrivate]}>
              {EMOTION_EMOJI[item.emotion] ?? '✨'} {item.emotion}
            </Text>
          </View>
        ) : item.emotion === 'neutral' ? (
          <View style={[S.badge, S.badgeNeutral]}>
            <Text style={[S.badgeText, S.badgeTextNeutral]}>😌</Text>
          </View>
        ) : (
          <View style={[S.badge, S.badgeNeutral]}>
            <Text style={[S.badgeText, S.badgeTextNeutral]}>· {t('meow.insight.analyzing')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyLogsScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.split('-')[0];
  const { catName } = useCatName();
  const insets = useSafeAreaInsets();
  const [diaries, setDiaries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editText, setEditText] = useState('');

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('diaries').then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setDiaries(all);
      setLoaded(true);
    });
  }, []));

  const handleDelete = async (id) => {
    const target = diaries.find(d => d.id === id);
    const updated = diaries.filter(d => d.id !== id);
    setDiaries(updated);
    await AsyncStorage.setItem('diaries', JSON.stringify(updated));
    if (target?._serverId) {
      deleteNote(target._serverId).catch(e => console.warn('Server delete failed:', e));
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setEditText(item.content || item.title || '');
  };

  const handleSaveEdit = async () => {
    const updated = diaries.map(d =>
      d.id === editItem.id ? { ...d, content: editText } : d
    );
    setDiaries(updated);
    await AsyncStorage.setItem('diaries', JSON.stringify(updated));
    if (editItem._serverId) {
      updateNote(editItem._serverId, { content: editText }).catch(e => console.warn('Server update failed:', e));
    }
    setEditItem(null);
  };

  return (
    <View style={S.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={S.safe} edges={['top']}>

        {/* Header */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <View style={S.headerBadge}>
              <Text style={{ fontSize: 18 }}>🐱</Text>
            </View>
            <Text style={S.headerTitle}>{t('meow.myLogs.title')}</Text>
          </View>
          {loaded && (
            <Text style={S.headerCount}>{t('meow.myLogs.totalCount', { n: diaries.length })}</Text>
          )}
        </View>

        <FlatList
          data={diaries}
          keyExtractor={item => item.id ?? item.timestamp}
          contentContainerStyle={[
            S.listContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            /* 이번 주 리포트 카드 */
            <TouchableOpacity
              style={S.reportCard}
              onPress={() => navigation.navigate('Report')}
              activeOpacity={0.82}
            >
              <View style={S.reportCardLeft}>
                <Text style={S.reportBadge}>{t('meow.myLogs.reportBadge')}</Text>
                <Text style={S.reportTitle}>{t('meow.myLogs.reportTitle', { catName: catName })}</Text>
              </View>
              <View style={S.reportArrow}>
                <Ionicons name="chevron-forward" size={20} color={C.secondary} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => loaded && (
            <View style={S.empty}>
              <Text style={S.emptyEmoji}>📖</Text>
              <Text style={S.emptyText}>{t('meow.myLogs.empty')}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <DiaryItem item={item} onDelete={handleDelete} onEdit={handleEdit} />
          )}
          ItemSeparatorComponent={() => <View style={S.separator} />}
        />
      </SafeAreaView>

      {/* Edit Modal */}
      <Modal visible={!!editItem} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={S.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={S.modalBox}>
            <Text style={S.modalTitle}>{editItem ? formatDate(editItem.timestamp, lang) : ''}</Text>
            <TextInput
              style={S.modalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={S.modalActions}>
              <TouchableOpacity style={S.modalCancel} onPress={() => setEditItem(null)}>
                <Text style={S.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.modalSave} onPress={handleSaveEdit}>
                <Text style={S.modalSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.primaryContainer, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.onSurface, fontFamily: SERIF },
  headerCount: { fontSize: 14, fontWeight: '600', color: C.outline },

  listContent: { paddingTop: 16, paddingHorizontal: 20 },

  // Report card
  reportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.secondaryContainer,
    borderRadius: 18, padding: 18, marginBottom: 20,
  },
  reportCardLeft: { flex: 1, gap: 6 },
  reportBadge: { fontSize: 11, fontWeight: '700', color: C.secondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  reportTitle: { fontSize: 16, fontWeight: '700', color: C.onSurface, fontFamily: SERIF, lineHeight: 24 },
  reportArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center',
  },

  // Diary item
  item: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16, gap: 8,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemDate: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  itemTime: { fontSize: 12, color: C.outlineVariant },
  itemPreview: { fontSize: 15, color: C.onSurface, lineHeight: 22 },
  itemEmpty: { fontSize: 14, color: C.outlineVariant, fontStyle: 'italic' },
  itemFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemEmotion: { fontSize: 12, color: C.outline },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgePrivate: { backgroundColor: 'rgba(255,216,190,0.4)' },
  badgePublic: { backgroundColor: 'rgba(188,233,217,0.4)' },
  badgeNeutral: { backgroundColor: 'rgba(211,196,187,0.25)' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextPrivate: { color: C.primary },
  badgeTextPublic: { color: C.secondary },
  badgeTextNeutral: { color: C.outlineVariant },

  separator: { height: 10 },

  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 16,
  },
  modalTitle: { fontSize: 13, fontWeight: '600', color: C.onSurfaceVariant },
  modalInput: {
    backgroundColor: C.surfaceContainerLow, borderRadius: 14,
    padding: 14, fontSize: 15, color: C.onSurface, minHeight: 140,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99 },
  modalCancelText: { fontSize: 14, color: C.outline, fontWeight: '500' },
  modalSave: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 99, backgroundColor: C.primary },
  modalSaveText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 15, color: C.outline, textAlign: 'center', lineHeight: 24 },
});
