import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

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
  tertiaryContainer: '#e2dfd9',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
  orange: '#f97316',
};

const TOTAL_STORIES = 66;
const CAT_NAME = 'Choco';
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

// graduatedCats item shape:
// { id, name, emoji, completedAt, storiesCount }

export default function OurHouseScreen() {
  const insets = useSafeAreaInsets();
  const [diaryCount, setDiaryCount] = useState(0);
  const [friends, setFriends] = useState([]);
  const [graduatedCats, setGraduatedCats] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [diariesRaw, friendsRaw, graduatedRaw] = await Promise.all([
        AsyncStorage.getItem('diaries'),
        AsyncStorage.getItem('friends'),
        AsyncStorage.getItem('graduatedCats'),
      ]);

      if (diariesRaw) setDiaryCount(JSON.parse(diariesRaw).length);

      if (friendsRaw === null) {
        await AsyncStorage.setItem('friends', JSON.stringify([]));
        setFriends([]);
      } else {
        setFriends(JSON.parse(friendsRaw));
      }

      if (graduatedRaw === null) {
        await AsyncStorage.setItem('graduatedCats', JSON.stringify([]));
        setGraduatedCats([]);
      } else {
        setGraduatedCats(JSON.parse(graduatedRaw));
      }
    } catch (e) {
      console.error('OurHouseScreen loadData error:', e);
    }
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        message: `함께 고양이를 키워봐요! 🐱\nMeow 앱에서 매일 이야기를 쓰면 고양이가 자라요.\n지금 초대할게요!`,
        title: 'Meow — 함께 키우기',
      });
    } catch (e) {
      // user dismissed share sheet
    }
  };

  const progress = Math.min(1, diaryCount / TOTAL_STORIES);
  const progressPct = `${Math.round(progress * 100)}%`;
  const isMyCatComplete = diaryCount >= TOTAL_STORIES;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerBadge}>
              <Text style={{ fontSize: 18 }}>🐱</Text>
            </View>
            <Text style={styles.headerTitle}>Our House</Text>
          </View>
          <TouchableOpacity onPress={handleInvite} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="person-add-outline" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 지금 키우는 중 ────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>지금 키우는 중</Text>

            <View style={styles.catGrid}>
              {/* 내 고양이 카드 */}
              <MyCatCard
                name={CAT_NAME}
                count={diaryCount}
                progressPct={progressPct}
              />

              {/* 친구 고양이 카드 (friends 있을 때만) */}
              {friends.map((friend, i) => (
                <FriendCatCard key={i} friend={friend} />
              ))}
            </View>
          </View>

          {/* ── 친구 없는 상태 ────────────────────────────────── */}
          {friends.length === 0 && (
            <View style={styles.emptyFriends}>
              <Text style={styles.emptyFriendsText}>
                아직 함께 키우는 친구가 없어요
              </Text>
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={handleInvite}
                activeOpacity={0.75}
              >
                <Text style={styles.inviteBtnText}>친구 초대하기 →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── 졸업한 고양이들 ───────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>졸업한 고양이들 🎓</Text>

            <View style={styles.catGrid}>
              {graduatedCats.map((cat, i) => (
                <GraduatedCatCard key={i} cat={cat} />
              ))}
              {/* "다음 고양이를 키워봐요" 슬롯 */}
              <View style={styles.nextCatSlot}>
                <Text style={styles.nextCatIcon}>+</Text>
                <Text style={styles.nextCatText}>다음 고양이를{'\n'}키워봐요</Text>
              </View>
            </View>
          </View>

          {/* ── 유기묘 후원 배너 (고양이 완성 시에만 노출) ─────── */}
          {isMyCatComplete && (
            <View style={styles.donationBanner}>
              <Text style={styles.donationEmoji}>🐾</Text>
              <View style={styles.donationText}>
                <Text style={styles.donationTitle}>고양이를 완성했어요!</Text>
                <Text style={styles.donationSub}>유기묘 후원으로 실제 고양이도 도와줘요</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.outline} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MyCatCard({ name, count, progressPct }) {
  return (
    <View style={[styles.catCard, styles.myCatCard]}>
      <View style={[styles.catImageBox, { backgroundColor: 'rgba(255,216,190,0.35)' }]}>
        <Text style={styles.catEmoji}>🐱</Text>
      </View>
      <View style={styles.catCardMeta}>
        <Text style={styles.catCardName}>{name}</Text>
        <Text style={styles.catCardSub}>나 · {count}편</Text>
      </View>
      <View style={styles.miniTrack}>
        <View style={[styles.miniFill, { width: progressPct }]} />
      </View>
    </View>
  );
}

function FriendCatCard({ friend }) {
  const friendProgress = Math.min(1, (friend.count ?? 0) / TOTAL_STORIES);
  const friendPct = `${Math.round(friendProgress * 100)}%`;
  const todayDot = friend.wroteToday ? '#4ade80' : C.outlineVariant;

  return (
    <View style={[styles.catCard, styles.friendCatCard]}>
      <View style={[styles.catImageBox, { backgroundColor: 'rgba(188,233,217,0.35)' }]}>
        <Text style={styles.catEmoji}>{friend.catEmoji ?? '😺'}</Text>
      </View>
      <View style={styles.catCardMeta}>
        <View style={styles.catCardNameRow}>
          <Text style={styles.catCardName}>{friend.catName ?? '?'}</Text>
          <View style={[styles.friendDot, { backgroundColor: todayDot }]} />
        </View>
        <Text style={styles.catCardSub}>{friend.name} · {friend.count ?? 0}편</Text>
      </View>
      <View style={styles.miniTrack}>
        <View style={[styles.miniFill, { width: friendPct }]} />
      </View>
    </View>
  );
}

function GraduatedCatCard({ cat }) {
  return (
    <View style={[styles.catCard, styles.graduatedCard]}>
      <View style={[styles.catImageBox, { backgroundColor: 'rgba(226,223,217,0.4)' }]}>
        <Text style={styles.catEmoji}>{cat.emoji ?? '😸'}</Text>
      </View>
      <View style={styles.catCardMeta}>
        <Text style={[styles.catCardName, { color: C.onSurfaceVariant }]}>{cat.name}</Text>
        <Text style={styles.catCardSub}>66편 완성 ✨</Text>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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
  headerBadge: {
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
    fontFamily: SERIF,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 28,
  },

  // Section
  section: { gap: 14 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.onSurfaceVariant,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Cat card grid
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Shared cat card
  catCard: {
    width: '47.5%',
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  myCatCard: {
    backgroundColor: C.surfaceContainerLow,
  },
  friendCatCard: {
    backgroundColor: C.surfaceContainerLow,
  },
  graduatedCard: {
    opacity: 0.72,
  },

  catImageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catEmoji: { fontSize: 48 },

  catCardMeta: { gap: 2 },
  catCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onSurface,
  },
  catCardSub: {
    fontSize: 12,
    color: C.outline,
  },
  friendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Mini progress bar
  miniTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: C.surfaceContainer,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: C.secondaryFixedDim,
    minWidth: 6,
  },

  // "다음 고양이를 키워봐요" slot
  nextCatSlot: {
    width: '47.5%',
    aspectRatio: 0.9,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.outlineVariant,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nextCatIcon: {
    fontSize: 28,
    color: C.outlineVariant,
    fontWeight: '300',
  },
  nextCatText: {
    fontSize: 12,
    color: C.outlineVariant,
    textAlign: 'center',
    lineHeight: 18,
  },

  // 친구 없는 상태
  emptyFriends: {
    backgroundColor: 'rgba(188,233,217,0.22)',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
    marginTop: -8,
  },
  emptyFriendsText: {
    fontSize: 14,
    color: C.onSurfaceVariant,
    fontWeight: '500',
    textAlign: 'center',
  },
  inviteBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: C.secondary,
  },
  inviteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.secondary,
  },

  // 유기묘 후원 배너
  donationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(211,196,187,0.5)',
  },
  donationEmoji: { fontSize: 28 },
  donationText: { flex: 1, gap: 3 },
  donationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onSurface,
  },
  donationSub: {
    fontSize: 12,
    color: C.outline,
  },
});
