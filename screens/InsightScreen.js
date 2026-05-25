import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { analyzeLanguagePatterns } from '../utils/languageAnalysis';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { Svg, Polygon, Polyline, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useCatName } from '../context/CatNameContext';
import { useTheme } from '../context/ThemeContext';

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const screenWidth = Dimensions.get('window').width;

// ── Activity tab constants ────────────────────────────────────────────────────
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TAG_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const NO_TAG_COLOR = '#6b7280';
const DAY_WIDTH = Math.floor((screenWidth - 32) / 7);
const MOOD_CELL_SIZE = Math.floor((screenWidth - 68) / 7);

const EMOJI_MAP = {
  joy: '😊', sadness: '😢', anger: '😠', fear: '😨',
  surprise: '😮', disgust: '🤢', neutral: '😐', uncertain: '🤔',
};

// ── Language tab constants ────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'i','me','my','we','our','you','your','he','him','his','she','her','it','its',
  'they','them','their','this','that','these','those','am','is','are','was','were',
  'be','been','being','have','has','had','do','does','did','will','would','could',
  'should','may','might','must','a','an','the','and','but','or','for','so','yet',
  'at','by','in','of','on','to','up','as','if','into','with','about','not','no',
  'just','very','also','then','than','when','what','how','all','any','some','more',
  'from','get','got','can','one','out','had','well','now','too','even','back',
  '그','이','저','것','수','등','때','중','더','안','잘','또','좀','를','을',
  '에','의','가','은','는','와','과','로','으로','도','나','다','고','하고',
]);

const THESAURUS = {
  good:['great','wonderful','excellent','superb'],
  bad:['poor','terrible','awful','dreadful'],
  happy:['joyful','delighted','elated','content'],
  sad:['melancholy','sorrowful','gloomy','downcast'],
  think:['ponder','reflect','consider','contemplate'],
  feel:['sense','experience','perceive','notice'],
  want:['desire','wish','crave','yearn'],
  know:['understand','realize','recognize','grasp'],
  see:['observe','notice','perceive','spot'],
  make:['create','craft','build','construct'],
  time:['moment','period','occasion','while'],
  really:['truly','genuinely','deeply','sincerely'],
  always:['consistently','continually','perpetually','constantly'],
  never:['rarely','seldom','hardly','scarcely'],
  hard:['challenging','difficult','demanding','tough'],
  easy:['effortless','simple','smooth','straightforward'],
  day:['moment','period','occasion','instance'],
  people:['others','folks','individuals','persons'],
  work:['effort','task','labor','endeavor'],
  life:['existence','journey','experience','world'],
};

const EMOTION_BAR_COLORS = {
  joy: '#f59e0b',
  neutral: '#8E8E93',
  fear: '#8b5cf6',
  sadness: '#3b82f6',
  surprise: '#f97316',
  anger: '#ef4444',
  disgust: '#22c55e',
  uncertain: '#a78bfa',
};

const emotionToScore = (emotion) => {
  const map = { joy: 1, surprise: 0.5, neutral: 0, uncertain: -0.2, fear: -0.6, sadness: -0.8, disgust: -0.9, anger: -1 };
  return map[emotion] ?? 0;
};

const emotionToDisplayScore = (emotion) => {
  const map = { joy: 4, surprise: 3.5, neutral: 2, uncertain: 1.5, fear: 1, sadness: 0.5, disgust: 0.3, anger: 0 };
  return map[emotion] ?? 2;
};

const scoreToMoodLabel = (score) => {
  if (score > 0.5) return 'Great';
  if (score > 0.1) return 'Good';
  if (score > -0.1) return 'Okay';
  if (score > -0.5) return 'Low';
  return 'Very Low';
};

const scoreToMoodEmoji = (score) => {
  if (score > 0.5) return '😊';
  if (score > 0.1) return '🙂';
  if (score > -0.1) return '😐';
  if (score > -0.5) return '😢';
  return '😭';
};

function getUniqueTags(diaries) {
  const set = new Set(diaries.map(d => d.tag || null));
  return [...set].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  });
}

function getTagColor(tag, allTags) {
  if (!tag) return NO_TAG_COLOR;
  const idx = allTags.filter(Boolean).indexOf(tag);
  return TAG_COLORS[idx % TAG_COLORS.length];
}

// ── Keyword extraction patterns ──────────────────────────────────────────────
const THINKING_KW = {
  causal_reasoning: [
    /[\uAC00-\uD7A3]+(?:으니까|니까|기때문에|때문에|이라서|라서|아서|어서|으므로|이므로|므로|탓에|덕분에)/g,
    /그래서인지|그러니까|그래서|따라서|그러므로|그런데도/g,
    /\b(?:because|since|therefore|thus|hence|so that|as a result|which is why)\b/gi,
  ],
  interpretation: [
    /[\uAC00-\uD7A3]+(?:것 같|것같|인 듯|인듯|느낌|느껴|생각이|이해가|보인|보여)/g,
    /\b(?:I think|I feel|it seems|I believe|I realize|I notice|feels like|looks like|means)\b/gi,
  ],
  event_listing: [
    /[\uAC00-\uD7A3]+(?:했고|이었고|았고|었고|그렇고|그랬고)/g,
    /그리고|또한|이후에|다음에|이후|그다음/g,
    /\b(?:then|after that|next|and then|first|finally|later|afterwards)\b/gi,
  ],
};

const LENS_KW = {
  closed: [
    /어차피|당연히|무조건|절대로?|확실히|분명히|틀림없이|반드시/g,
    /\b(?:obviously|definitely|certainly|absolutely|clearly|of course|without doubt)\b/gi,
  ],
  rigid: [
    /항상|늘|매번|원래|여전히|맨날|언제나/g,
    /\b(?:always|every time|never|as usual|once again|still|keeps happening)\b/gi,
  ],
  passive: [
    /[\uAC00-\uD7A3]+(?:됐잖아|게 됐|하게 됐|되어버렸)/g,
    /어쩔 수 없|저절로/g,
    /\b(?:it happened|ended up|couldn't help|things turned out|happened to|somehow)\b/gi,
  ],
  open: [
    /혹시|어쩌면|아마도?|일까|할까|아닐까|모르겠|궁금/g,
    /\b(?:maybe|perhaps|wonder|curious|what if|might be|could be|possibly)\b/gi,
  ],
};

function extractKeywords(text, patterns) {
  const results = {};
  Object.entries(patterns).forEach(([cat, pats]) => {
    const found = new Set();
    pats.forEach(pat => {
      (text.match(new RegExp(pat.source, pat.flags)) || []).forEach(m => found.add(m.trim()));
    });
    results[cat] = [...found].slice(0, 5);
  });
  return results;
}

// ── Reusable trend line chart ─────────────────────────────────────────────────
// ── Insight 빈 상태 skeleton ──────────────────────────────────────────────────

function InsightSkeleton({ shimmer = false }) {
  const shimmerAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!shimmer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const Bone = ({ w = '100%', h = 14, r = 8, style }) => (
    <Animated.View
      style={[{
        width: w, height: h, borderRadius: r,
        backgroundColor: '#d3c4bb', opacity: shimmer ? shimmerAnim : 1,
      }, style]}
    />
  );

  return (
    <ScrollView
      scrollEnabled={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, gap: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* KPI 3개 */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0,1,2].map(i => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 10, backgroundColor: '#f0eded', borderRadius: 16, padding: 16 }}>
            <Bone w={48} h={48} r={24} />
            <Bone w="70%" h={10} />
            <Bone w="50%" h={8} />
          </View>
        ))}
      </View>

      {/* 요일 패턴 */}
      <View style={{ gap: 10 }}>
        <Bone w="40%" h={14} r={6} />
        <View style={{ backgroundColor: '#f0eded', borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 100 }}>
            {[60,80,50,30,30,70,90].map((h, i) => (
              <Bone key={i} w={28} h={h} r={6} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <Bone key={d} w={28} h={8} r={4} />
            ))}
          </View>
        </View>
      </View>

      {/* 감정 분포 */}
      <View style={{ gap: 10 }}>
        <Bone w="40%" h={14} r={6} />
        <View style={{ backgroundColor: '#f0eded', borderRadius: 16, padding: 16, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#d3c4bb', top: 30, left: 60 }} />
          <View style={{ position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#c4b5aa', top: 60, left: 20 }} />
          <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#bba898', bottom: 20, right: 30 }} />
        </View>
      </View>
    </ScrollView>
  );
}

const emptyS = StyleSheet.create({
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(107,76,42,0.08)',
    borderRadius: 12,
    padding: 14,
  },
  nudgeEmoji: { fontSize: 22 },
  nudgeText: {
    flex: 1,
    fontSize: 13,
    color: '#7A5230',
    lineHeight: 20,
  },
  ctaWrap: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#fbf9f8',
  },
  ctaBtn: {
    backgroundColor: '#6B4C2A',
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6B4C2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnText: {
    color: '#F7F2EA',
    fontSize: 15,
    fontWeight: '600',
  },
});

function TrendLegend({ series, theme }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
      {series.map(({ key, color, label }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 2, backgroundColor: color, borderRadius: 1 }} />
          <Text style={{ fontSize: 12, color: theme.secondaryText }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function TrendLineChart({ data, series, theme }) {
  const VW = 340, VH = 200;
  const CL = 42, CR = 330, CT = 10, CB = 172;
  const cW = CR - CL, cH = CB - CT;
  const n = data.length;
  const xOf = (i) => n < 2 ? CL + cW / 2 : CL + (i * cW) / (n - 1);
  const yOf = (v) => CB - v * cH;
  const ptsStr = (key) => data.map((d, i) => `${xOf(i)},${yOf(d[key])}`).join(' ');
  const fillPts = (key) => {
    const inner = data.map((d, i) => `${xOf(i)},${yOf(d[key])}`).join(' ');
    return `${xOf(0)},${CB} ${inner} ${xOf(n - 1)},${CB}`;
  };
  return (
    <Svg width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`}>
      {[[1, '100%'], [0.5, '50%'], [0, '0%']].map(([v, lbl]) => (
        <React.Fragment key={String(v)}>
          <Line x1={CL} y1={yOf(v)} x2={CR} y2={yOf(v)} stroke={theme.border} strokeWidth="1" />
          <SvgText x={CL - 4} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill={theme.tertiaryText}>{lbl}</SvgText>
        </React.Fragment>
      ))}
      <Polygon points={fillPts(series[0].key)} fill="rgba(45,125,210,0.07)" stroke="none" />
      {series.map(({ key, color }) => (
        <Polyline key={key} points={ptsStr(key)} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      ))}
      {series.map(({ key, color }) =>
        data.map((d, i) => (
          <Circle key={`${key}-${i}`} cx={xOf(i)} cy={yOf(d[key])} r={3} fill={color} />
        ))
      )}
      {data.map((d, i) => (
        <SvgText key={i} x={xOf(i)} y={CB + 16} textAnchor="middle" fontSize="10" fill={theme.tertiaryText}>{d.label}</SvgText>
      ))}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InsightScreen({ navigation }) {
  const { t } = useTranslation();
  const { catName } = useCatName();
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'android' ? 60 + insets.bottom : 88;
  const [diaries, setDiaries] = useState([]);
  const [insightLoaded, setInsightLoaded] = useState(false);
  const [emotionStats, setEmotionStats] = useState({});
  const [activeTab, setActiveTab] = useState('emotion');
  const [langData, setLangData] = useState({
    topWords: [],
    topPhrases: [],
    styleScores: [],
    summary: '',
    noteCount: 0,
  });
  const [structureInfoExpanded, setStructureInfoExpanded] = useState(false);
  const [kpiTooltip, setKpiTooltip] = useState(null); // 'causal' | 'agency' | null
  const kpiSheetAnim = useRef(new Animated.Value(300)).current;
  const kpiSheetOpacity = useRef(new Animated.Value(0)).current;
  const [thinkingTab, setThinkingTab] = useState('today');
  const [thinkingTrendRange, setThinkingTrendRange] = useState('1W');
  const [languageLensTab, setLanguageLensTab] = useState('today');
  const [lensTrendRange, setLensTrendRange] = useState('1W');
  const [tdRange, setTdRange] = useState('1M');
  const [vdRange, setVdRange] = useState('1M');
  const [egRange, setEgRange] = useState('1M');
  const [mtRange, setMtRange] = useState('1M');
  const [naRange, setNaRange] = useState('1M');
  const [globalRange, setGlobalRange] = useState('monthly');

  const applyGlobalRange = (range) => {
    const r = range === 'weekly' ? '1W' : '1M';
    setGlobalRange(range);
    setMtRange(r);
    setTdRange(r);
    setVdRange(r);
    setEgRange(r);
    setNaRange(r);
    setThinkingTrendRange(r);
    setLensTrendRange(r);
  };

  // ── Activity tab state ─────────────────────────────────────────────────────
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [moodCalYear, setMoodCalYear] = useState(today.getFullYear());
  const [moodCalMonth, setMoodCalMonth] = useState(today.getMonth());

  useFocusEffect(
    useCallback(() => {
      loadDiaries();
    }, [])
  );

  const loadDiaries = async () => {
    try {
      const savedDiaries = await AsyncStorage.getItem('diaries');
      if (savedDiaries !== null) {
        const parsedDiaries = JSON.parse(savedDiaries);
        setDiaries(parsedDiaries);
        calculateEmotionStats(parsedDiaries);
        setLangData(analyzeLanguagePatterns(parsedDiaries));
      }
    } catch (error) {
      console.error('Failed to load diaries:', error);
    } finally {
      setInsightLoaded(true);
    }
  };

  const calculateEmotionStats = (diaryList) => {
    const stats = {};
    diaryList.forEach(diary => {
      const emotion = diary.emotion || 'neutral';
      stats[emotion] = (stats[emotion] || 0) + 1;
    });
    setEmotionStats(stats);
  };

  const getTotalDiaries = () => diaries.length;

  const getEmotionPercentage = (emotion) => {
    const total = getTotalDiaries();
    if (total === 0) return 0;
    return ((emotionStats[emotion] || 0) / total * 100).toFixed(1);
  };

  // ── Weekly Comparison ──────────────────────────────────────────────────────
  const getWeeklyComparison = () => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const lastWeekDate = new Date(todayStart.getTime() - 7 * 86400000);
    const lastWeekStart = new Date(lastWeekDate.getFullYear(), lastWeekDate.getMonth(), lastWeekDate.getDate());
    const lastWeekEnd = new Date(lastWeekStart.getTime() + 86400000);

    const getDominant = (entries) => {
      if (!entries.length) return null;
      const counts = {};
      entries.forEach(e => {
        const em = e.emotion || 'neutral';
        counts[em] = (counts[em] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    };

    const todayEntries = diaries.filter(d => {
      const t = new Date(d.timestamp);
      return t >= todayStart && t < todayEnd;
    });
    const lastWeekEntries = diaries.filter(d => {
      const t = new Date(d.timestamp);
      return t >= lastWeekStart && t < lastWeekEnd;
    });

    const todayEmotion = getDominant(todayEntries);
    const lastWeekEmotion = getDominant(lastWeekEntries);

    return {
      today: todayEmotion ? { emotion: todayEmotion, emoji: EMOJI_MAP[todayEmotion] || '😐' } : null,
      lastWeek: lastWeekEmotion ? { emotion: lastWeekEmotion, emoji: EMOJI_MAP[lastWeekEmotion] || '😐' } : null,
      lastWeekDayName: lastWeekDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    };
  };

  // ── Daily Patterns ─────────────────────────────────────────────────────────
  const getDailyPatterns = () => {
    const periods = [
      { label: 'Morning', icon: '🌅', bg: '#FFF8EE', start: 5, end: 12 },
      { label: 'Afternoon', icon: '☀️', bg: '#FFFBF0', start: 12, end: 17 },
      { label: 'Evening', icon: '🏙️', bg: '#EEF0FF', start: 17, end: 21 },
      { label: 'Night', icon: '🌙', bg: '#F0EEFF', start: 21, end: 29 },
    ];
    return periods.map(period => {
      const entries = diaries.filter(d => {
        if (!d.timestamp) return false;
        const h = new Date(d.timestamp).getHours();
        if (period.end <= 24) return h >= period.start && h < period.end;
        return h >= period.start || h < (period.end - 24);
      });
      if (!entries.length) return { ...period, emotion: null, emoji: null };
      const counts = {};
      entries.forEach(e => {
        const em = e.emotion || 'neutral';
        counts[em] = (counts[em] || 0) + 1;
      });
      const emotion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      return { ...period, emotion, emoji: EMOJI_MAP[emotion] || '😐' };
    });
  };

  // ── Emotion KPIs ───────────────────────────────────────────────────────────
  const getEmotionKPIs = () => {
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000);

    const thisWeek = diaries.filter(d => new Date(d.timestamp) >= weekAgo);
    const lastWeek = diaries.filter(d => {
      const t = new Date(d.timestamp);
      return t >= twoWeeksAgo && t < weekAgo;
    });

    const weeklyAvg = thisWeek.length > 0
      ? thisWeek.reduce((s, d) => s + emotionToScore(d.emotion), 0) / thisWeek.length
      : null;
    const lastWeekAvg = lastWeek.length > 0
      ? lastWeek.reduce((s, d) => s + emotionToScore(d.emotion), 0) / lastWeek.length
      : null;

    const mostCommonEmotion = Object.keys(emotionStats).length > 0
      ? Object.entries(emotionStats).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    let vsLastWeek = null;
    if (weeklyAvg !== null && lastWeekAvg !== null) {
      // Normalize -1~1 score to 0~100 wellness scale, then compare percentage points
      const toWellness = (s) => Math.round((s + 1) / 2 * 100);
      const pptDiff = toWellness(weeklyAvg) - toWellness(lastWeekAvg);
      vsLastWeek = {
        improving: pptDiff >= 0,
        pct: Math.abs(pptDiff),
        label: pptDiff > 3 ? 'Improving' : pptDiff < -3 ? 'Declining' : 'Stable',
      };
    }

    return {
      weeklyAvg: weeklyAvg !== null
        ? { emoji: scoreToMoodEmoji(weeklyAvg), label: scoreToMoodLabel(weeklyAvg) }
        : { emoji: '—', label: 'No data' },
      mostCommon: mostCommonEmotion
        ? { emoji: EMOJI_MAP[mostCommonEmotion] ?? '😐', label: mostCommonEmotion.charAt(0).toUpperCase() + mostCommonEmotion.slice(1) }
        : { emoji: '—', label: 'No data' },
      vsLastWeek,
    };
  };

  // ── Weekly Mood Trend (Mon–Sun this week) ──────────────────────────────────
  const getWeeklyMoodTrend = () => {
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let hasAny = false;
    const data = labels.map((label, i) => {
      const dayStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
      const entries = diaries.filter(d => {
        const t = new Date(d.timestamp);
        return t >= dayStart && t < dayEnd;
      });
      if (!entries.length) return { value: 2, label, hideDataPoint: true };
      hasAny = true;
      const avg = entries.reduce((s, d) => s + emotionToDisplayScore(d.emotion), 0) / entries.length;
      return { value: avg, label };
    });
    return hasAny ? data : null;
  };

  const getMoodTrendData = (range = '1M') => {
    const t = new Date();
    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const avgFor = (entries) =>
      entries.reduce((s, d) => s + emotionToDisplayScore(d.emotion), 0) / entries.length;

    if (range === '1W') {
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(t); day.setDate(t.getDate() - (6 - i));
        const dayStr = day.toLocaleDateString('en-US');
        const entries = diaries.filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === dayStr);
        const label = `${day.getMonth()+1}/${day.getDate()}`;
        if (!entries.length) return { value: 2, label, hideDataPoint: true };
        return { value: avgFor(entries), label };
      });
    }

    if (range === '1M') {
      return Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(t); weekEnd.setDate(t.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        const daySet = new Set(Array.from({ length: 7 }, (_, j) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + j);
          return d.toLocaleDateString('en-US');
        }));
        const entries = diaries.filter(d => daySet.has(new Date(d.timestamp).toLocaleDateString('en-US')));
        const label = `${weekStart.getMonth()+1}/${weekStart.getDate()}`;
        if (!entries.length) return { value: 2, label, hideDataPoint: true };
        return { value: avgFor(entries), label };
      });
    }

    if (range === '6M') {
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(t.getFullYear(), t.getMonth() - (5 - i), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const entries = diaries.filter(n => { const ts = new Date(n.timestamp); return ts >= d && ts <= monthEnd; });
        const label = MONTH_ABBR[d.getMonth()];
        if (!entries.length) return { value: 2, label, hideDataPoint: true };
        return { value: avgFor(entries), label };
      });
    }

    // ALL — weekly from first diary
    if (diaries.length === 0) {
      return Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(t); weekEnd.setDate(t.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        return { value: 2, label: `${weekStart.getMonth()+1}/${weekStart.getDate()}`, hideDataPoint: true };
      });
    }
    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const msFromFirst = t - new Date(sorted[0].timestamp);
    const numWeeks = Math.max(1, Math.ceil(msFromFirst / (7 * 24 * 60 * 60 * 1000)) + 1);
    return Array.from({ length: numWeeks }, (_, i) => {
      const weekEnd = new Date(t); weekEnd.setDate(t.getDate() - (numWeeks - 1 - i) * 7);
      const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
      const daySet = new Set(Array.from({ length: 7 }, (_, j) => {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + j);
        return d.toLocaleDateString('en-US');
      }));
      const entries = diaries.filter(d => daySet.has(new Date(d.timestamp).toLocaleDateString('en-US')));
      const label = `${weekStart.getMonth()+1}/${weekStart.getDate()}`;
      if (!entries.length) return { value: 2, label, hideDataPoint: true };
      return { value: avgFor(entries), label };
    });
  };

  const getWeekDateRange = () => {
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)} – ${fmt(sunday)}`;
  };

  const weeklyComparison = getWeeklyComparison();
  const dailyPatterns = getDailyPatterns();
  const emotionKPIs = getEmotionKPIs();
  const weeklyMoodData = getWeeklyMoodTrend();
  const weekDateRange = getWeekDateRange();

  // ── Activity tab helpers ────────────────────────────────────────────────────
  const allUniqueTags = getUniqueTags(diaries);

  const diariesByDate = {};
  diaries.forEach(d => {
    if (!d.timestamp) return;
    const dt = new Date(d.timestamp);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (!diariesByDate[key]) diariesByDate[key] = [];
    diariesByDate[key].push(d);
  });

  const getMoodEmojiForDate = (key) => {
    if (!key) return null;
    const entries = diariesByDate[key] || [];
    if (!entries.length) return null;
    const avg = entries.reduce((s, d) => s + emotionToScore(d.emotion), 0) / entries.length;
    return scoreToMoodEmoji(avg);
  };

  const buildActivityChartData = (range = '1M') => {
    const t = new Date();
    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const toKey = (d) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const countDay = (d) => (diariesByDate[toKey(d)] || []).length;
    const pt = (value, label) => ({ value, label, hideDataPoint: value === 0 });

    if (range === '1W') {
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(t); day.setDate(t.getDate() - (6 - i));
        return pt(countDay(day), `${day.getMonth()+1}/${day.getDate()}`);
      });
    }
    if (range === '1M') {
      return Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(t); weekEnd.setDate(t.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        let count = 0;
        for (let j = 0; j < 7; j++) {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + j);
          count += countDay(d);
        }
        return pt(count, `${weekStart.getMonth()+1}/${weekStart.getDate()}`);
      });
    }
    if (range === '6M') {
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(t.getFullYear(), t.getMonth() - (5 - i), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        let count = 0;
        for (let cur = new Date(d); cur <= monthEnd; cur.setDate(cur.getDate() + 1)) {
          count += countDay(new Date(cur));
        }
        return pt(count, MONTH_ABBR[d.getMonth()]);
      });
    }
    // ALL
    if (diaries.length === 0) {
      return Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(t); weekEnd.setDate(t.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        return pt(0, `${weekStart.getMonth()+1}/${weekStart.getDate()}`);
      });
    }
    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const msFromFirst = t - new Date(sorted[0].timestamp);
    const numWeeks = Math.max(1, Math.ceil(msFromFirst / (7 * 24 * 60 * 60 * 1000)) + 1);
    return Array.from({ length: numWeeks }, (_, i) => {
      const weekEnd = new Date(t); weekEnd.setDate(t.getDate() - (numWeeks - 1 - i) * 7);
      const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
      let count = 0;
      for (let j = 0; j < 7; j++) {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + j);
        count += countDay(d);
      }
      return pt(count, `${weekStart.getMonth()+1}/${weekStart.getDate()}`);
    });
  };

  const buildCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  };

  const isTodayCell = (day) =>
    day !== null &&
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const dateKey = (day) =>
    day
      ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : null;

  const handleDayPress = (day) => {
    if (!day) return;
    const key = dateKey(day);
    setSelectedDate({ day, key, entries: diariesByDate[key] || [] });
    setDayModalVisible(true);
  };

  const goToToday = () => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); };
  const goToPrevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
  };

  const goToMoodPrevMonth = () => {
    if (moodCalMonth === 0) { setMoodCalYear(y => y - 1); setMoodCalMonth(11); }
    else setMoodCalMonth(m => m - 1);
  };
  const goToMoodNextMonth = () => {
    if (moodCalMonth === 11) { setMoodCalYear(y => y + 1); setMoodCalMonth(0); }
    else setMoodCalMonth(m => m + 1);
  };

  const renderCalendarDay = (day, index) => {
    const key = dateKey(day);
    const entries = key ? (diariesByDate[key] || []) : [];
    const todayCell = isTodayCell(day);

    const dayTagSet = new Set(entries.map(e => e.tag || null));
    const dayTags = [...dayTagSet].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    });

    return (
      <TouchableOpacity
        key={index}
        style={[actS.dayCell, { borderBottomColor: theme.border }]}
        onPress={() => handleDayPress(day)}
        activeOpacity={day ? 0.7 : 1}
        disabled={!day}
      >
        {day && (
          <>
            <View style={[actS.dayNumWrap, todayCell && { backgroundColor: theme.accent }]}>
              <Text style={[actS.dayText, { color: theme.primaryText }, todayCell && actS.todayText]}>{day}</Text>
            </View>
            <View style={actS.tagStack}>
              {dayTags.slice(0, 3).map((tag, i) => (
                <View key={i} style={[actS.catTag, { backgroundColor: getTagColor(tag, allUniqueTags) }]}>
                  <Text style={actS.catTagText} numberOfLines={1}>{tag ?? 'no tag'}</Text>
                </View>
              ))}
              {dayTags.length > 3 && <Text style={[actS.moreTag, { color: theme.tertiaryText }]}>+{dayTags.length - 3}</Text>}
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  // ── Activity tab renderer ───────────────────────────────────────────────────
  const renderActivityTab = () => {
    const actChartData = buildActivityChartData(naRange);
    const calDays = buildCalendarDays();
    const actMonthLabel = `${MONTH_FULL[currentMonth]} ${currentYear}`;
    const chartAreaWidth = screenWidth - 64;
    const yAxisW = 30;
    const naN = actChartData.length;
    const lineSpacing = Math.max(8, Math.floor((chartAreaWidth - yAxisW - 16) / Math.max(1, naN - 1)));
    const naHasData = actChartData.some(p => p.value > 0);
    const naSubtitle = naRange === '1W' ? 'Daily notes · last 7 days'
      : naRange === '1M' ? 'Weekly notes · last 5 weeks'
      : naRange === '6M' ? 'Monthly notes · last 6 months'
      : 'Weekly notes · all time';

    return (
      <>
        {/* Note Activity chart */}
        <View style={[actS.chartSection, { backgroundColor: theme.card }]}>
          <Text style={[actS.chartTitle, { color: theme.primaryText }]}>{t('insight.noteActivity')}</Text>
          <Text style={{ fontSize: 12, color: theme.secondaryText, marginBottom: 8 }}>{naSubtitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 14, height: 100, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{
                fontSize: 9, color: theme.secondaryText, fontWeight: '500',
                transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center',
              }}>Notes</Text>
            </View>
            <View style={{ flex: 1, position: 'relative' }}>
            <LineChart
              key={`na-${naRange}`}
              data={actChartData}
              width={chartAreaWidth - yAxisW - 8 - 14}
              height={100}
              spacing={lineSpacing}
              initialSpacing={8}
              endSpacing={8}
              color={naHasData ? theme.accent : theme.border}
              thickness={2}
              dataPointsHeight={6}
              dataPointsWidth={6}
              dataPointsColor={theme.accent}
              showValuesAsDataPointsText
              textShiftY={-10}
              textShiftX={-4}
              textColor={theme.primaryText}
              textFontSize={10}
              noOfSections={3}
              yAxisLabelWidth={yAxisW}
              yAxisTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
              xAxisColor="transparent"
              yAxisColor="transparent"
              rulesColor={theme.border}
              rulesType="solid"
              isAnimated
            />
            {!naHasData && (
              <View style={{
                position: 'absolute', top: 50, left: yAxisW, right: 0,
                alignItems: 'center',
              }}>
                <Text style={{ color: theme.tertiaryText, fontSize: 13, fontWeight: '500', backgroundColor: theme.card, paddingHorizontal: 10 }}>
                  {t('insight.noData')}
                </Text>
              </View>
            )}
            </View>
          </View>
          <View style={[langS.rangeSelector, { borderTopColor: theme.border }]}>
            {['1W', '1M', '6M', 'ALL'].map(r => (
              <TouchableOpacity
                key={r}
                style={[langS.rangeBtn, naRange === r && { backgroundColor: theme.primaryText, borderRadius: 8, marginHorizontal: 2, marginTop: 6, marginBottom: 2 }]}
                onPress={() => setNaRange(r)}
              >
                <Text style={[langS.rangeBtnText, { color: theme.secondaryText }, naRange === r && langS.rangeBtnTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Daily Activity calendar */}
        <View style={[actS.calendarCard, { backgroundColor: theme.card }]}>
          <View style={actS.calNavRow}>
            <TouchableOpacity onPress={goToPrevMonth} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={theme.accent} />
            </TouchableOpacity>
            <Text style={[actS.calNavTitle, { color: theme.primaryText }]}>{actMonthLabel}</Text>
            <TouchableOpacity onPress={goToNextMonth} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={theme.accent} />
            </TouchableOpacity>
          </View>
          <View style={[actS.weekHeader, { borderBottomColor: theme.border }]}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={[actS.weekCell, { width: DAY_WIDTH }]}>
                <Text style={[actS.weekText, { color: theme.tertiaryText }, i === 0 && actS.sunColor, i === 6 && { color: theme.accent }]}>{w}</Text>
              </View>
            ))}
          </View>
          <View style={actS.calGrid}>
            {calDays.map((day, i) => renderCalendarDay(day, i))}
          </View>
        </View>

        {/* Tag legend */}
        {allUniqueTags.length > 0 && (
          <View style={[actS.calLegend, { backgroundColor: theme.card }]}>
            {allUniqueTags.map((tag, i) => (
              <View key={i} style={actS.calLegendItem}>
                <View style={[actS.calLegendDot, { backgroundColor: getTagColor(tag, allUniqueTags) }]} />
                <Text style={[actS.calLegendText, { color: theme.secondaryText }]}>{tag ?? 'no tag'}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </>
    );
  };

  // ======= MOOD CALENDAR =======
  const renderMoodCalendar = () => {
    const firstDay = new Date(moodCalYear, moodCalMonth, 1).getDay();
    const daysInMonth = new Date(moodCalYear, moodCalMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    return (
      <View style={moodCalS.container}>
        <View style={moodCalS.navRow}>
          <TouchableOpacity onPress={goToMoodPrevMonth} hitSlop={8} style={moodCalS.navBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.accent} />
          </TouchableOpacity>
          <Text style={[moodCalS.monthText, { color: theme.primaryText }]}>{MONTH_FULL[moodCalMonth]} {moodCalYear}</Text>
          <TouchableOpacity onPress={goToMoodNextMonth} hitSlop={8} style={moodCalS.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        <View style={moodCalS.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <View key={i} style={[moodCalS.weekCell, { width: MOOD_CELL_SIZE }]}>
              <Text style={[moodCalS.weekText, i === 0 && { color: '#ef4444' }]}>{w}</Text>
            </View>
          ))}
        </View>

        <View style={moodCalS.grid}>
          {days.map((day, i) => {
            const key = day
              ? `${moodCalYear}-${String(moodCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              : null;
            const emoji = getMoodEmojiForDate(key);
            const isToday =
              day !== null &&
              day === today.getDate() &&
              moodCalMonth === today.getMonth() &&
              moodCalYear === today.getFullYear();

            return (
              <TouchableOpacity
                key={i}
                style={[moodCalS.cell, { width: MOOD_CELL_SIZE }, isToday && moodCalS.todayCell]}
                onPress={() => {
                  if (!day) return;
                  setSelectedDate({ day, key, entries: diariesByDate[key] || [] });
                  setDayModalVisible(true);
                }}
                disabled={!day}
                activeOpacity={day ? 0.7 : 1}
              >
                {day && (
                  <>
                    <Text style={[moodCalS.dayNum, isToday && moodCalS.todayNum]}>{day}</Text>
                    {emoji
                      ? <Text style={moodCalS.emojiText}>{emoji}</Text>
                      : <View style={{ height: 20 }} />
                    }
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ======= EMOTION TAB =======
  const renderEmotionTab = () => {
    const moodChartWidth = screenWidth - 40 - 32 - 35 - 8;
    const moodInitialSpacing = 20;
    const moodEndSpacing = 20;
    const moodTrendData = getAllDailyMoodData();
    const mtHasData = moodTrendData.some(p => !p.hideDataPoint);
    const moodSpacing = 16;

    // ── 새 KPI 계산 ──────────────────────────────────────────────────────────
    // 1. 지배 감정 (전체 기간 중 가장 많이 기록)
    const emotionCounts = {};
    diaries.forEach(d => {
      const e = d.emotion || 'neutral';
      emotionCounts[e] = (emotionCounts[e] || 0) + 1;
    });
    const dominantEmotion = diaries.length > 0
      ? Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    const dominantEmoji = dominantEmotion ? (EMOJI_MAP[dominantEmotion] ?? '😐') : '—';
    const dominantLabel = dominantEmotion
      ? dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)
      : 'No data';

    // 2. 긍정 비율 (joy + surprise / 전체)
    const positiveCount = diaries.filter(d => d.emotion === 'joy' || d.emotion === 'surprise').length;
    const positivityRatio = diaries.length > 0
      ? Math.round(positiveCount / diaries.length * 100)
      : null;

    // 3. 감정 다양성 (기록된 고유 감정 종류 수)
    const uniqueEmotionCount = new Set(diaries.map(d => d.emotion || 'neutral')).size;
    const diversityLabel = uniqueEmotionCount === 0 ? '—'
      : uniqueEmotionCount <= 2 ? '좁음'
      : uniqueEmotionCount <= 4 ? '보통'
      : uniqueEmotionCount <= 6 ? '다양성'
      : '매우 다양';

    return (
      <>
        {/* KPI Cards */}
        <View style={kpiS.row}>
          {/* 지배 감정 */}
          <View style={[kpiS.card, { backgroundColor: theme.card }]}>
            <View style={kpiS.cardTop}>
              <Text style={kpiS.cardEmoji}>{dominantEmoji}</Text>
            </View>
            <Text style={[kpiS.cardValue, { color: theme.primaryText }]}>{dominantLabel}</Text>
            <Text style={[kpiS.cardLabel, { color: theme.secondaryText }]}>지배 감정</Text>
          </View>

          {/* 긍정 비율 */}
          <View style={[kpiS.card, { backgroundColor: theme.card }]}>
            <View style={kpiS.cardTop}>
              <Text style={kpiS.cardEmoji}>
                {positivityRatio === null ? '—' : positivityRatio >= 60 ? '☀️' : positivityRatio >= 40 ? '🌤' : '🌧'}
              </Text>
            </View>
            <Text style={[kpiS.cardValue, { color: theme.primaryText }]}>
              {positivityRatio !== null ? `${positivityRatio}%` : '—'}
            </Text>
            <Text style={[kpiS.cardLabel, { color: theme.secondaryText }]}>긍정 비율</Text>
          </View>

          {/* 감정 다양성 */}
          <View style={[kpiS.card, { backgroundColor: theme.card }]}>
            <View style={kpiS.cardTop}>
              <Text style={[kpiS.cardEmoji, { fontSize: uniqueEmotionCount > 0 ? 20 : 34 }]}>
                {uniqueEmotionCount === 0 ? '—' : `${uniqueEmotionCount}/8`}
              </Text>
            </View>
            <Text style={[kpiS.cardValue, { color: theme.primaryText }]}>{diversityLabel}</Text>
            <Text style={[kpiS.cardLabel, { color: theme.secondaryText }]}>감정 다양성</Text>
          </View>
        </View>

        {/* Day-of-week pattern — replaces Mood Trend + Weekly Comparison */}
        {(() => {
          const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const sums = new Array(7).fill(0);
          const counts = new Array(7).fill(0);
          const emotionBuckets = Array.from({ length: 7 }, () => ({}));
          diaries.forEach(d => {
            const dow = (new Date(d.timestamp).getDay() + 6) % 7; // Mon=0
            sums[dow] += emotionToDisplayScore(d.emotion);
            counts[dow]++;
            const e = d.emotion || 'neutral';
            emotionBuckets[dow][e] = (emotionBuckets[dow][e] || 0) + 1;
          });
          const dowData = DAYS.map((label, i) => {
            const count = counts[i];
            const avg = count > 0 ? sums[i] / count : 0;
            const topEmotion = count > 0
              ? Object.entries(emotionBuckets[i]).sort((a, b) => b[1] - a[1])[0][0]
              : null;
            return { label, avg, count, emoji: topEmotion ? (EMOJI_MAP[topEmotion] ?? '😐') : null };
          });
          const hasAny = dowData.some(d => d.count > 0);
          const maxBar = 110;
          return (
            <View style={styles.section}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color={theme.accent} />
                <Text style={styles.sectionTitle}>요일 패턴</Text>
              </View>
              <Text style={styles.sectionSubtitle}>요일별 평균 감정 · 전체 기록 기준</Text>
              <View style={styles.card}>
                {hasAny ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 168, paddingBottom: 2 }}>
                    {dowData.map((d, i) => {
                      const barH = d.count > 0 ? Math.max(10, (d.avg / 4) * maxBar) : 6;
                      const barColor = d.avg >= 3.2 ? '#f97316'
                        : d.avg >= 2.5 ? '#a3d0c0'
                        : d.avg >= 1.5 ? '#7EB3FF'
                        : '#C7C7CC';
                      return (
                        <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                          {d.emoji
                            ? <Text style={{ fontSize: 14 }}>{d.emoji}</Text>
                            : <Text style={{ fontSize: 14, color: 'transparent' }}>·</Text>
                          }
                          <View style={{
                            width: 26, height: barH,
                            backgroundColor: d.count > 0 ? barColor : theme.border,
                            borderRadius: 6,
                          }} />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.secondaryText }}>{d.label}</Text>
                          <Text style={{ fontSize: 9, color: theme.tertiaryText }}>
                            {d.count > 0 ? `${d.count}회` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyChart}>
                    <Text style={styles.emptyChartText}>{t('insight.noData')}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* Emotion Bubble Chart */}
        {Object.keys(emotionStats).length > 0 && (() => {
          const BUBBLE_COLORS = {
            joy:      { fill: 'rgba(255,216,190,0.78)', text: '#755844' },
            sadness:  { fill: 'rgba(188,233,217,0.78)', text: '#3d665a' },
            neutral:  { fill: 'rgba(226,223,217,0.72)', text: '#4f453e' },
            anger:    { fill: 'rgba(254,202,202,0.72)', text: '#991b1b' },
            fear:     { fill: 'rgba(233,213,255,0.72)', text: '#6b21a8' },
            surprise: { fill: 'rgba(254,215,170,0.72)', text: '#c2410c' },
            disgust:  { fill: 'rgba(187,247,208,0.72)', text: '#166534' },
            uncertain:{ fill: 'rgba(221,214,254,0.72)', text: '#5b21b6' },
          };
          // Positions for up to 5 bubbles (cx, cy) in a 360x270 canvas
          const POSITIONS = [
            { cx: 182, cy: 140 },  // 1st — center
            { cx: 268, cy: 95  },  // 2nd — upper right
            { cx: 102, cy: 178 },  // 3rd — lower left
            { cx:  98, cy:  88 },  // 4th — upper left
            { cx: 272, cy: 188 },  // 5th — lower right
          ];
          const total = Object.values(emotionStats).reduce((s, v) => s + v, 0);
          const sorted = Object.entries(emotionStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          const VW = 360, VH = 270;

          return (
            <View style={styles.section}>
              <View style={styles.cardHeader}>
                <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={theme.accent} />
                <Text style={styles.sectionTitle}>감정 분포</Text>
              </View>
              <View style={[styles.card, { padding: 4 }]}>
                <Svg width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`}>
                  {sorted.map(([emotion, count], i) => {
                    const pct = Math.round((count / total) * 100);
                    const r = Math.max(38, Math.sqrt(pct / 100) * 118);
                    const { cx, cy } = POSITIONS[i] || { cx: 180, cy: 135 };
                    const { fill, text } = BUBBLE_COLORS[emotion] || { fill: 'rgba(211,196,187,0.65)', text: '#4f453e' };
                    const label = emotion.charAt(0).toUpperCase() + emotion.slice(1);
                    return (
                      <G key={emotion}>
                        <Circle cx={cx} cy={cy} r={r} fill={fill} />
                        <SvgText
                          x={cx} y={cy - 2}
                          textAnchor="middle"
                          fontSize={r > 55 ? '14' : '11'}
                          fontWeight="600"
                          fill={text}
                        >
                          {label}
                        </SvgText>
                        <SvgText
                          x={cx} y={cy + (r > 55 ? 22 : 18)}
                          textAnchor="middle"
                          fontSize={r > 55 ? '13' : '11'}
                          fill={text}
                        >
                          {pct}%
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>
            </View>
          );
        })()}

        {/* Daily Patterns */}
        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <Ionicons name="sunny-outline" size={20} color={theme.accent} />
            <Text style={styles.sectionTitle}>{t('insight.dailyPatterns')}</Text>
          </View>
          <View style={emotionS.patternsRow}>
            {dailyPatterns.map((p, i) => (
              <View key={i} style={[emotionS.patternCard, { backgroundColor: p.bg }]}>
                <Text style={emotionS.patternPeriodIcon}>{p.icon}</Text>
                <Text style={emotionS.patternLabel}>{p.label}</Text>
                <Text style={emotionS.patternEmoji}>{p.emoji ?? '·'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Mood Calendar */}
        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={20} color={theme.accent} />
            <Text style={styles.sectionTitle}>{t('insight.moodCalendar')}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>{t('insight.dailyMoodSubtitle')}</Text>
          {renderMoodCalendar()}
        </View>

        <View style={{ height: 40 }} />
      </>
    );
  };

  // ======= LANGUAGE TAB =======
  const getTotalWords = () =>
    diaries.reduce((sum, d) => sum + (d.content || '').split(/\s+/).filter(Boolean).length, 0);

  const getAvgWordCount = () => {
    if (diaries.length === 0) return 0;
    const total = diaries.reduce((sum, d) => sum + (d.content || '').split(/\s+/).filter(Boolean).length, 0);
    return Math.round(total / diaries.length);
  };

  const getUniqueVocabCount = () => {
    const allWords = new Set();
    diaries.forEach(d => {
      (d.content || '').split(/\s+/).filter(Boolean).forEach(w => allWords.add(w.toLowerCase()));
    });
    return allWords.size;
  };

  // Layer Reach — days with T or I reached / total diary days (all entries)
  const getLayerReach = () => {
    if (diaries.length === 0) return null;
    const allDays = new Set(
      diaries.map(d => new Date(d.timestamp).toLocaleDateString('en-US'))
    );
    const reachedDays = new Set(
      diaries
        .filter(d => d.structure?.thought || d.structure?.insight)
        .map(d => new Date(d.timestamp).toLocaleDateString('en-US'))
    );
    return Math.round((reachedDays.size / allDays.size) * 100);
  };

  // Thinking type distribution — averaged over the selected time window
  const getThinkingTypeData = (mode) => {
    const today = new Date();
    let filtered;
    if (mode === 'today') {
      const todayStr = today.toLocaleDateString('en-US');
      filtered = diaries.filter(d =>
        new Date(d.timestamp).toLocaleDateString('en-US') === todayStr && d.thinking_type
      );
    } else if (mode === '7day') {
      const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
      filtered = diaries.filter(d => new Date(d.timestamp) >= weekAgo && d.thinking_type);
    } else {
      filtered = diaries.filter(d => d.thinking_type);
    }
    if (filtered.length === 0) return null;
    const avg = (key) =>
      filtered.reduce((s, d) => s + (d.thinking_type[key] || 0), 0) / filtered.length;
    return {
      causal_reasoning: avg('causal_reasoning'),
      interpretation:   avg('interpretation'),
      event_listing:    avg('event_listing'),
    };
  };

  // Language lens — averaged over selected time window
  const getLanguageLensData = (mode) => {
    const today = new Date();
    let filtered;
    if (mode === 'today') {
      const todayStr = today.toLocaleDateString('en-US');
      filtered = diaries.filter(d =>
        new Date(d.timestamp).toLocaleDateString('en-US') === todayStr && d.language_lens
      );
    } else if (mode === '7day') {
      const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
      filtered = diaries.filter(d => new Date(d.timestamp) >= weekAgo && d.language_lens);
    } else {
      filtered = diaries.filter(d => d.language_lens);
    }
    if (filtered.length === 0) return null;
    const avg = (key) =>
      filtered.reduce((s, d) => s + (d.language_lens[key] || 0), 0) / filtered.length;
    return {
      closed:  avg('closed'),
      rigid:   avg('rigid'),
      passive: avg('passive'),
      open:    avg('open'),
    };
  };

  const buildTrendBuckets = (range, hasProp) => {
    const now = new Date(); now.setHours(23, 59, 59, 999);
    let totalDays, bucketDays;
    if (range === '1W')      { totalDays = 7;   bucketDays = 1; }
    else if (range === '1M') { totalDays = 28;  bucketDays = 4; }
    else if (range === '6M') { totalDays = 168; bucketDays = 28; }
    else {
      const relevant = diaries.filter(hasProp);
      if (relevant.length === 0) return [];
      const earliest = new Date(Math.min(...relevant.map(d => new Date(d.timestamp))));
      const diffDays = Math.ceil((now - earliest) / 86400000) + 1;
      bucketDays = Math.max(1, Math.ceil(diffDays / 7));
      totalDays = bucketDays * 7;
    }
    const n = Math.floor(totalDays / bucketDays);
    return Array.from({ length: n }, (_, i) => {
      const end = new Date(now); end.setDate(now.getDate() - (n - 1 - i) * bucketDays);
      const start = new Date(end); start.setDate(end.getDate() - bucketDays + 1); start.setHours(0, 0, 0, 0);
      return { start, end, label: `${start.getMonth() + 1}/${start.getDate()}` };
    });
  };

  const getThinkingTrendData = (range) => {
    const buckets = buildTrendBuckets(range, d => d.thinking_type);
    const result = buckets.flatMap(({ start, end, label }) => {
      const entries = diaries.filter(d => d.thinking_type && new Date(d.timestamp) >= start && new Date(d.timestamp) <= end);
      if (entries.length === 0) return [];
      const avg = (key) => entries.reduce((s, d) => s + (d.thinking_type[key] || 0), 0) / entries.length;
      return [{ label, causal_reasoning: avg('causal_reasoning'), interpretation: avg('interpretation'), event_listing: avg('event_listing') }];
    });
    return result.length >= 2 ? result : null;
  };

  const getLensTrendData = (range) => {
    const buckets = buildTrendBuckets(range, d => d.language_lens);
    const result = buckets.flatMap(({ start, end, label }) => {
      const entries = diaries.filter(d => d.language_lens && new Date(d.timestamp) >= start && new Date(d.timestamp) <= end);
      if (entries.length === 0) return [];
      const avg = (key) => entries.reduce((s, d) => s + (d.language_lens[key] || 0), 0) / entries.length;
      return [{ label, closed: avg('closed'), open: avg('open'), rigid: avg('rigid'), passive: avg('passive') }];
    });
    return result.length >= 2 ? result : null;
  };

  // 인과문 비율 — sentences containing causal connectors / total sentences
  const getCausalRatio = () => {
    const entries = diaries.filter(d => d.content);
    if (entries.length === 0) return null;
    const markers = ['때문에', '해서', '어서', '아서', '니까', '으니까', '이라서', '이므로', '므로', '탓에', '덕분에', '그래서', '따라서', '그러므로', '그러니까', 'because', 'so ', 'therefore', 'since ', 'thus'];
    let total = 0, causal = 0;
    entries.forEach(d => {
      const sentences = d.content.split(/[.!?\n]+/).filter(s => s.trim().length > 3);
      total += sentences.length;
      sentences.forEach(s => { if (markers.some(m => s.includes(m))) causal++; });
    });
    return total === 0 ? null : Math.round((causal / total) * 100);
  };

  // 주체문 비율 — "내가/나는…" sentences vs passive "~됐다/~된 것 같다" sentences
  const getSubjectRatio = () => {
    const entries = diaries.filter(d => d.content);
    if (entries.length === 0) return null;
    const subjectMarkers = ['내가', '나는', '나도', '나만', '나를', '제가', '저는', '저도', '난 ', '난\n', 'I ', "I'"];
    const passiveMarkers = ['됐다', '됩니다', '되었다', '된 것', '되는 것', '인 것 같', '는 것 같', '을 것 같', '인 듯', '는 듯'];
    let subject = 0, passive = 0;
    entries.forEach(d => {
      const sentences = d.content.split(/[.!?\n]+/).filter(s => s.trim().length > 3);
      sentences.forEach(s => {
        const hasSub = subjectMarkers.some(m => s.includes(m));
        const hasPas = passiveMarkers.some(m => s.includes(m));
        if (hasSub) subject++;
        else if (hasPas) passive++;
      });
    });
    const total = subject + passive;
    return total === 0 ? null : Math.round((subject / total) * 100);
  };

  // 총 사유량 subtitle — compare recent avg words/note vs all-time avg
  const getThoughtVolumeSubtitle = () => {
    if (diaries.length === 0) return 'Start writing to see insights';
    const allAvg = diaries.reduce((s, d) => s + (d.content || '').split(/\s+/).filter(Boolean).length, 0) / diaries.length;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = diaries.filter(d => new Date(d.timestamp) >= weekAgo);
    if (recent.length === 0) return 'Steady as ever';
    const recentAvg = recent.reduce((s, d) => s + (d.content || '').split(/\s+/).filter(Boolean).length, 0) / recent.length;
    if (recentAvg > allAvg * 1.2) return 'More focused than usual';
    if (recentAvg < allAvg * 0.8) return 'Shorter than usual';
    return 'Steady as ever';
  };

  const getStructureData = () => {
    if (diaries.length === 0) return { score: 0, obs: 0, feel: 0, ins: 0 };
    let totalObs = 0, totalFeel = 0, totalIns = 0;
    diaries.forEach(d => {
      if (d.structure) {
        if (d.structure.observation) totalObs++;
        if (d.structure.thought) totalFeel++;
        if (d.structure.insight) totalIns++;
      }
    });
    const n = diaries.length;
    return {
      score: Math.round((totalObs + totalFeel + totalIns) / (n * 3) * 100),
      obs: Math.round(totalObs / n * 100),
      feel: Math.round(totalFeel / n * 100),
      ins: Math.round(totalIns / n * 100),
    };
  };

  const getThoughtDepthData = (range = '1M') => {
    const today = new Date();

    const makeDayBar = (day, showLabel = true) => {
      const dayStr = day.toLocaleDateString('en-US');
      const dayNotes = diaries.filter(d =>
        new Date(d.timestamp).toLocaleDateString('en-US') === dayStr
      );
      const obs = dayNotes.some(d => d.structure?.observation) ? 1 : 0;
      const feel = dayNotes.some(d => d.structure?.thought) ? 1 : 0;
      const ins = dayNotes.some(d => d.structure?.insight) ? 1 : 0;
      return {
        label: showLabel ? `${day.getMonth() + 1}/${day.getDate()}` : '',
        stacks: [
          { value: Math.max(obs, 0.01), color: obs ? '#007AFF' : theme.background, marginBottom: 2 },
          { value: Math.max(feel, 0.01), color: feel ? '#AF52DE' : theme.background, marginBottom: 2 },
          { value: Math.max(ins, 0.01), color: ins ? '#FF9F0A' : theme.background },
        ],
      };
    };

    const makeWeekBar = (weekStart) => {
      // Build a set of 7 day-strings (local time) — avoids UTC/local mismatch
      const weekDaySet = new Set(
        Array.from({ length: 7 }, (_, j) => {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + j);
          return d.toLocaleDateString('en-US');
        })
      );
      const notes = diaries.filter(d =>
        weekDaySet.has(new Date(d.timestamp).toLocaleDateString('en-US'))
      );
      const obs = notes.some(d => d.structure?.observation) ? 1 : 0;
      const feel = notes.some(d => d.structure?.thought) ? 1 : 0;
      const ins = notes.some(d => d.structure?.insight) ? 1 : 0;
      return {
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        stacks: [
          { value: Math.max(obs, 0.01), color: obs ? '#007AFF' : theme.background, marginBottom: 2 },
          { value: Math.max(feel, 0.01), color: feel ? '#AF52DE' : theme.background, marginBottom: 2 },
          { value: Math.max(ins, 0.01), color: ins ? '#FF9F0A' : theme.background },
        ],
      };
    };

    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const makeMonthBar = (year, month) => {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      const notes = diaries.filter(d => {
        const t = new Date(d.timestamp);
        return t >= monthStart && t <= monthEnd;
      });
      const obs = notes.some(d => d.structure?.observation) ? 1 : 0;
      const feel = notes.some(d => d.structure?.thought) ? 1 : 0;
      const ins = notes.some(d => d.structure?.insight) ? 1 : 0;
      return {
        label: MONTH_ABBR[month],
        stacks: [
          { value: Math.max(obs, 0.01), color: obs ? '#007AFF' : theme.background, marginBottom: 2 },
          { value: Math.max(feel, 0.01), color: feel ? '#AF52DE' : theme.background, marginBottom: 2 },
          { value: Math.max(ins, 0.01), color: ins ? '#FF9F0A' : theme.background },
        ],
      };
    };

    if (range === '1W') {
      // daily, last 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return makeDayBar(day);
      });
    }

    if (range === '1M') {
      // weekly, last 5 weeks
      return Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        return makeWeekBar(weekStart);
      });
    }

    if (range === '6M') {
      // monthly, last 6 months
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
        return makeMonthBar(d.getFullYear(), d.getMonth());
      });
    }

    // ALL — same pattern as 1M but going back to the first diary
    if (diaries.length === 0) return [];
    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const firstDate = new Date(sorted[0].timestamp);
    const msFromFirst = today - firstDate;
    const numWeeks = Math.max(1, Math.ceil(msFromFirst / (7 * 24 * 60 * 60 * 1000)) + 1);

    return Array.from({ length: numWeeks }, (_, i) => {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (numWeeks - 1 - i) * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      return makeWeekBar(weekStart);
    });
  };

  const getVocabDensityData = (range = '1M') => {
    const today = new Date();
    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const makeBar = (words, label) => {
      const unique = new Set(words.map(w => w.toLowerCase())).size;
      const repeated = Math.max(0, words.length - unique);
      return {
        label,
        stacks: [
          { value: Math.max(unique, 0.01), color: unique > 0 ? '#007AFF' : theme.background, marginBottom: 1 },
          { value: Math.max(repeated, 0.01), color: repeated > 0 ? '#FF9F0A' : theme.background },
        ],
      };
    };

    const wordsForDayStr = (dayStr) =>
      diaries
        .filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === dayStr)
        .flatMap(d => (d.content || '').split(/\s+/).filter(Boolean));

    const wordsForWeek = (weekStart) => {
      const daySet = new Set(Array.from({ length: 7 }, (_, j) => {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + j);
        return d.toLocaleDateString('en-US');
      }));
      return diaries
        .filter(d => daySet.has(new Date(d.timestamp).toLocaleDateString('en-US')))
        .flatMap(d => (d.content || '').split(/\s+/).filter(Boolean));
    };

    if (range === '1W') {
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today); day.setDate(today.getDate() - (6 - i));
        return makeBar(wordsForDayStr(day.toLocaleDateString('en-US')), `${day.getMonth()+1}/${day.getDate()}`);
      });
    }
    if (range === '1M') {
      return Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        return makeBar(wordsForWeek(weekStart), `${weekStart.getMonth()+1}/${weekStart.getDate()}`);
      });
    }
    if (range === '6M') {
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
        const notes = diaries.filter(n => {
          const dt = new Date(n.timestamp);
          return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
        });
        return makeBar(notes.flatMap(n => (n.content || '').split(/\s+/).filter(Boolean)), MONTH_ABBR[d.getMonth()]);
      });
    }
    // ALL
    if (diaries.length === 0) {
      return Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        return makeBar([], `${weekStart.getMonth()+1}/${weekStart.getDate()}`);
      });
    }
    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const msFromFirst = today - new Date(sorted[0].timestamp);
    const numWeeks = Math.max(1, Math.ceil(msFromFirst / (7 * 24 * 60 * 60 * 1000)) + 1);
    return Array.from({ length: numWeeks }, (_, i) => {
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - (numWeeks - 1 - i) * 7);
      const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
      return makeBar(wordsForWeek(weekStart), `${weekStart.getMonth()+1}/${weekStart.getDate()}`);
    });
  };

  const getMonthlyNewWordsData = (range = '1W') => {
    const today = new Date();
    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const extractWords = (diaryList) =>
      diaryList.flatMap(d =>
        (d.content || '').split(/\s+/).filter(Boolean)
          .map(w => w.toLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
          .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      );

    if (range === '1W') {
      const cutoff = new Date(today); cutoff.setDate(today.getDate() - 7);
      const seenWords = new Set(extractWords(diaries.filter(d => new Date(d.timestamp) < cutoff)));
      let latestWords = [];
      const barData = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today); day.setDate(today.getDate() - (6 - i));
        const dayStr = day.toLocaleDateString('en-US');
        const dayWords = extractWords(diaries.filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === dayStr));
        const newWords = [...new Set(dayWords.filter(w => !seenWords.has(w)))];
        newWords.forEach(w => seenWords.add(w));
        if (i === 6) latestWords = newWords.slice(0, 15);
        return { value: newWords.length, label: `${day.getMonth()+1}/${day.getDate()}`, frontColor: '#34C759' };
      });
      return { barData, latestWords };
    }

    if (range === '1M') {
      const cutoff = new Date(today); cutoff.setDate(today.getDate() - 5 * 7);
      const seenWords = new Set(extractWords(diaries.filter(d => new Date(d.timestamp) < cutoff)));
      let latestWords = [];
      const barData = Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        const daySet = new Set(Array.from({ length: 7 }, (_, j) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + j);
          return d.toLocaleDateString('en-US');
        }));
        const weekWords = extractWords(diaries.filter(d => daySet.has(new Date(d.timestamp).toLocaleDateString('en-US'))));
        const newWords = [...new Set(weekWords.filter(w => !seenWords.has(w)))];
        newWords.forEach(w => seenWords.add(w));
        if (i === 4) latestWords = newWords.slice(0, 15);
        return { value: newWords.length, label: `${weekStart.getMonth()+1}/${weekStart.getDate()}`, frontColor: '#34C759' };
      });
      return { barData, latestWords };
    }

    if (range === '6M') {
      const cutoff = new Date(today.getFullYear(), today.getMonth() - 6, 1);
      const seenWords = new Set(extractWords(diaries.filter(d => new Date(d.timestamp) < cutoff)));
      let latestWords = [];
      const barData = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const monthWords = extractWords(diaries.filter(n => { const t = new Date(n.timestamp); return t >= d && t <= monthEnd; }));
        const newWords = [...new Set(monthWords.filter(w => !seenWords.has(w)))];
        newWords.forEach(w => seenWords.add(w));
        if (i === 5) latestWords = newWords.slice(0, 15);
        return { value: newWords.length, label: MONTH_ABBR[d.getMonth()], frontColor: '#34C759' };
      });
      return { barData, latestWords };
    }

    // ALL — weekly from first diary
    if (diaries.length === 0) {
      const barData = Array.from({ length: 5 }, (_, i) => {
        const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - (4 - i) * 7);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
        return { value: 0, label: `${weekStart.getMonth()+1}/${weekStart.getDate()}`, frontColor: '#34C759' };
      });
      return { barData, latestWords: [] };
    }
    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const msFromFirst = today - new Date(sorted[0].timestamp);
    const numWeeks = Math.max(1, Math.ceil(msFromFirst / (7 * 24 * 60 * 60 * 1000)) + 1);
    const allCutoff = new Date(today); allCutoff.setDate(today.getDate() - numWeeks * 7);
    const seenWords = new Set(extractWords(diaries.filter(d => new Date(d.timestamp) < allCutoff)));
    let latestWords = [];
    const barData = Array.from({ length: numWeeks }, (_, i) => {
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate() - (numWeeks - 1 - i) * 7);
      const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6);
      const daySet = new Set(Array.from({ length: 7 }, (_, j) => {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + j);
        return d.toLocaleDateString('en-US');
      }));
      const weekWords = extractWords(diaries.filter(d => daySet.has(new Date(d.timestamp).toLocaleDateString('en-US'))));
      const newWords = [...new Set(weekWords.filter(w => !seenWords.has(w)))];
      newWords.forEach(w => seenWords.add(w));
      if (i === numWeeks - 1) latestWords = newWords.slice(0, 15);
      return { value: newWords.length, label: `${weekStart.getMonth()+1}/${weekStart.getDate()}`, frontColor: '#34C759' };
    });
    return { barData, latestWords };
  };

  const getWordFrequency = (topN = 15) => {
    const freq = {};
    diaries.forEach(d => {
      (d.content || '').split(/\s+/).filter(Boolean).forEach(w => {
        const clean = w.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
        if (clean.length > 2 && !STOP_WORDS.has(clean)) {
          freq[clean] = (freq[clean] || 0) + 1;
        }
      });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word, count]) => ({ word, count }));
  };

  const getEmotionWordMap = () => {
    const groups = {};
    diaries.forEach(d => {
      const em = d.emotion || 'neutral';
      if (!groups[em]) groups[em] = {};
      (d.content || '').split(/\s+/).filter(Boolean).forEach(w => {
        const clean = w.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
        if (clean.length > 2 && !STOP_WORDS.has(clean)) {
          groups[em][clean] = (groups[em][clean] || 0) + 1;
        }
      });
    });
    return Object.entries(groups).map(([emotion, wordFreq]) => {
      const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
      return { emotion, emoji: EMOJI_MAP[emotion] || '😐', words: topWords };
    }).filter(g => g.words.length > 0);
  };

  // ── 전체 일별 데이터 (범위 선택 없이 전체 히스토리를 day 단위로) ──────────────

  const getAllDailyDates = () => {
    if (!diaries.length) return [];
    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const first = new Date(sorted[0].timestamp); first.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const dates = [];
    for (let d = new Date(first); d <= today; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
    return dates;
  };

  const dayLabel = (d) => d.getDate() === 1 ? `${d.getMonth() + 1}/1` : '';

  const getAllDailyMoodData = () =>
    getAllDailyDates().map(day => {
      const dayStr = day.toLocaleDateString('en-US');
      const entries = diaries.filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === dayStr);
      if (!entries.length) return { value: 2, label: dayLabel(day), hideDataPoint: true };
      const avg = entries.reduce((s, d) => s + emotionToDisplayScore(d.emotion), 0) / entries.length;
      return { value: avg, label: dayLabel(day) };
    });

  const getAllDailyThoughtDepthData = () =>
    getAllDailyDates().map(day => {
      const dayStr = day.toLocaleDateString('en-US');
      const notes = diaries.filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === dayStr);
      const obs  = notes.some(d => d.structure?.observation) ? 1 : 0;
      const feel = notes.some(d => d.structure?.thought) ? 1 : 0;
      const ins  = notes.some(d => d.structure?.insight) ? 1 : 0;
      return {
        label: dayLabel(day),
        stacks: [
          { value: Math.max(obs,  0.01), color: obs  ? '#007AFF' : theme.background, marginBottom: 2 },
          { value: Math.max(feel, 0.01), color: feel ? '#AF52DE' : theme.background, marginBottom: 2 },
          { value: Math.max(ins,  0.01), color: ins  ? '#FF9F0A' : theme.background },
        ],
      };
    });

  const getAllDailyVocabData = () =>
    getAllDailyDates().map(day => {
      const dayStr = day.toLocaleDateString('en-US');
      const words = diaries
        .filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === dayStr)
        .flatMap(d => (d.content || '').split(/\s+/).filter(Boolean));
      const unique   = new Set(words.map(w => w.toLowerCase())).size;
      const repeated = Math.max(0, words.length - unique);
      return {
        label: dayLabel(day),
        stacks: [
          { value: Math.max(unique,   0.01), color: unique   > 0 ? '#007AFF' : theme.background, marginBottom: 1 },
          { value: Math.max(repeated, 0.01), color: repeated > 0 ? '#FF9F0A' : theme.background },
        ],
      };
    });

  const getAllDailyNewWordsData = () => {
    const dates = getAllDailyDates();
    const extractW = (list) =>
      list.flatMap(d =>
        (d.content || '').split(/\s+/).filter(Boolean)
          .map(w => w.toLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
          .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      );
    const seen = new Set();
    let latestWords = [];
    const barData = dates.map((day, i) => {
      const dayStr = day.toLocaleDateString('en-US');
      const dayDiaries = diaries.filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === dayStr);
      const newWords = [...new Set(extractW(dayDiaries).filter(w => !seen.has(w)))];
      newWords.forEach(w => seen.add(w));
      if (i === dates.length - 1) latestWords = newWords.slice(0, 15);
      return { value: newWords.length, label: dayLabel(day), frontColor: '#34C759' };
    });
    return { barData, latestWords };
  };

  // ── 최근 7편 기반 데이터 ─────────────────────────────────────────────────────

  const getLast7 = () =>
    [...diaries]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-7);

  const getLast7ThoughtDepth = () =>
    getLast7().map(d => {
      const date = new Date(d.timestamp);
      const obs  = d.structure?.observation ? 1 : 0;
      const feel = d.structure?.thought ? 1 : 0;
      const ins  = d.structure?.insight ? 1 : 0;
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        stacks: [
          { value: Math.max(obs,  0.01), color: obs  ? '#007AFF' : theme.background, marginBottom: 2 },
          { value: Math.max(feel, 0.01), color: feel ? '#AF52DE' : theme.background, marginBottom: 2 },
          { value: Math.max(ins,  0.01), color: ins  ? '#FF9F0A' : theme.background },
        ],
      };
    });

  const getLast7VocabDensity = () =>
    getLast7().map(d => {
      const date = new Date(d.timestamp);
      const words = (d.content || '').split(/\s+/).filter(Boolean);
      const unique   = new Set(words.map(w => w.toLowerCase())).size;
      const repeated = Math.max(0, words.length - unique);
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        stacks: [
          { value: Math.max(unique,   0.01), color: unique   > 0 ? '#007AFF' : theme.background, marginBottom: 1 },
          { value: Math.max(repeated, 0.01), color: repeated > 0 ? '#FF9F0A' : theme.background },
        ],
      };
    });

  const getLast7NewWords = () => {
    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const last7 = sorted.slice(-7);
    const extractW = (list) =>
      list.flatMap(d =>
        (d.content || '').split(/\s+/).filter(Boolean)
          .map(w => w.toLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
          .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      );
    const seen = new Set(extractW(sorted.slice(0, Math.max(0, sorted.length - 7))));
    let latestWords = [];
    const barData = last7.map((d, i) => {
      const date = new Date(d.timestamp);
      const newWords = [...new Set(extractW([d]).filter(w => !seen.has(w)))];
      newWords.forEach(w => seen.add(w));
      if (i === last7.length - 1) latestWords = newWords.slice(0, 15);
      return { value: newWords.length, label: `${date.getMonth() + 1}/${date.getDate()}`, frontColor: '#34C759' };
    });
    return { barData, latestWords };
  };

  const showKpiSheet = (id) => {
    setKpiTooltip(id);
    kpiSheetAnim.setValue(300);
    kpiSheetOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(kpiSheetAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }),
      Animated.timing(kpiSheetOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const hideKpiSheet = () => {
    Animated.parallel([
      Animated.timing(kpiSheetAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
      Animated.timing(kpiSheetOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setKpiTooltip(null));
  };

  const renderLanguageTab = () => {
    const structureData = getStructureData();
    const wordFreq = getWordFrequency();
    const emotionWordMap = getEmotionWordMap();

    const cardInnerW = screenWidth - 40 - 32; // card padding 20*2, inner 16*2
    const yAxisW = 35;
    const chartW = cardInnerW - yAxisW;

    const tdData = getLast7ThoughtDepth();
    const tdBarH = 120;
    const tdBarW = 36;
    const tdSpacing = 12;

    const vdData = getLast7VocabDensity();
    const vdBarW = 28;
    const vdSpacing = 10;

    const { barData: monthlyBarData, latestWords } = getLast7NewWords();
    const mthBarW = 28;
    const mthSpacing = 10;

    const tdHasData = tdData.some(bar => bar.stacks.some(s => s.value > 0.01));
    const vdHasData = vdData.some(bar => bar.stacks.some(s => s.value > 0.01));
    const egHasData = monthlyBarData.some(bar => bar.value > 0);

    const noDataOverlay = (chartHeight) => (
      <View style={{ position: 'absolute', top: chartHeight / 2, left: yAxisW, right: 0, alignItems: 'center' }}>
        <Text style={{ color: theme.tertiaryText, fontSize: 13, fontWeight: '500', backgroundColor: theme.card, paddingHorizontal: 10 }}>
          {t('insight.noData')}
        </Text>
      </View>
    );

    const egNewLabel = 'Latest new expressions';

    return (
      <>
        {/* ── 1. KPI 카드: 나는 이런 사람이다 ── */}
        {(() => {
          const thinkingAll = getThinkingTypeData('all');
          const lensAll = getLanguageLensData('all');
          const allText = diaries.map(d => d.content || '').join(' ');

          // 사고 방식
          let thinking = { emoji: '❓', label: '분석 중', q: '나는 어떻게 생각하나?' };
          if (thinkingAll) {
            const dom = Object.entries(thinkingAll).sort((a,b) => b[1]-a[1])[0][0];
            if (dom === 'causal_reasoning') thinking = { emoji: '🔗', label: '논리 탐구형', q: '나는 어떻게 생각하나?' };
            else if (dom === 'interpretation') thinking = { emoji: '💭', label: '의미 해석형', q: '나는 어떻게 생각하나?' };
            else thinking = { emoji: '📋', label: '사실 기록형', q: '나는 어떻게 생각하나?' };
          }

          // 세상을 보는 시선
          let worldView = { emoji: '❓', label: '분석 중', q: '나는 어떤 눈으로 보나?' };
          if (lensAll) {
            const scores = { open: lensAll.open, 단정: Math.max(lensAll.closed, lensAll.rigid), passive: lensAll.passive };
            const dom = Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0];
            if (dom === 'open') worldView = { emoji: '🔭', label: '탐색하는', q: '나는 어떤 눈으로 보나?' };
            else if (dom === '단정') worldView = { emoji: '🧱', label: '단정하는', q: '나는 어떤 눈으로 보나?' };
            else worldView = { emoji: '🌿', label: '흘려보내는', q: '나는 어떤 눈으로 보나?' };
          }

          // 언어 습관 (시제·질문 빈도로 판단)
          const pastCount    = (allText.match(/했|었|았|지난|어제|예전/g) || []).length;
          const futureCount  = (allText.match(/겠|것이다|할 거|앞으로|내일|계획|하려|하고 싶/g) || []).length;
          const questionCount= (allText.match(/\?|일까|않을까|어떨까|할까|ㄹ까/g) || []).length;
          let langHabit = { emoji: '❓', label: '분석 중', q: '어떤 언어를 쓰나?' };
          if (pastCount || futureCount || questionCount) {
            const maxVal = Math.max(pastCount, futureCount, questionCount);
            if (questionCount === maxVal)  langHabit = { emoji: '❓', label: '질문을 던지는 편', q: '어떤 언어를 쓰나?' };
            else if (futureCount === maxVal) langHabit = { emoji: '🌱', label: '앞을 내다보는 편', q: '어떤 언어를 쓰나?' };
            else langHabit = { emoji: '🕰️', label: '되돌아보는 편', q: '어떤 언어를 쓰나?' };
          }

          return (
            <View style={kpiS.row}>
              {[thinking, worldView, langHabit].map(({ emoji, label, q }) => (
                <View key={q} style={[kpiS.card, { backgroundColor: theme.card, flex: 1, alignItems: 'center', paddingVertical: 16, gap: 6 }]}>
                  <Text style={{ fontSize: 9, color: theme.tertiaryText, textAlign: 'center', lineHeight: 13 }}>{q}</Text>
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primaryText, textAlign: 'center' }}>{label}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* ── 2. 생각의 깊이 ── */}
        {(() => {
          const depthItems = [
            { label: '관찰', sublabel: '사실과 상황', pct: structureData.obs, color: '#C8B89A' },
            { label: '사고', sublabel: '느끼고 해석', pct: structureData.feel, color: '#A89078' },
            { label: '통찰', sublabel: '의미 찾기',   pct: structureData.ins,  color: '#7A5230' },
          ];
          const hasAny = depthItems.some(d => d.pct > 0);
          return (
            <View style={[styles.section, { marginTop: 8 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="filter-outline" size={20} color={theme.accent} />
                <Text style={styles.sectionTitle}>생각의 깊이</Text>
              </View>
              <Text style={styles.sectionSubtitle}>전체 기록 평균</Text>
              <View style={styles.card}>
                {hasAny ? (
                  <View style={{ gap: 16, paddingVertical: 4 }}>
                    {depthItems.map(({ label, sublabel, pct, color }) => (
                      <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ width: 28, fontSize: 13, fontWeight: '600', color: theme.accent }}>{label}</Text>
                        <View style={{ flex: 1, height: 40, backgroundColor: theme.border, borderRadius: 8, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.max(pct, 8)}%`, height: '100%', backgroundColor: color, justifyContent: 'center', paddingLeft: 12 }}>
                            {pct >= 15 && <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{sublabel}</Text>}
                          </View>
                        </View>
                        <Text style={{ width: 36, fontSize: 13, color: theme.secondaryText, textAlign: 'right' }}>{pct}%</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[ttS.noData, { color: theme.tertiaryText }]}>{t('insight.noDataPeriod')}</Text>
                )}
              </View>
            </View>
          );
        })()}

        {/* ── 3. 세상을 어떻게 보나요? — pentagon ── */}
        {(() => {
          const CX = 180, CY = 160, R = 95, LR = 122;
          const lensAll = getLanguageLensData('all');
          const thinkingAll = getThinkingTypeData('all');
          const hasData = lensAll || thinkingAll;
          const pt = (v, i) => {
            const a = -Math.PI / 2 + i * (2 * Math.PI / 5);
            return { x: CX + v * R * Math.cos(a), y: CY + v * R * Math.sin(a) };
          };
          const gridStr = (v) => [0,1,2,3,4].map(i => { const p = pt(v,i); return `${p.x},${p.y}`; }).join(' ');
          const axes = [0,1,2,3,4].map(i => pt(1, i));
          const vals = [
            lensAll?.open ?? 0,
            thinkingAll?.causal_reasoning ?? 0,
            thinkingAll?.interpretation ?? 0,
            lensAll ? Math.max(0, 1 - (lensAll.closed ?? 0)) : 0,
            structureData.ins / 100,
          ];
          const dataStr = vals.map((v, i) => { const p = pt(v, i); return `${p.x},${p.y}`; }).join(' ');
          const axisLabels = [
            { text: '감정 표현', anchor: 'middle', dy: -6 },
            { text: '논리적 사고', anchor: 'start', dy: 4 },
            { text: '미래 지향', anchor: 'start', dy: 4 },
            { text: '관계 중심', anchor: 'end', dy: 4 },
            { text: '자기 성찰', anchor: 'end', dy: 4 },
          ];
          return (
            <View style={styles.section}>
              <View style={styles.cardHeader}>
                <Ionicons name="eye-outline" size={20} color={theme.accent} />
                <Text style={styles.sectionTitle}>세상을 어떻게 보나요?</Text>
              </View>
              <Text style={styles.sectionSubtitle}>전체 기록 평균</Text>
              <View style={styles.card}>
                {hasData ? (
                  <Svg width="100%" height={320} viewBox="0 0 360 320">
                    {[0.25, 0.5, 0.75, 1.0].map(v => (
                      <Polygon key={v} points={gridStr(v)} fill="none" stroke={theme.border} strokeWidth="1" />
                    ))}
                    {axes.map((p, i) => (
                      <Line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={theme.border} strokeWidth="1" />
                    ))}
                    <Polygon points={dataStr} fill="rgba(122,82,48,0.12)" stroke="#7A5230" strokeWidth="1.8" />
                    {vals.map((v, i) => { const p = pt(v, i); return <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#7A5230" />; })}
                    {axisLabels.map(({ text, anchor, dy }, i) => {
                      const a = -Math.PI / 2 + i * (2 * Math.PI / 5);
                      return (
                        <SvgText key={i} x={CX + LR * Math.cos(a)} y={CY + LR * Math.sin(a) + dy} textAnchor={anchor} fontSize="12" fill={theme.secondaryText}>
                          {text}
                        </SvgText>
                      );
                    })}
                  </Svg>
                ) : (
                  <Text style={[ttS.noData, { marginTop: 8, color: theme.tertiaryText }]}>{t('insight.noDataPeriod')}</Text>
                )}
              </View>
            </View>
          );
        })()}

        {/* ── 4. 나의 언어 습관 — 2×2 그리드 ── */}
        {(() => {
          const allText = diaries.map(d => d.content || '').join(' ');
          const lensAll = getLanguageLensData('all');

          // 시제
          const past   = (allText.match(/했|었|았|지난|어제|예전/g) || []).length;
          const future = (allText.match(/겠|것이다|할 거|앞으로|내일|계획|하려|하고 싶/g) || []).length;
          const present= (allText.match(/이다|있다|한다|지금/g) || []).length;
          const tenseTotal = past + future + present || 1;
          const tenseLabel = past >= future && past >= present ? '과거형' : future >= present ? '미래형' : '현재형';
          const tenseBar = past >= future && past >= present ? past/tenseTotal : future >= present ? future/tenseTotal : present/tenseTotal;

          // 문장 태도
          const openScore   = lensAll?.open ?? null;
          const closedScore = lensAll ? Math.max(lensAll.closed, lensAll.rigid) : null;
          const attitudeLabel = openScore === null ? '분석 중' : openScore > (closedScore ?? 0) ? '탐색형' : '단정형';
          const attitudeBar   = openScore !== null ? openScore : 0;

          // 질문 빈도
          const qCount   = (allText.match(/\?|일까|않을까|어떨까|할까/g) || []).length;
          const sentCount= (allText.match(/[.!?\n]/g) || []).length || 1;
          const qRate    = Math.min(1, (qCount / sentCount) * 8);
          const qLabel   = qRate > 0.5 ? '많이' : qRate > 0.15 ? '가끔' : '거의 없음';

          // 주어
          const selfCount = (allText.match(/나는|나도|내가|저는|제가|나를/g) || []).length;
          const otherCount= (allText.match(/친구|가족|그는|그녀|사람들|다들/g) || []).length;
          const subTotal  = selfCount + otherCount || 1;
          const subRatio  = selfCount / subTotal;
          const subLabel  = subRatio > 0.7 ? '나 중심' : subRatio < 0.3 ? '타인 중심' : '혼합';

          const habits = [
            { label: '시제',     type: tenseLabel,    bar: tenseBar,    desc: '주로 쓰는 시제' },
            { label: '문장 태도', type: attitudeLabel,  bar: attitudeBar,  desc: '표현 방식' },
            { label: '질문 빈도', type: qLabel,         bar: qRate,        desc: '의문문 빈도' },
            { label: '주어',     type: subLabel,       bar: subRatio,     desc: '이야기의 중심' },
          ];

          return (
            <View style={styles.section}>
              <View style={styles.cardHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.accent} />
                <Text style={styles.sectionTitle}>나의 언어 습관</Text>
              </View>
              <Text style={styles.sectionSubtitle}>전체 기록 분석</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {habits.map(({ label, type, bar, desc }) => (
                  <View key={label} style={[styles.card, { width: '47.5%', gap: 8 }]}>
                    <Text style={{ fontSize: 11, color: theme.tertiaryText }}>{label}</Text>
                    <View style={{ height: 6, borderRadius: 99, backgroundColor: theme.border, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.round(bar * 100)}%`, height: '100%', backgroundColor: '#7A5230', borderRadius: 99 }} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primaryText }}>{type}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* 5. Layer Depth */}
        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <Ionicons name="analytics-outline" size={20} color={theme.accent} />
            <Text style={styles.sectionTitle}>{t('insight.layerDepth')}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>최근 7편 기준</Text>
          <View style={styles.card}>
            {/* Legend */}
            <View style={[styles.chartLegend, { marginBottom: 16 }]}>
              {[
                { label: 'Observation', color: '#C5DCFF' },
                { label: 'Thought',     color: '#7EB3FF' },
                { label: 'Insight',     color: '#2D7DD2' },
              ].map(({ label, color }) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[tdS.legendSquare, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
            {/* Custom bar chart */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, gap: tdSpacing }}>
                {tdData.map((bar, i) => {
                  const obs     = bar.stacks[0].value > 0.01;
                  const thought = bar.stacks[1].value > 0.01;
                  const insight = bar.stacks[2].value > 0.01;
                  const secH = tdBarH / 3;
                  return (
                    <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                      <View style={{ width: tdBarW, height: tdBarH, backgroundColor: theme.border, borderRadius: 10, overflow: 'hidden' }}>
                        {insight && <View style={{ height: secH, backgroundColor: '#2D7DD2' }} />}
                        {thought && <View style={{ height: secH, backgroundColor: '#7EB3FF' }} />}
                        {obs     && <View style={{ height: secH, backgroundColor: '#C5DCFF' }} />}
                      </View>
                      {bar.label ? (
                        <Text style={{ fontSize: 10, color: theme.secondaryText }}>{bar.label}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            {!tdHasData && (
              <View style={{ position: 'absolute', top: 80, left: 0, right: 0, alignItems: 'center' }}>
                <Text style={{ color: theme.tertiaryText, fontSize: 13, fontWeight: '500' }}>{t('insight.noData')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 4. Vocabulary & Writing Density */}
        <View style={styles.section}>
          <View style={styles.cardHeader}>
            <Ionicons name="library-outline" size={20} color={theme.accent} />
            <Text style={styles.sectionTitle}>{t('insight.vocabDensity')}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>최근 7편 기준</Text>
          <View style={styles.card}>
            <View style={{ position: 'relative' }}>
              <BarChart
                key="vd-daily"
                scrollToEnd
                stackData={vdData}
                barWidth={vdBarW}
                spacing={vdSpacing}
                initialSpacing={8}
                endSpacing={8}
                height={160}
                noOfSections={4}
                yAxisLabelWidth={yAxisW}
                yAxisTextStyle={{ color: theme.secondaryText, fontSize: 11 }}
                xAxisLabelTextStyle={{ color: theme.secondaryText, fontSize: 10 }}
                xAxisColor="transparent"
                yAxisColor="transparent"
                rulesColor={theme.border}
                rulesType="dashed"
                isAnimated
              />
              {!vdHasData && noDataOverlay(160)}
            </View>
            <View style={styles.chartLegend}>
              {[
                { label: 'Unique vocab', color: '#007AFF' },
                { label: 'Total words', color: '#FF9F0A' },
              ].map(({ label, color }) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>



        {/* Word Patterns — Today */}
        {(() => {
          const todayStr = new Date().toLocaleDateString('en-US');
          const todayText = diaries
            .filter(d => new Date(d.timestamp).toLocaleDateString('en-US') === todayStr && d.content)
            .map(d => d.content).join(' ');
          if (!todayText.trim()) return null;
          const thinkingKw = extractKeywords(todayText, THINKING_KW);
          const lensKw = extractKeywords(todayText, LENS_KW);

          const NOTHING = 'Nothing today';
          const Chip = ({ text, bg, color, empty }) => (
            <View style={[kwS.chip, { backgroundColor: bg }]}>
              <Text style={[kwS.chipText, { color }, empty && kwS.chipTextEmpty]}>{text}</Text>
            </View>
          );
          const Row = ({ label, words, bg, color }) => (
            <View style={kwS.row}>
              <Text style={[kwS.rowLabel, { color: theme.secondaryText }]}>{label}</Text>
              <View style={kwS.chips}>
                {words.length > 0
                  ? words.map((w, i) => <Chip key={i} text={w} bg={bg} color={color} />)
                  : <Chip text={NOTHING} bg={theme.background} color={theme.tertiaryText} empty />}
              </View>
            </View>
          );

          return (
            <>
              <View style={styles.section}>
                <View style={styles.cardHeader}>
                  <Ionicons name="sparkles-outline" size={20} color={theme.accent} />
                  <Text style={styles.sectionTitle}>How concrete was my thinking today?</Text>
                </View>
                <View style={styles.card}>
                  <Row label="Causal"        words={thinkingKw.causal_reasoning} bg="#EBF4FF" color="#2D7DD2" />
                  <View style={[kwS.divider, { backgroundColor: theme.border }]} />
                  <Row label="Interpretation" words={thinkingKw.interpretation}   bg="#F3E5F5" color="#7B1FA2" />
                  <View style={[kwS.divider, { backgroundColor: theme.border }]} />
                  <Row label="Event"          words={thinkingKw.event_listing}    bg="#FCE4EC" color="#C62828" />
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.cardHeader}>
                  <Ionicons name="language-outline" size={20} color={theme.accent} />
                  <Text style={styles.sectionTitle}>How did I see the world today?</Text>
                </View>
                <View style={styles.card}>
                  <Row label="Closed"  words={lensKw.closed}  bg="#FFF3E0" color="#E65100" />
                  <View style={[kwS.divider, { backgroundColor: theme.border }]} />
                  <Row label="Rigid"   words={lensKw.rigid}   bg="#FFF8E1" color="#F57F17" />
                  <View style={[kwS.divider, { backgroundColor: theme.border }]} />
                  <Row label="Passive" words={lensKw.passive} bg="#F3E5F5" color="#6A1B9A" />
                  <View style={[kwS.divider, { backgroundColor: theme.border }]} />
                  <Row label="Open"    words={lensKw.open}    bg="#E8F5E9" color="#2E7D32" />
                </View>
              </View>
            </>
          );
        })()}
      </>
    );
  };

  const selectedEntries = selectedDate?.entries || [];

  return (
    <View style={[styles.container, { backgroundColor: '#fbf9f8' }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fbf9f8' }}>
        {/* ── Meow 헤더 ── */}
        <View style={[styles.headerBar, { backgroundColor: '#fbf9f8', borderBottomColor: 'rgba(211,196,187,0.6)' }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color="#4f453e" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: '#1b1c1c', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }]}>
            {t('meow.insight.fullHistoryTitle')}
          </Text>
          <Text style={[styles.diaryCountText, { color: '#81756d' }]}>{diaries.length}편</Text>
        </View>


        {/* ── Emotions / Language 탭 ── */}
        <View style={[styles.tabContainer, { backgroundColor: '#fbf9f8', borderBottomColor: 'rgba(211,196,187,0.4)' }]}>
          {[
            { key: 'emotion',   label: t('meow.insight.emotionsTab') },
            { key: 'language',  label: t('meow.insight.languageTab') },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && { ...styles.tabActive, backgroundColor: '#755844', borderColor: '#755844' }]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, { color: '#81756d' }, activeTab === key && { ...styles.tabTextActive, color: '#ffffff' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {/* ── 빈 상태 / 로딩 / 실데이터 ── */}
      {!insightLoaded ? (
        /* 로딩: shimmer skeleton */
        <InsightSkeleton shimmer />
      ) : diaries.length === 0 ? (
        /* 빈 상태 */
        <View style={{ flex: 1 }}>
          {/* 넛지 카드 */}
          <View style={emptyS.nudgeCard}>
            <Text style={emptyS.nudgeEmoji}>🐱</Text>
            <Text style={emptyS.nudgeText}>{t('meow.insight.emptyNudge', { catName })}</Text>
          </View>

          {/* 흐릿한 skeleton */}
          <View style={{ flex: 1, opacity: 0.45 }} pointerEvents="none">
            <InsightSkeleton />
          </View>

          {/* 하단 CTA */}
          <View style={emptyS.ctaWrap}>
            <TouchableOpacity
              style={emptyS.ctaBtn}
              onPress={() => navigation.navigate('Write')}
              activeOpacity={0.85}
            >
              <Text style={emptyS.ctaBtnText}>{t('meow.insight.emptyWriteCTA')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* 실데이터 */
        <ScrollView contentContainerStyle={{ width: screenWidth }}>
          {activeTab === 'emotion' ? renderEmotionTab() : renderLanguageTab()}
        </ScrollView>
      )}

      {/* Day detail modal */}
      <Modal
        visible={dayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <TouchableOpacity
          style={actS.sheetOverlay}
          activeOpacity={1}
          onPress={() => setDayModalVisible(false)}
        >
          <TouchableOpacity style={[actS.sheetCard, { backgroundColor: theme.modalBackground }]} activeOpacity={1}>
            <View style={[actS.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[actS.sheetTitle, { color: theme.primaryText }]}>
              {selectedDate?.key
                ? (() => {
                    const d = new Date(selectedDate.key + 'T00:00:00');
                    return `${MONTH_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                  })()
                : ''}
            </Text>

            {selectedEntries.length === 0 ? (
              <View style={actS.sheetEmpty}>
                <Text style={[actS.sheetEmptyText, { color: theme.tertiaryText }]}>No notes on this day</Text>
              </View>
            ) : (
              <FlatList
                data={selectedEntries}
                keyExtractor={item => item.id}
                style={{ maxHeight: 340 }}
                renderItem={({ item }) => {
                  const tagColor = getTagColor(item.tag || null, allUniqueTags);
                  return (
                    <View style={[actS.noteItem, { borderLeftColor: tagColor, backgroundColor: theme.background }]}>
                      <View style={actS.noteHeader}>
                        {item.tag ? (
                          <View style={[actS.noteTagBadge, { backgroundColor: tagColor }]}>
                            <Text style={actS.noteTagBadgeText}>{item.tag}</Text>
                          </View>
                        ) : (
                          <Text style={[actS.noteNoTag, { color: theme.tertiaryText }]}>no tag</Text>
                        )}
                        <Text style={[actS.noteEmotion, { color: theme.tertiaryText }]}>{item.emoji} {item.emotion}</Text>
                      </View>
                      <Text style={[actS.noteTitle, { color: theme.primaryText }]}>{item.title}</Text>
                      <Text style={[actS.noteContent, { color: theme.secondaryText }]} numberOfLines={2}>{item.content}</Text>
                    </View>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[actS.sheetCloseBtn, { backgroundColor: theme.background }]}
              onPress={() => setDayModalVisible(false)}
            >
              <Text style={[actS.sheetCloseTxt, { color: theme.accent }]}>{t('common.close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.card,
    gap: 4,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: '700',
    color: theme.primaryText,
    flex: 1,
  },
  diaryCountText: {
    color: theme.secondaryText,
    fontSize: 14,
    marginTop: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: theme.secondaryText,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: theme.border,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: theme.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.secondaryText,
  },
  tabTextActive: {
    color: theme.primaryText,
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statCardWrapper: {
    width: (screenWidth - 52) / 2,
  },
  statCardWrapperRight: {
    width: (screenWidth - 52) / 2,
    marginLeft: 12,
  },
  statCard: {
    height: 140,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.primaryText,
    marginTop: 8,
  },
  statLabel: { fontSize: 12, color: theme.secondaryText, marginTop: 4 },
  statEmotion: {
    fontSize: 12,
    color: theme.accent,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primaryText,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.secondaryText,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  // Card
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  noDataText: {
    fontSize: 14,
    color: theme.tertiaryText,
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Rank rows (Top 3 words / phrases)
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankNum: {
    width: 22,
    fontSize: 15,
    fontWeight: '700',
    color: theme.tertiaryText,
  },
  rankWord: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.primaryText,
  },
  rankBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: theme.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  rankBarInner: {
    height: '100%',
    borderRadius: 4,
  },
  rankCount: {
    width: 30,
    fontSize: 13,
    color: theme.secondaryText,
    textAlign: 'right',
    fontWeight: '600',
  },
  // Style pattern rows
  styleRow: {
    marginBottom: 14,
  },
  styleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  styleEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  styleName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primaryText,
  },
  styleDesc: {
    fontSize: 12,
    color: theme.secondaryText,
    marginTop: 1,
  },
  styleScore: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.secondaryText,
    marginLeft: 8,
  },
  styleBarOuter: {
    height: 6,
    backgroundColor: theme.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  styleBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  // Chart legend
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.secondaryText,
  },
  // Summary
  summaryText: {
    fontSize: 15,
    color: theme.primaryText,
    lineHeight: 24,
  },
  // Empty
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyChartText: {
    fontSize: 14,
    color: theme.tertiaryText,
    textAlign: 'center',
  },
  // Recent entries
  recentCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentDate: { fontSize: 12, color: theme.secondaryText },
  recentEmoji: { fontSize: 20 },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primaryText,
    marginBottom: 4,
  },
  recentContent: {
    fontSize: 14,
    color: theme.secondaryText,
    lineHeight: 20,
  },
});

// ── Emotion tab styles ────────────────────────────────────────────────────────
const emotionS = StyleSheet.create({
  compareRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compareItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  compareEmoji: {
    fontSize: 38,
    marginBottom: 4,
  },
  compareLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C7C7CC',
    letterSpacing: 0.8,
  },
  todayLabel: {
    color: '#6366f1',
  },
  patternsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  patternCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  patternPeriodIcon: {
    fontSize: 18,
  },
  patternLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  patternEmoji: {
    fontSize: 28,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  distRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  distEmoji: {
    fontSize: 26,
    width: 32,
    textAlign: 'center',
  },
  distName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    width: 76,
  },
  distPercent: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
    width: 44,
    textAlign: 'right',
  },
  distBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  distBarInner: {
    height: '100%',
    borderRadius: 4,
  },
});
// Note: emotionS uses fixed light colors because it includes brand (#6366f1) and semantic pattern bg colors

// ── Activity tab styles are built inline via theme; static fallback kept for non-theme properties
const actS = StyleSheet.create({
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  navIconBtn: { padding: 6 },
  monthLabelBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  monthLabelText: { fontSize: 16, fontWeight: '800' },
  todayBadge: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 4,
  },
  todayBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  pillScroll: { marginHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  pillContent: { paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginHorizontal: 2 },
  pillActive: {},
  pillText: { fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  chartSection: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  chartEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  chartEmptyText: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  chartEmptySub: { fontSize: 12 },

  calendarCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
  },
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  calNavTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  calendarTitle: {
    fontSize: 14, fontWeight: '700',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
  },
  weekCell: { alignItems: 'center' },
  weekText: { fontSize: 11, fontWeight: '700' },
  sunColor: { color: '#ef4444' },
  satColor: {},

  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 8 },
  dayCell: {
    width: DAY_WIDTH,
    minHeight: 72,
    paddingTop: 6,
    paddingBottom: 5,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayNumWrap: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginBottom: 3 },
  todayCircle: {},
  dayText: { fontSize: 12, fontWeight: '600' },
  todayText: { color: '#fff', fontWeight: '800' },
  tagStack: { width: DAY_WIDTH - 8, gap: 2, alignItems: 'flex-start' },
  catTag: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 2, width: '100%' },
  catTagText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  moreTag: { fontSize: 9, marginTop: 1 },

  calLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegendDot: { width: 8, height: 8, borderRadius: 4 },
  calLegendText: { fontSize: 12 },

  // Day detail modal
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  sheetEmpty: { paddingVertical: 32, alignItems: 'center' },
  sheetEmptyText: { fontSize: 14 },

  noteItem: {
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  noteTagBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  noteTagBadgeText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  noteNoTag: { fontSize: 11, fontWeight: '500' },
  noteEmotion: { marginLeft: 'auto', fontSize: 12 },
  noteTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  noteContent: { fontSize: 12, lineHeight: 17 },

  sheetCloseBtn: { marginTop: 14, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  sheetCloseTxt: { fontSize: 14, fontWeight: '600' },
});

// ── KPI card styles — colors applied inline via theme in JSX ──────────────────
const kpiS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
    width: screenWidth,
  },
  card: {
    width: Math.floor((screenWidth - 40 - 20) / 3),
    height: 140,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  cardBigValue: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardDesc: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
  cardTop: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cardEmoji: {
    fontSize: 34,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vsPercent: {
    fontSize: 16,
    fontWeight: '700',
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 48,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sheetBody: {
    fontSize: 15,
    lineHeight: 24,
  },
  infoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateBadgeText: {
    fontSize: 12,
  },
});

const insightTabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  centerInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});

// ── Mood Calendar styles ──────────────────────────────────────────────────────
const moodCalS = StyleSheet.create({
  container: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  navBtn: { padding: 6 },
  monthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  weekCell: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: '#6366f1',
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 1,
  },
  todayNum: {
    color: '#6366f1',
    fontWeight: '800',
  },
  emojiText: {
    fontSize: 18,
  },
});

// ── Language tab styles ───────────────────────────────────────────────────────
// ttS colors injected via inline theme where needed
const ttS = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  barsWrap: {
    gap: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 95,
    fontSize: 13,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: 10,
    borderRadius: 5,
  },
  barPct: {
    width: 36,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
  noData: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});

const tdS = StyleSheet.create({
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});

const langS = StyleSheet.create({
  // Structure Score card (black bg)
  wideCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
  },
  wideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  wideCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  wideCardScore: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  wideCardScoreUnit: {
    fontSize: 18,
    fontWeight: '400',
    color: '#8E8E93',
  },
  infoBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  infoBtnText: {
    fontSize: 12,
    color: '#E5E5EA',
    fontWeight: '500',
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#AF52DE',
  },
  subScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  subScoreItem: {
    alignItems: 'center',
    gap: 4,
  },
  subScoreLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  subScorePct: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoBox: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    color: '#AEAEB2',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoRowIcon: {
    fontSize: 15,
    width: 22,
  },
  infoRowLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  infoRowPts: {
    fontSize: 13,
    color: '#AEAEB2',
    fontWeight: '600',
  },
  infoDesc: {
    fontSize: 12,
    color: '#AEAEB2',
    lineHeight: 18,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
  // Range selector
  rangeSelector: {
    flexDirection: 'row',
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rangeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  rangeBtnActive: {
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    marginHorizontal: 2,
    marginTop: 6,
    marginBottom: 2,
  },
  rangeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rangeBtnTextActive: {
    color: '#FFFFFF',
  },
  // Monthly new words
  newWordsSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  newWordsSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  newWordTag: {
    backgroundColor: '#E8FBF0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  newWordTagText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '600',
  },
  // Word cloud (dark card)
  darkCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
  },
  wordCloudWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  wordChipText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emotionWordSection: {
    marginTop: 4,
  },
  emotionWordDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 16,
  },
  emotionWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  emotionWordEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  emotionWordTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  emotionWordTag: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  emotionWordTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Synonym card
  synonymRow: {
    paddingVertical: 14,
    gap: 10,
  },
  synonymRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  synonymSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  synonymWord: {
    fontSize: 16,
    fontWeight: '700',
  },
  synonymCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  synonymChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  synonymChip: {
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  synonymChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  noSynonymText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

const kwS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 10,
  },
  rowLabel: {
    width: 82,
    fontSize: 13,
    fontWeight: '600',
    paddingTop: 4,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextEmpty: {
    fontStyle: 'italic',
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});

