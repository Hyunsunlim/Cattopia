import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
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
const CAT_NAME = 'Choco';

export default function MeowHomeScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [diaryCount, setDiaryCount] = useState(0);
  const [friends, setFriends] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [diariesRaw, friendsRaw] = await Promise.all([
        AsyncStorage.getItem('diaries'),
        AsyncStorage.getItem('friends'),
      ]);

      if (diariesRaw) {
        setDiaryCount(JSON.parse(diariesRaw).length);
      }

      if (friendsRaw === null) {
        await AsyncStorage.setItem('friends', JSON.stringify([]));
        setFriends([]);
      } else {
        setFriends(JSON.parse(friendsRaw));
      }
    } catch (e) {
      console.error('MeowHomeScreen loadData error:', e);
    }
  };

  const remaining = Math.max(0, TOTAL_STORIES - diaryCount);
  const progress = Math.min(1, diaryCount / TOTAL_STORIES);
  const progressPct = `${Math.round(progress * 100)}%`;

  const handleWriteToday = () => {
    navigation.navigate('Write');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerCatBadge}>
              <Text style={{ fontSize: 18 }}>🐱</Text>
            </View>
            <Text style={styles.headerTitle}>Meow</Text>
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Status badge + headline */}
          <View style={styles.centered}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('meow.home.dailyRitual')}</Text>
            </View>
            <Text style={styles.headline}>
              {t('meow.home.waitingTitle', { catName: CAT_NAME })}
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
              <View style={[styles.progressFill, { width: progressPct }]}>
                <View style={styles.progressKnob}>
                  <Text style={{ fontSize: 7, lineHeight: 10 }}>🐾</Text>
                </View>
              </View>
            </View>
            <Text style={styles.progressNote}>
              {t('meow.home.storyProgress', { count: diaryCount, total: TOTAL_STORIES })}
            </Text>
          </View>

          {/* Friends Today */}
          <View style={styles.friendsBlock}>
            <Text style={styles.metaLabel}>{t('meow.home.friendsToday')}</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyFriends}>
                <Text style={styles.emptyText}>{t('meow.home.noFriendsYet')}</Text>
                <TouchableOpacity style={styles.inviteBtn} activeOpacity={0.7}>
                  <Text style={styles.inviteText}>{t('meow.home.inviteFriend')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.friendList}>
                {friends.map((friend, i) => (
                  <View key={i} style={styles.friendRow}>
                    <View style={[styles.avatar, { backgroundColor: C.secondaryContainer }]}>
                      <Text style={styles.avatarText}>{(friend.name ?? '?')[0]}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{friend.name}</Text>
                      <Text style={styles.friendSub}>
                        {friend.wroteToday ? t('meow.home.fedToday') : t('meow.home.notYet')}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: friend.wroteToday ? '#4ade80' : C.outlineVariant },
                    ]} />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* CTA button */}
          <TouchableOpacity style={styles.cta} onPress={handleWriteToday} activeOpacity={0.85}>
            <Ionicons name="create-outline" size={22} color={C.primary} />
            <Text style={styles.ctaText}>{t('meow.home.writeCTA')}</Text>
          </TouchableOpacity>

          {/* Subcopy */}
          <Text style={styles.subcopy}>{t('meow.home.subcopy', { catName: CAT_NAME })}</Text>
        </ScrollView>
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
    paddingTop: 28,
    gap: 24,
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
    alignItems: 'center',
    justifyContent: 'center',
    height: 210,
  },
  catGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,216,190,0.45)',
  },
  catCircle: {
    width: 175,
    height: 175,
    borderRadius: 88,
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
  catEmoji: { fontSize: 80 },

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

  // Friends
  friendsBlock: { gap: 10 },
  emptyFriends: {
    backgroundColor: 'rgba(188,233,217,0.25)',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  emptyText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    fontWeight: '500',
  },
  inviteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: C.secondary,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.secondary,
  },
  friendList: { gap: 8 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 16,
    padding: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: C.secondary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 13, fontWeight: '600', color: C.onSurface },
  friendSub: { fontSize: 12, color: C.outline },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // CTA
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
    marginTop: -8,
    marginBottom: 4,
  },

});
