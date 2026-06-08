import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, Alert, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
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
  green: '#16a34a',
  red: '#dc2626',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const TOTAL_STORIES = 66;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(weeksAgo) {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: monday, end: weeksAgo === 0 ? today : end };
}

function getWeekLabel(date, locale) {
  const lang = (locale || 'en').split('-')[0];
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const w = Math.ceil((date.getDate() + firstDay.getDay()) / 7);
  const monthStr = date.toLocaleDateString(lang, { month: 'long' });
  return lang === 'ko' ? `${monthStr} ${w}주차` : `${monthStr} W${w}`;
}

function filterByRange(diaries, start, end) {
  return diaries.filter(d => { const t = new Date(d.timestamp); return t >= start && t <= end; });
}

function streakDays(diaries) {
  const today = new Date();
  let streak = 0;
  const d = new Date(today);
  while (streak < 365) {
    const key = d.toLocaleDateString('en-US');
    if (!diaries.some(e => new Date(e.timestamp).toLocaleDateString('en-US') === key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function topThinkingStyle(diaries) {
  const valid = diaries.filter(d => d.thinking_type);
  if (!valid.length) return null;
  const sums = { causal_reasoning: 0, interpretation: 0, event_listing: 0 };
  valid.forEach(d => Object.entries(d.thinking_type).forEach(([k, v]) => { sums[k] = (sums[k] || 0) + v; }));
  const top = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
  const labels = { causal_reasoning: '인과 추론', interpretation: '해석', event_listing: '사건 나열' };
  return labels[top[0]];
}

function generateHeadlineKey(thisWeek, streak, allDiaries) {
  if (!thisWeek.length && !allDiaries.length) return 'waiting';
  if (streak >= 7) return 'improving';
  if (streak >= 5) return 'consistent';
  const style = topThinkingStyle(thisWeek);
  if (style === '인과 추론') return 'causal';
  if (style === '해석') return 'interpretation';
  if (thisWeek.length >= 5) return 'hardWorking';
  if (thisWeek.length > 0) return 'decent';
  return 'quiet';
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReportScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { catName } = useCatName();
  const insets = useSafeAreaInsets();
  const [diaries, setDiaries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('diaries').then(raw => {
      setDiaries(raw ? JSON.parse(raw) : []);
      setLoaded(true);
    });
  }, []));

  if (!loaded) return <View style={S.root} />;

  const { start: w0s, end: w0e } = getWeekBounds(0);
  const { start: w1s, end: w1e } = getWeekBounds(1);
  const thisWeek = filterByRange(diaries, w0s, w0e);
  const lastWeek = filterByRange(diaries, w1s, w1e);

  const streak = streakDays(diaries);
  const total = diaries.length;
  const progress = Math.min(1, total / TOTAL_STORIES);
  const thisLabel = getWeekLabel(w0s, i18n.language);
  const lastLabel = getWeekLabel(w1s, i18n.language);
  const headlineKey = generateHeadlineKey(thisWeek, streak, diaries);
  const headline = t(`meow.report.${headlineKey}`, { catName: catName });

  // Week-over-week change
  const weekDelta = thisWeek.length - lastWeek.length;
  const deltaColor = weekDelta > 0 ? C.green : weekDelta < 0 ? C.red : C.outline;
  const deltaText = weekDelta > 0 ? `+${weekDelta}` : `${weekDelta}`;

  const handleShare = () => {
    Alert.alert(t('meow.report.shareComingSoonTitle'), t('meow.report.shareComingSoonMessage'));
  };

  return (
    <View style={S.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={S.safe} edges={['top']}>

        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>{t('meow.report.title')}</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView
          style={S.scroll}
          contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          <View style={S.summaryCard}>
            <Text style={S.weekLabel}>{thisLabel} vs {lastLabel}</Text>
            <Text style={S.headline}>{headline}</Text>
            <View style={S.summaryFooter}>
              <View style={S.catIcon}><Text style={{ fontSize: 20 }}>🐱</Text></View>
              <Text style={S.footerText}>{t('meow.report.catFooter', { catName: catName })}</Text>
            </View>
          </View>

          {/* 3 stat chips */}
          <View style={S.statsRow}>
            <View style={S.statCard}>
              <Text style={S.statEmoji}>🔥</Text>
              <Text style={S.statValue}>{streak}<Text style={S.statUnit}>{t('meow.report.streakUnit')}</Text></Text>
              <Text style={S.statLabel}>{t('meow.report.streak')}</Text>
            </View>
            <View style={S.statCard}>
              <Text style={S.statEmoji}>✍️</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={S.statValue}>{thisWeek.length}<Text style={S.statUnit}>{t('meow.report.entryUnit')}</Text></Text>
                {lastWeek.length > 0 && (
                  <Text style={[S.deltaText, { color: deltaColor }]}>{deltaText}</Text>
                )}
              </View>
              <Text style={S.statLabel}>{t('meow.report.thisWeek')}</Text>
            </View>
            <View style={S.statCard}>
              <Text style={S.statEmoji}>🐾</Text>
              <Text style={S.statValue}>{total}<Text style={S.statUnit}>/{TOTAL_STORIES}</Text></Text>
              <Text style={S.statLabel}>{t('meow.report.catGrowth', { catName: catName })}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={S.progressCard}>
            <View style={S.progressHeader}>
              <Text style={S.progressLabel}>{t('meow.report.catGrowth', { catName })}</Text>
              <Text style={S.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={S.progressTrack}>
              <View style={[S.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={S.progressNote}>
              {Math.max(0, TOTAL_STORIES - total) > 0
                ? t('meow.report.remaining', { n: TOTAL_STORIES - total })
                : t('meow.report.grownUp')}
            </Text>
          </View>

          {/* Buttons */}
          <View style={S.btnRow}>
            <TouchableOpacity style={[S.btn, S.btnOutline]} onPress={handleShare} activeOpacity={0.75}>
              <Ionicons name="share-outline" size={18} color={C.primary} />
              <Text style={[S.btnText, { color: C.primary }]}>{t('meow.report.shareButton')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.btn, S.btnFill]}
              onPress={() => navigation.navigate('Insight')}
              activeOpacity={0.75}
            >
              <Ionicons name="bar-chart-outline" size={18} color="#fff" />
              <Text style={[S.btnText, { color: '#fff' }]}>{t('meow.report.detailButton')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.onSurface, fontFamily: SERIF },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },

  // Summary
  summaryCard: {
    backgroundColor: C.secondaryContainer, borderRadius: 20, padding: 20, gap: 10,
  },
  weekLabel: { fontSize: 11, fontWeight: '700', color: C.secondary, letterSpacing: 0.4, textTransform: 'uppercase' },
  headline: { fontSize: 22, fontWeight: '700', color: C.onSurface, fontFamily: SERIF, lineHeight: 30 },
  summaryFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4,
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(61,102,90,0.2)',
  },
  catIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  footerText: { fontSize: 13, color: C.secondary, fontWeight: '500' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 16,
    padding: 14, alignItems: 'center', gap: 4,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.primary, fontFamily: SERIF },
  statUnit: { fontSize: 13, fontWeight: '500', color: C.outline },
  statLabel: { fontSize: 11, color: C.outline },
  deltaText: { fontSize: 12, fontWeight: '700', marginBottom: 1 },

  // Progress
  progressCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 18, gap: 10,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 14, fontWeight: '600', color: C.onSurface },
  progressPct: { fontSize: 14, fontWeight: '700', color: C.secondary },
  progressTrack: { height: 12, borderRadius: 99, backgroundColor: C.surfaceContainer, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: C.secondaryFixedDim, minWidth: 8 },
  progressNote: { fontSize: 12, color: C.outline, textAlign: 'center' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 99,
  },
  btnOutline: { borderWidth: 1.5, borderColor: C.primary },
  btnFill: { backgroundColor: C.primary },
  btnText: { fontSize: 15, fontWeight: '700' },
});
