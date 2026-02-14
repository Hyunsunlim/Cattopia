import { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_POLICY } from '../constants/privacyPolicy';

const STEPS = [
  {
    icon: '\u{1F512}',
    title: 'Your Privacy Matters',
    description: 'All your notes are stored locally on your device. Your data stays private and never leaves without your permission.',
  },
  {
    icon: '\u{1F916}',
    title: 'AI Emotion Analysis',
    description: 'Choose whether to use AI for more accurate emotion analysis, or keep everything local for maximum privacy.',
    hasToggle: true,
  },
  {
    icon: '\u2728',
    title: "You're All Set!",
    description: 'Start writing your notes. You can change AI settings anytime in Settings.',
    isFinal: true,
  },
];

export default function PrivacyOnboardingModal({ visible, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [useAI, setUseAI] = useState(true);
  const [showPolicy, setShowPolicy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToStep = (step) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(step);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    }
  };

  const handleGetStarted = () => {
    onComplete(useAI);
  };

  const step = STEPS[currentStep];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.outerContainer}>
        <SafeAreaView style={styles.safeArea}>
          {/* Main content - centered */}
          <View style={styles.content}>
            <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
              <Text style={styles.icon}>{step.icon}</Text>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.description}>{step.description}</Text>

              {step.hasToggle && (
                <View style={styles.toggleCard}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Use AI Analysis</Text>
                    <Text style={styles.toggleHint}>
                      {useAI
                        ? 'Note content will be sent to our analysis server'
                        : 'Local keyword analysis (stays on device)'}
                    </Text>
                  </View>
                  <Switch
                    value={useAI}
                    onValueChange={setUseAI}
                    trackColor={{ false: '#e0e0e0', true: '#6366f1' }}
                    thumbColor="white"
                  />
                </View>
              )}

              {step.isFinal ? (
                <TouchableOpacity style={styles.startButton} onPress={handleGetStarted}>
                  <Text style={styles.startButtonText}>Get Started</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                  <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>

          {/* Bottom section - dots + policy link */}
          <View style={styles.bottom}>
            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, currentStep === i && styles.dotActive]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.policyLink}
              onPress={() => setShowPolicy(true)}
            >
              <Text style={styles.policyLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Policy Modal */}
      <Modal visible={showPolicy} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.policyContainer}>
          <View style={styles.policyHeader}>
            <TouchableOpacity onPress={() => setShowPolicy(false)}>
              <Text style={styles.policyClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.policyScroll}>
            <Text style={styles.policyText}>{PRIVACY_POLICY}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#f9f5f5',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 14,
    width: '100%',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  toggleHint: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  nextButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  // Bottom section
  bottom: {
    paddingBottom: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  dotActive: {
    backgroundColor: '#6366f1',
    width: 24,
  },
  policyLink: {
    alignItems: 'center',
  },
  policyLinkText: {
    fontSize: 14,
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
  // Policy modal
  policyContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  policyHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  policyClose: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  policyScroll: {
    padding: 20,
  },
  policyText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
});
