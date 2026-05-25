import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useInviteFriend } from '../hooks/useInviteFriend';
import { APP_NAME } from '../constants/appConfig';
import { InviteToast } from '../components/InviteFriendUI';
import { fetchFriends, getCachedFriends } from '../services/friends';
import { fetchNotes, getCachedNotes } from '../services/notes';
import { useCatName } from '../context/CatNameContext';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  secondary: '#3d665a',
  secondaryContainer: '#bce9d9',
  secondaryFixedDim: '#a3d0c0',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainer: '#f0eded',
  surfaceContainerLow: '#f6f3f2',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
};

const TOTAL_STORIES = 66;
export default function MeowHomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { catName: CAT_NAME } = useCatName();

  const [diaryCount, setDiaryCount] = useState(0);
  const [wroteToday, setWroteToday] = useState(false);
  const [friends, setFriends] = useState([]);

  const { toastAnim, toastMessage, sendInvite } = useInviteFriend();

  const applyDiaries = (diaries) => {
    const todayStr = new Date().toDateString();
    setDiaryCount(diaries.length);
    setWroteToday(diaries.some(d => new Date(d.timestamp).toDateString() === todayStr));
  };

  useFocusEffect(
    useCallback(() => {
      // 캐시로 먼저 즉시 렌더, 그다음 서버 동기화
      getCachedNotes().then(cached => { if (cached.length) applyDiaries(cached); });
      getCachedFriends().then(cached => { if (cached.length) setFriends(cached); });
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [diaries, friendsData] = await Promise.all([
        fetchNotes().catch(() => []),
        fetchFriends().catch(() => []),
      ]);
      applyDiaries(diaries);
      setFriends(friendsData);
    } catch (e) {
      console.error('MeowHomeScreen loadData error:', e);
    }
  };

  const isComplete = diaryCount >= TOTAL_STORIES;
  const remaining = Math.max(0, TOTAL_STORIES - diaryCount);
  const progress = Math.min(1, diaryCount / TOTAL_STORIES);
  const progressPct = `${Math.round(progress * 100)}%`;

  const handleWriteToday = () => {
    navigation.navigate('Write');
  };


  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <InviteToast toastAnim={toastAnim} toastMessage={toastMessage} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerCatBadge}>
              <Text style={{ fontSize: 18 }}>🐱</Text>
            </View>
            <Text style={styles.headerTitle}>{APP_NAME}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* ── Scrollable content ─────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 16, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Status badge + headline */}
          <View style={styles.centered}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('meow.home.dailyRitual')}</Text>
            </View>
            <Text style={styles.headline}>
              {wroteToday
                ? t('meow.home.fedTitle', { catName: CAT_NAME })
                : t('meow.home.waitingTitle', { catName: CAT_NAME })}
            </Text>
          </View>

          {/* Cat image placeholder */}
          <View style={styles.catArea}>
            <View style={styles.catGlow} />
            <View style={styles.catCircle}>
              <Text style={styles.catEmoji}>🐱</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.card}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.metaLabel}>{t('meow.home.catNameLabel')}</Text>
                <Text style={styles.catName}>{CAT_NAME}</Text>
              </View>
              <Text style={styles.remainingText}>
                {remaining > 0
                  ? t('meow.home.remainingStories', { n: remaining })
                  : t('meow.home.grownUp')}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[
                styles.progressFill,
                { width: progressPct, backgroundColor: isComplete ? '#f59e0b' : C.secondaryFixedDim },
              ]}>
                {!isComplete && (
                  <View style={styles.progressKnob}>
                    <Text style={{ fontSize: 7, lineHeight: 10 }}>🐾</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.progressNote}>
              {isComplete
                ? t('meow.home.grownUp')
                : t('meow.home.storyProgress', { count: diaryCount, total: TOTAL_STORIES })}
            </Text>
          </View>

          {/* Friends Today */}
          <View style={styles.friendsRow}>
            <Text style={styles.metaLabel}>{t('meow.home.friendsToday')}</Text>
            <View style={styles.friendsRight}>
              {friends.length > 0 && friends.map((friend, i) => (
                <MiniAvatar key={friend.id ?? i} friend={friend} />
              ))}
              <TouchableOpacity onPress={async () => { const sent = await sendInvite(); if (sent) loadData(); }} activeOpacity={0.7} style={styles.miniInviteBtn}>
                <Ionicons name="add" size={16} color={C.outline} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* ── Fixed bottom CTA ───────────────────────────────────── */}
        <View style={styles.ctaWrapper}>
          <TouchableOpacity style={styles.cta} onPress={handleWriteToday} activeOpacity={0.85}>
            <Ionicons name="create-outline" size={22} color={C.primary} />
            <Text style={styles.ctaText}>{t('meow.home.writeCTA')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  safeArea: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(211,196,187,0.6)',
    backgroundColor: C.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCatBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.onSurface,
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },

  // Status badge + headline
  centered: { alignItems: 'center', gap: 12 },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: C.secondaryContainer,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.secondary,
    letterSpacing: 0.4,
  },
  headline: {
    fontSize: 22,
    fontWeight: '600',
    color: C.onSurface,
    fontFamily: 'Georgia',
    textAlign: 'center',
    lineHeight: 32,
  },

  // Cat image
  catArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  catGlow: {
    position: 'absolute',
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: 'rgba(255,216,190,0.45)',
  },
  catCircle: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: C.surface,
    borderWidth: 3,
    borderColor: C.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  catEmoji: { fontSize: 58 },

  // Progress card
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  catName: {
    fontSize: 26,
    fontWeight: '700',
    color: C.primary,
    fontFamily: 'Georgia',
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.secondary,
  },
  progressTrack: {
    height: 22,
    borderRadius: 99,
    backgroundColor: C.surfaceContainer,
    overflow: 'hidden',
    padding: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: C.secondaryFixedDim,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 3,
    minWidth: 22,
  },
  progressKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressNote: {
    fontSize: 11,
    color: C.outline,
    textAlign: 'center',
  },

  // Friends compact row
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniInviteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.outlineVariant,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Fixed bottom CTA
  ctaWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(211,196,187,0.5)',
    backgroundColor: C.background,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.primaryContainer,
    borderRadius: 99,
    paddingVertical: 18,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: C.primary,
    fontFamily: 'Georgia',
  },
  subcopy: {
    textAlign: 'center',
    fontSize: 12,
    fontStyle: 'italic',
    color: C.outline,
    opacity: 0.75,
  },

});

// ── Mini avatar ──────────────────────────────────────────────────────────────

function MiniAvatar({ friend }) {
  const isInvited = friend.status === 'invited';
  const active = !isInvited && friend.wroteToday;
  return (
    <View style={aStyles.wrapper}>
      <View style={[aStyles.circle, { borderColor: active ? '#4ade80' : C.outlineVariant }]}>
        <Text style={aStyles.emoji}>{friend.catEmoji ?? '🐱'}</Text>
      </View>
      <View style={[aStyles.dot, { backgroundColor: active ? '#4ade80' : C.surfaceContainer }]} />
    </View>
  );
}

const aStyles = StyleSheet.create({
  wrapper: { position: 'relative' },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: { fontSize: 16 },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.background,
  },
});
