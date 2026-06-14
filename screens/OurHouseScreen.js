import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useInviteFriend } from '../hooks/useInviteFriend';
import { InviteToast } from '../components/InviteFriendUI';
import { fetchFriends, getCachedFriends, removeFriend as removeFriendAPI } from '../services/friends';

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

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const DAILY_WORDS_MAX = 300;

const EMOTION_DISPLAY = {
  joy:      { label: 'Happy',   emoji: '🐾', bg: '#d1fae5', color: '#065f46' },
  neutral:  { label: 'Calm',    emoji: '😌', bg: '#f3f4f6', color: '#4f453e' },
  sadness:  { label: 'Sad',     emoji: '🌧️', bg: '#dbeafe', color: '#1e40af' },
  anger:    { label: 'Grumpy',  emoji: '😾', bg: '#fee2e2', color: '#991b1b' },
  fear:     { label: 'Scared',  emoji: '🙀', bg: '#ede9fe', color: '#5b21b6' },
  surprise: { label: 'Curious', emoji: '👀', bg: '#fef3c7', color: '#92400e' },
  disgust:  { label: 'Bleh',    emoji: '😿', bg: '#d1fae5', color: '#065f46' },
};

const getOrCreateInviteCode = async () => {
  const existing = await AsyncStorage.getItem('myInviteCode');
  if (existing) return existing;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await AsyncStorage.setItem('myInviteCode', code);
  return code;
};

const INVITE_SENT_KEY = 'invite_sent';

export default function OurHouseScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState([]);
  const [inviteSent, setInviteSent] = useState(false);

  const { toastAnim, toastMessage, sendInvite } = useInviteFriend();
  const inviting = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!inviting.current) loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const flag = await AsyncStorage.getItem(INVITE_SENT_KEY);
      setInviteSent(flag === 'true');
      const cached = await getCachedFriends();
      if (cached.length > 0) setFriends(cached);
      const data = await fetchFriends();
      setFriends(data);
    } catch (e) {
      console.error('OurHouseScreen loadData error:', e);
    }
  };

  const handleInvite = async () => {
    inviting.current = true;
    const result = await sendInvite();
    inviting.current = false;
    if (result === 'sent') {
      await AsyncStorage.setItem(INVITE_SENT_KEY, 'true');
      setInviteSent(true);
    } else {
      await AsyncStorage.setItem(INVITE_SENT_KEY, 'false');
      setInviteSent(false);
    }
    loadData();
  };

  const handleRemoveFriend = (friend) => {
    const displayName = friend.username || friend.name || t('meow.ourHouse.friendFallback');
    Alert.alert(
      t('meow.ourHouse.disconnectTitle'),
      t('meow.ourHouse.disconnectMessage', { name: displayName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('meow.ourHouse.disconnectTitle'),
          style: 'destructive',
          onPress: async () => {
            setFriends(prev => prev.filter(f => f.id !== friend.id));
            try {
              if (!String(friend.id).startsWith('pending-')) {
                await removeFriendAPI(friend.id);
              }
            } catch (e) {
              console.warn('Remove friend error:', e);
              loadData(); // revert on error
            }
          },
        },
      ],
    );
  };

  const activeFriends = friends.filter(f => f.status === 'accepted');
  const invitedFriends = friends.filter(f => f.status === 'pending' && (f.username || inviteSent));

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <InviteToast toastAnim={toastAnim} toastMessage={toastMessage} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerBadge}>
              <Text style={{ fontSize: 18 }}>🐱</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>{t('meow.ourHouse.title')}</Text>
              <Text style={styles.headerSub}>{t('meow.ourHouse.headerSub')}</Text>
            </View>
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
          {activeFriends.map((friend, i) => (
            <ActiveFriendCard key={friend.id ?? i} friend={friend} onRemove={() => handleRemoveFriend(friend)} t={t} />
          ))}

          {invitedFriends.map((friend, i) => (
            <InvitedFriendCard key={friend.id ?? `inv-${i}`} friend={friend} onRemove={() => handleRemoveFriend(friend)} t={t} />
          ))}

          {activeFriends.length === 0 && invitedFriends.length === 0
            ? <EmptyHouseState onPress={handleInvite} t={t} />
            : <GrowColonyCard onPress={handleInvite} t={t} />
          }
        </ScrollView>
      </SafeAreaView>

    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const TOTAL_STORIES = 66;

function ActiveFriendCard({ friend, onRemove, t }) {
  const emotion = EMOTION_DISPLAY[friend.todayEmotion] ?? EMOTION_DISPLAY[friend.lastEmotion] ?? null;
  const wroteToday = friend.wroteToday ?? false;
  const noteCount = friend.noteCount ?? 0;
  const fillPct = `${Math.min(100, Math.round((noteCount / TOTAL_STORIES) * 100))}%`;

  return (
    <TouchableOpacity
      style={styles.friendCard}
      onLongPress={onRemove}
      delayLongPress={500}
      activeOpacity={1}
    >
      <View style={styles.cardTop}>
        <View style={styles.catImageBox}>
          <Text style={styles.catEmoji}>{friend.catEmoji ?? '🐱'}</Text>
          {wroteToday ? (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: C.outlineVariant }]} />
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.catName}>{friend.catName || friend.cat_name || friend.username}</Text>
          {emotion ? (
            <View style={[styles.emotionBadge, { backgroundColor: emotion.bg, opacity: wroteToday ? 1 : 0.5 }]}>
              <Text style={[styles.emotionText, { color: emotion.color }]}>
                {emotion.label} {emotion.emoji}
              </Text>
            </View>
          ) : (
            <View style={[styles.emotionBadge, { backgroundColor: C.surfaceContainer }]}>
              <Text style={[styles.emotionText, { color: C.outline }]}>{t('meow.ourHouse.notFedYet')}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={C.outline} />
        </TouchableOpacity>
      </View>

      <View style={[styles.progressSection, { opacity: wroteToday ? 1 : 0.4 }]}>
        <Text style={styles.progressLabel}>{noteCount} / {TOTAL_STORIES}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: fillPct }]}>
            <Text style={styles.pawOnFill}>🐾</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function InvitedFriendCard({ friend, onRemove, t }) {
  const daysAgo = Math.floor(
    (Date.now() - new Date(friend.invitedAt ?? Date.now()).getTime()) / 86400000
  );
  const timeLabel = daysAgo === 0 ? t('meow.ourHouse.today') : t('meow.ourHouse.daysAgo', { n: daysAgo });

  return (
    <TouchableOpacity
      style={[styles.friendCard, styles.invitedCard]}
      onLongPress={onRemove}
      delayLongPress={500}
      activeOpacity={1}
    >
      <View style={styles.invitedAvatar}>
        <Ionicons name="person-outline" size={22} color={C.outline} />
      </View>
      <View style={styles.invitedInfo}>
        <Text style={styles.invitedName}>{friend.username || t('meow.ourHouse.pendingPlaceholder')}</Text>
        <Text style={styles.invitedEmail}>{friend.is_sender ? t('meow.ourHouse.waitingAccept') : t('meow.ourHouse.invitedStatus')}</Text>
      </View>
      <View style={styles.invitedMeta}>
        <Text style={styles.invitedTime}>{timeLabel}</Text>
        <View style={styles.pendingBadge}>
          <Ionicons name="time-outline" size={11} color={C.primary} />
          <Text style={styles.pendingText}>{t('meow.ourHouse.pendingPlaceholder')}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.moreBtn}>
        <Ionicons name="ellipsis-horizontal" size={18} color={C.outline} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function EmptyHouseState({ onPress, t }) {
  const steps = [
    t('meow.ourHouse.emptyStep1'),
    t('meow.ourHouse.emptyStep2'),
    t('meow.ourHouse.emptyStep3'),
  ];
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyCats}>🐱🐱</Text>
      <Text style={styles.emptyTitle}>{t('meow.ourHouse.emptyTitle')}</Text>
      <Text style={styles.emptyDesc}>{t('meow.ourHouse.emptyDesc')}</Text>
      <View style={styles.stepsWrap}>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.emptyBtn} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.emptyBtnText}>{t('meow.ourHouse.emptyBtn')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function GrowColonyCard({ onPress, t }) {
  return (
    <TouchableOpacity style={styles.growCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.growIconCircle}>
        <Ionicons name="person-add-outline" size={24} color={C.outline} />
      </View>
      <Text style={styles.growTitle}>{t('meow.ourHouse.growTitle')}</Text>
      <Text style={styles.growSub}>{t('meow.ourHouse.growSub')}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(211,196,187,0.6)',
    backgroundColor: C.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20, fontWeight: '700',
    color: C.onSurface, fontFamily: SERIF, lineHeight: 24,
  },
  headerSub: { fontSize: 12, color: C.outline, marginTop: 1 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

  // Active friend card
  friendCard: {
    backgroundColor: C.surface,
    borderRadius: 20, padding: 16, gap: 14,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  catImageBox: {
    width: 72, height: 72, borderRadius: 16,
    backgroundColor: 'rgba(255,216,190,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#4ade80',
    borderWidth: 2, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  catEmoji: { fontSize: 40 },
  cardInfo: { flex: 1, gap: 8 },
  moreBtn: { padding: 4, alignSelf: 'flex-start' },
  catName: { fontSize: 18, fontWeight: '700', color: C.onSurface, fontFamily: SERIF },
  emotionBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  emotionText: { fontSize: 13, fontWeight: '600' },

  progressSection: { gap: 8 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 12, fontWeight: '600', color: C.onSurfaceVariant },
  wordCount: { fontSize: 16, fontWeight: '700', color: C.primary, fontFamily: SERIF },
  progressTrack: {
    height: 20, borderRadius: 99,
    backgroundColor: C.surfaceContainer, overflow: 'hidden', padding: 2,
  },
  progressFill: {
    height: '100%', borderRadius: 99,
    backgroundColor: C.secondaryFixedDim,
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingRight: 2, minWidth: 20,
  },
  pawOnFill: { fontSize: 10, lineHeight: 14 },

  // Invited card
  invitedCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  invitedAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.surfaceContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  invitedInfo: { flex: 1 },
  invitedName: { fontSize: 15, fontWeight: '600', color: C.onSurface },
  invitedEmail: { fontSize: 12, color: C.outline, marginTop: 2 },
  invitedMeta: { alignItems: 'flex-end', gap: 4 },
  invitedTime: { fontSize: 12, color: C.outline },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pendingText: { fontSize: 12, fontWeight: '600', color: C.primary },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, gap: 0,
  },
  emptyCats: { fontSize: 52, letterSpacing: -4, marginBottom: 20 },
  emptyTitle: {
    fontSize: 18, fontWeight: '700', color: C.onSurface,
    fontFamily: SERIF, textAlign: 'center', lineHeight: 26, marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 14, color: C.outline, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  stepsWrap: { width: '100%', gap: 10, marginBottom: 28 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
  },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: 12, fontWeight: '700', color: C.primary },
  stepText: { fontSize: 13, color: C.onSurfaceVariant, flex: 1, lineHeight: 18 },
  emptyBtn: {
    width: '100%', paddingVertical: 16, borderRadius: 99,
    backgroundColor: C.primaryContainer, alignItems: 'center',
  },
  emptyBtnText: {
    fontSize: 16, fontWeight: '700', color: C.primary, fontFamily: SERIF,
  },

  // Grow the colony
  growCard: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.outlineVariant,
    borderRadius: 20, paddingVertical: 28, paddingHorizontal: 20,
    alignItems: 'center', gap: 10, marginTop: 4,
  },
  growIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.surfaceContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  growTitle: { fontSize: 16, fontWeight: '700', color: C.onSurfaceVariant, fontFamily: SERIF },
  growSub: { fontSize: 13, color: C.outline, textAlign: 'center' },

});
