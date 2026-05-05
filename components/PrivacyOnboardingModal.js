import { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Switch, Modal, ScrollView, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PRIVACY_POLICY } from '../constants/privacyPolicy';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  secondary: '#3d665a',
  secondaryContainer: '#bce9d9',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  surfaceContainer: '#f0eded',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const STEP_ICONS = ['🐱', '🤖', '✨'];
const STEP_BG = [
  'rgba(255,216,190,0.4)',   // primaryContainer tint
  'rgba(188,233,217,0.4)',   // secondaryContainer tint
  'rgba(255,216,190,0.4)',
];

export default function PrivacyOnboardingModal({ visible, onComplete }) {
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState(0);
  const [useAI, setUseAI] = useState(true);
  const [showPolicy, setShowPolicy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const STEPS = [
    {
      title: t('privacy.step1Title'),
      description: t('privacy.step1Desc'),
    },
    {
      title: t('privacy.step2Title'),
      description: t('privacy.step2Desc'),
      hasToggle: true,
    },
    {
      title: t('privacy.step3Title'),
      description: t('privacy.step3Desc'),
      isFinal: true,
    },
  ];

  const goToStep = (step) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setCurrentStep(step);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const step = STEPS[currentStep];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={S.root}>
        <SafeAreaView style={S.safe} edges={['top', 'bottom']}>

          {/* Progress dots */}
          <View style={S.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[S.dot, currentStep === i && S.dotActive]}
              />
            ))}
          </View>

          {/* Content */}
          <View style={S.body}>
            <Animated.View style={[S.center, { opacity: fadeAnim }]}>

              {/* Icon circle */}
              <View style={[S.iconCircle, { backgroundColor: STEP_BG[currentStep] }]}>
                <Text style={S.iconEmoji}>{STEP_ICONS[currentStep]}</Text>
              </View>

              <Text style={S.title}>{step.title}</Text>
              <Text style={S.description}>{step.description}</Text>

              {/* AI toggle */}
              {step.hasToggle && (
                <View style={S.toggleCard}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={S.toggleLabel}>{t('privacy.aiToggleLabel')}</Text>
                    <Text style={S.toggleHint}>
                      {useAI ? t('privacy.aiEnabledHint') : t('privacy.aiDisabledHint')}
                    </Text>
                  </View>
                  <Switch
                    value={useAI}
                    onValueChange={setUseAI}
                    trackColor={{ false: C.outlineVariant, true: C.secondary }}
                    thumbColor={C.surface}
                  />
                </View>
              )}

              {/* CTA button */}
              {step.isFinal ? (
                <TouchableOpacity style={S.ctaBtn} onPress={() => onComplete(useAI)} activeOpacity={0.85}>
                  <Text style={S.ctaBtnText}>{t('privacy.getStarted')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={S.ctaBtn} onPress={() => goToStep(currentStep + 1)} activeOpacity={0.85}>
                  <Text style={S.ctaBtnText}>{t('common.next')}</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>

          {/* Privacy policy link */}
          <TouchableOpacity style={S.policyLink} onPress={() => setShowPolicy(true)} activeOpacity={0.7}>
            <Text style={S.policyLinkText}>{t('privacy.policyLink')}</Text>
          </TouchableOpacity>

        </SafeAreaView>
      </View>

      {/* Privacy policy sheet */}
      <Modal visible={showPolicy} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={S.policyRoot} edges={['top']}>
          <View style={S.policyHeader}>
            <TouchableOpacity onPress={() => setShowPolicy(false)} hitSlop={8}>
              <Text style={S.policyClose}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            <Text style={S.policyText}>{PRIVACY_POLICY}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  safe: { flex: 1, paddingHorizontal: 28 },

  // Progress dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.outlineVariant,
  },
  dotActive: {
    width: 24, backgroundColor: C.primary,
  },

  // Body
  body: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center' },

  // Icon circle
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 3,
  },
  iconEmoji: { fontSize: 52 },

  // Text
  title: {
    fontFamily: SERIF,
    fontSize: 26, fontWeight: '700',
    color: C.onSurface, textAlign: 'center',
    marginBottom: 14, lineHeight: 34,
  },
  description: {
    fontSize: 15, color: C.outline,
    textAlign: 'center', lineHeight: 24,
    marginBottom: 36,
  },

  // AI toggle card
  toggleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    padding: 16, borderRadius: 16,
    width: '100%', marginBottom: 32,
    borderWidth: 1, borderColor: C.outlineVariant,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  toggleLabel: {
    fontSize: 15, fontWeight: '600', color: C.onSurface, marginBottom: 4,
  },
  toggleHint: {
    fontSize: 12, color: C.outline, lineHeight: 17,
  },

  // CTA button
  ctaBtn: {
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 48, paddingVertical: 16,
    borderRadius: 99,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  ctaBtnText: {
    color: C.primary, fontSize: 16,
    fontWeight: '700', fontFamily: SERIF,
  },

  // Policy link
  policyLink: { alignItems: 'center', paddingVertical: 16 },
  policyLinkText: {
    fontSize: 13, color: C.outline,
    textDecorationLine: 'underline',
  },

  // Policy modal
  policyRoot: { flex: 1, backgroundColor: C.surface },
  policyHeader: {
    flexDirection: 'row', justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.outlineVariant,
  },
  policyClose: { fontSize: 16, color: C.primary, fontWeight: '600' },
  policyText: { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 22 },
});
