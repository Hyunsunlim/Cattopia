import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, Platform,
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
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
  orange: '#f97316',
  green: '#16a34a',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STOP = new Set([
  'i','me','my','we','our','you','the','a','an','and','but','or','in','of',
  'to','is','it','was','be','that','this','for','on','are','with','as','at',
  '그','이','저','것','수','때','더','안','잘','또','좀','를','을','에','의',
  '가','은','는','와','과','로','도','나','다','고','하고',
]);

function calcStats(diaries) {
  let totalWords = 0;
  const uniq = new Set();
  diaries.forEach(d => {
    const tokens = (d.content || '').split(/\s+/).filter(Boolean);
    totalWords += tokens.length;
    tokens.forEach(w => {
      const c = w.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
      if (c.length > 1 && !STOP.has(c)) uniq.add(c);
    });
  });
  return { totalWords, uniqueVocab: uniq.size };
}

function calcStreak(diaries) {
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

function avgObj(list, key) {
  const valid = list.filter(d => d[key]);
  if (!valid.length) return null;
  const sums = {};
  valid.forEach(d => Object.entries(d[key]).forEach(([k, v]) => { sums[k] = (sums[k] || 0) + v; }));
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / valid.length]));
}

function structureRates(list) {
  if (!list.length) return null;
  const n = list.length;
  const obs = list.filter(d => d.structure?.observation).length / n;
  const tho = list.filter(d => d.structure?.thought).length / n;
  const ins = list.filter(d => d.structure?.insight).length / n;
  if (obs === 0 && tho === 0 && ins === 0) return null;
  return { observation: obs, thought: tho, insight: ins };
}

// ── Bar row component ─────────────────────────────────────────────────────────

function MetricRow({ label, value, color = C.secondaryFixedDim }) {
  const pct = value !== null && value !== undefined ? Math.round(value * 100) : null;
  return (
    <View style={row.wrap}>
      <Text style={row.label}>{label}</Text>
      <View style={row.track}>
        {pct !== null
          ? <View style={[row.fill, { width: `${pct}%`, backgroundColor: color }]} />
          : <Text style={row.noData}>기록이 쌓이면 보여요</Text>
        }
      </View>
      {pct !== null && <Text style={row.pct}>{pct}%</Text>}
    </View>
  );
}

const row = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 62, fontSize: 13, color: '#4f453e', fontWeight: '500' },
  track: {
    flex: 1, height: 10, borderRadius: 99,
    backgroundColor: '#f0eded', overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { height: '100%', borderRadius: 99, minWidth: 4 },
  pct: { width: 34, fontSize: 12, color: '#81756d', textAlign: 'right' },
  noData: { fontSize: 10, color: '#d3c4bb', paddingLeft: 8 },
});

// ── Main ─────────────────────────────────────────────────────────────────────

export default function MeowInsightScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState('weekly');
  const [diaries, setDiaries] = useState([]);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('diaries').then(raw => setDiaries(raw ? JSON.parse(raw) : []));
  }, []));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (period === 'weekly' ? 7 : 30));
  const subset = diaries.filter(d => new Date(d.timestamp) >= cutoff);

  const { totalWords, uniqueVocab } = calcStats(subset);
  const streak = calcStreak(diaries);
  const thinking = avgObj(subset, 'thinking_type');
  const lens = avgObj(subset, 'language_lens');
  const structure = structureRates(subset);

  return (
    <View style={S.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={S.safe} edges={['top']}>

        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={C.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Insight</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Toggle */}
        <View style={S.toggleWrap}>
          {['weekly', 'monthly'].map(p => (
            <TouchableOpacity
              key={p}
              style={[S.toggleBtn, period === p && S.toggleBtnActive]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.75}
            >
              <Text style={[S.toggleText, period === p && S.toggleTextActive]}>
                {p === 'weekly' ? '이번 주' : '이번 달'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={S.scroll}
          contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Writing Stats */}
          <View style={S.card}>
            <Text style={S.cardTitle}>기록 통계</Text>
            <View style={S.statsRow}>
              <StatChip emoji="🔥" value={`${streak}일`} label="연속 기록" />
              <StatChip emoji="✍️" value={`${subset.length}편`} label={period === 'weekly' ? '이번 주' : '이번 달'} />
              <StatChip emoji="📖" value={totalWords.toLocaleString()} label="총 단어" />
            </View>
            <View style={S.vocabRow}>
              <Ionicons name="text-outline" size={14} color={C.outline} />
              <Text style={S.vocabText}>고유 단어 {uniqueVocab.toLocaleString()}개</Text>
            </View>
          </View>

          {/* Thinking type */}
          <View style={S.card}>
            <Text style={S.cardTitle}>사고방식</Text>
            <View style={S.barList}>
              <MetricRow label="인과 추론" value={thinking?.causal_reasoning} color="#2D7DD2" />
              <MetricRow label="해석" value={thinking?.interpretation} color="#7B1FA2" />
              <MetricRow label="사건 나열" value={thinking?.event_listing} color="#C62828" />
            </View>
          </View>

          {/* Language lens */}
          <View style={S.card}>
            <Text style={S.cardTitle}>세계관</Text>
            <View style={S.barList}>
              <MetricRow label="탐색" value={lens?.open} color={C.secondaryFixedDim} />
              <MetricRow label="단정" value={lens?.closed} color="#64748b" />
              <MetricRow label="절대화" value={lens?.rigid} color="#9CA3AF" />
              <MetricRow label="수동" value={lens?.passive} color="#D1D5DB" />
            </View>
          </View>

          {/* Structure */}
          <View style={S.card}>
            <Text style={S.cardTitle}>글쓰기 구조</Text>
            <View style={S.barList}>
              <MetricRow label="관찰" value={structure?.observation} color="#007AFF" />
              <MetricRow label="생각" value={structure?.thought} color="#AF52DE" />
              <MetricRow label="통찰" value={structure?.insight} color="#FF9F0A" />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatChip({ emoji, value, label }) {
  return (
    <View style={chip.wrap}>
      <Text style={chip.emoji}>{emoji}</Text>
      <Text style={chip.value}>{value}</Text>
      <Text style={chip.label}>{label}</Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 4 },
  emoji: { fontSize: 22 },
  value: { fontSize: 18, fontWeight: '700', color: C.primary, fontFamily: SERIF },
  label: { fontSize: 11, color: C.outline },
});

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.onSurface, fontFamily: SERIF },

  toggleWrap: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 99,
    backgroundColor: C.surfaceContainerLow,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: C.primary },
  toggleText: { fontSize: 14, fontWeight: '600', color: C.outline },
  toggleTextActive: { color: '#ffffff' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },

  card: {
    backgroundColor: C.surface, borderRadius: 18, padding: 18, gap: 14,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  statsRow: { flexDirection: 'row' },
  vocabRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 },
  vocabText: { fontSize: 12, color: C.outline },
  barList: { gap: 12 },
});
