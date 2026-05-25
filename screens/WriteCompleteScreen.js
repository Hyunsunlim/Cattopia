import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useCatName } from '../context/CatNameContext';
import { analyzeNote, getCachedNotes } from '../services/notes';

const EMOTION_CAT = {
  joy: '😸', neutral: '😺', sadness: '😿',
  anger: '😾', fear: '🙀', surprise: '🙀', disgust: '😼',
};
const EMOTION_LABEL = {
  joy: 'Happy 😊', neutral: 'Calm 😌', sadness: 'Sad 🌧️',
  anger: 'Grumpy 😾', fear: 'Scared 🙀', surprise: 'Curious 👀', disgust: 'Bleh 😿',
};

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
};

const TOTAL_STORIES = 66;

export default function WriteCompleteScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { catName } = useCatName();
  const count = route?.params?.count ?? 1;
  const serverId = route?.params?.serverId ?? null;
  const content = route?.params?.content ?? '';
  const remaining = Math.max(0, TOTAL_STORIES - count);
  const progress = Math.min(1, count / TOTAL_STORIES);

  const [catEmoji, setCatEmoji] = useState('😸');
  const [emotionLabel, setEmotionLabel] = useState(null);

  // Animate progress bar fill
  const barAnim = useRef(new Animated.Value(0)).current;
  // Animate rice bowl bounce
  const riceAnim = useRef(new Animated.Value(0)).current;
  // Cat scale (nom effect)
  const catScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // AI 분석 후 감정 반영
    if (serverId && content) {
      analyzeNote(serverId, content).then(async () => {
        const notes = await getCachedNotes();
        const note = notes.find(n => String(n._serverId) === String(serverId));
        const emotion = note?.emotion;
        if (emotion && EMOTION_CAT[emotion]) {
          setCatEmoji(EMOTION_CAT[emotion]);
          setEmotionLabel(EMOTION_LABEL[emotion] ?? null);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Rice emoji bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(riceAnim, { toValue: -10, duration: 400, useNativeDriver: true }),
        Animated.timing(riceAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    ).start();

    // Cat nom
    Animated.loop(
      Animated.sequence([
        Animated.timing(catScale, { toValue: 1.06, duration: 180, useNativeDriver: true }),
        Animated.timing(catScale, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      { iterations: 3 }
    ).start();

    // Progress bar slide in
    Animated.timing(barAnim, {
      toValue: progress,
      duration: 900,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, []);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <View style={styles.body}>
        {/* Rice emoji */}
        <Animated.Text style={[styles.riceEmoji, { transform: [{ translateY: riceAnim }] }]}>
          🍚
        </Animated.Text>

        {/* Heading */}
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>{t('meow.complete.heading', { catName: catName })}</Text>
          <Text style={styles.subheading}>{t('meow.complete.subheading', { catName: catName })}</Text>
        </View>

        {/* Cat circle */}
        <Animated.View style={[styles.catCircle, { transform: [{ scale: catScale }] }]}>
          <View style={styles.catGlow} />
          <View style={styles.catInner}>
            <Text style={styles.catEmoji}>{catEmoji}</Text>
          </View>
        </Animated.View>

        {emotionLabel && (
          <View style={styles.emotionBadge}>
            <Text style={styles.emotionBadgeText}>{emotionLabel}</Text>
          </View>
        )}

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressCardHeader}>
            <Text style={styles.progressCardTitle}>{t('meow.complete.catGrowth', { catName: catName })}</Text>
            <Text style={styles.progressCardCount}>{count} / {TOTAL_STORIES} 🐾</Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: barWidth }]} />
          </View>

          <Text style={styles.progressNote}>
            {remaining > 0
              ? t('meow.complete.remaining', { n: remaining })
              : t('meow.complete.grownUp', { catName: catName })}
          </Text>
        </View>

        {/* Home button */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>{t('meow.complete.goHome')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },

  // Rice
  riceEmoji: {
    fontSize: 56,
    marginBottom: -4,
  },

  // Heading
  headingBlock: { alignItems: 'center', gap: 8 },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: C.onSurface,
    fontFamily: 'Georgia',
    textAlign: 'center',
    lineHeight: 36,
  },
  subheading: {
    fontSize: 14,
    color: C.outline,
    textAlign: 'center',
  },

  // Cat
  catCircle: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,216,190,0.45)',
  },
  catInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.surface,
    borderWidth: 3,
    borderColor: C.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  catEmoji: { fontSize: 72 },

  // Progress card
  progressCard: {
    width: '100%',
    backgroundColor: C.surfaceContainerLow,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.onSurface,
  },
  progressCardCount: {
    fontSize: 13,
    fontWeight: '700',
    color: C.secondary,
  },
  progressTrack: {
    height: 14,
    borderRadius: 99,
    backgroundColor: C.surfaceContainer,
    overflow: 'hidden',
    padding: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: C.secondaryFixedDim,
    minWidth: 16,
  },
  progressNote: {
    fontSize: 12,
    color: C.outline,
    textAlign: 'center',
  },

  // Emotion badge
  emotionBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,216,190,0.6)',
    marginTop: -8,
  },
  emotionBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.primary,
  },

  // Home button
  homeBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 99,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  homeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: C.primary,
    fontFamily: 'Georgia',
  },
});
