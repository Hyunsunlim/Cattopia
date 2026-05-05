import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  FlatList, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

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
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS_KO[d.getDay()]}요일`;
}
function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Diary item ────────────────────────────────────────────────────────────────

function DiaryItem({ item }) {
  const { t } = useTranslation();
  const preview = (item.content || item.title || '').slice(0, 90);
  const isPrivate = item.visibility !== 'friends';

  return (
    <View style={S.item}>
      <View style={S.itemHeader}>
        <Text style={S.itemDate}>{formatDate(item.timestamp)}</Text>
        <Text style={S.itemTime}>{formatTime(item.timestamp)}</Text>
      </View>
      {preview ? (
        <Text style={S.itemPreview} numberOfLines={2}>{preview}</Text>
      ) : (
        <Text style={S.itemEmpty}>{t('meow.myLogs.noContent')}</Text>
      )}
      <View style={S.itemFooter}>
        <View style={[S.badge, isPrivate ? S.badgePrivate : S.badgePublic]}>
          <Text style={[S.badgeText, isPrivate ? S.badgeTextPrivate : S.badgeTextPublic]}>
            {isPrivate ? t('meow.myLogs.privateLabel', { catName: CAT_NAME }) : t('meow.myLogs.friendsLabel')}
          </Text>
        </View>
        {item.emotion && item.emotion !== 'neutral' && (
          <Text style={S.itemEmotion}>{item.emotion}</Text>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

const CAT_NAME = 'Choco';

export default function MyLogsScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [diaries, setDiaries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('diaries').then(raw => {
      const all = raw ? JSON.parse(raw) : [];
      // Newest first
      all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setDiaries(all);
      setLoaded(true);
    });
  }, []));

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
                <Text style={S.reportTitle}>{t('meow.myLogs.reportTitle', { catName: CAT_NAME })}</Text>
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
          renderItem={({ item }) => <DiaryItem item={item} />}
          ItemSeparatorComponent={() => <View style={S.separator} />}
        />
      </SafeAreaView>
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
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemDate: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  itemTime: { fontSize: 12, color: C.outlineVariant },
  itemPreview: { fontSize: 15, color: C.onSurface, lineHeight: 22 },
  itemEmpty: { fontSize: 14, color: C.outlineVariant, fontStyle: 'italic' },
  itemFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemEmotion: { fontSize: 12, color: C.outline },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgePrivate: { backgroundColor: 'rgba(255,216,190,0.4)' },
  badgePublic: { backgroundColor: 'rgba(188,233,217,0.4)' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextPrivate: { color: C.primary },
  badgeTextPublic: { color: C.secondary },

  separator: { height: 10 },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60, gap: 16 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 15, color: C.outline, textAlign: 'center', lineHeight: 24 },
});
