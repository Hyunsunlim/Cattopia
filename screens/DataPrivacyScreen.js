import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { PRIVACY_POLICY } from '../constants/privacyPolicy';

export default function DataPrivacyScreen({ navigation }) {
  const [useAIAnalysis, setUseAIAnalysis] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const aiSetting = await AsyncStorage.getItem('useAIAnalysis');
      setUseAIAnalysis(aiSetting === 'true');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleAIToggle = async (value) => {
    setUseAIAnalysis(value);
    await AsyncStorage.setItem('useAIAnalysis', value.toString());
    Alert.alert(
      value ? 'AI Analysis Enabled' : 'AI Analysis Disabled',
      value
        ? 'More accurate emotion detection. Note content will be sent to our analysis server.'
        : 'Using local keyword analysis. Your data stays on your device. (Accuracy may be lower)'
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data & Privacy</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* AI Analysis Toggle */}
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>AI Emotion Analysis</Text>
            <Text style={styles.settingDescription}>
              {useAIAnalysis ? 'Sends text to AI for analysis' : 'Local keyword analysis (on device)'}
            </Text>
          </View>
          <Switch
            value={useAIAnalysis}
            onValueChange={handleAIToggle}
            trackColor={{ false: '#e0e0e0', true: '#6366f1' }}
            thumbColor="white"
          />
        </View>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => setShowPrivacyPolicy(true)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </ScrollView>

      {/* Privacy Policy Modal */}
      <Modal
        animationType="slide"
        visible={showPrivacyPolicy}
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivacyPolicy(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['top']}>
          <View style={styles.policyHeader}>
            <TouchableOpacity onPress={() => setShowPrivacyPolicy(false)}>
              <Text style={styles.policyClose}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.policyTitle}>Privacy Policy</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={styles.policyContent}>
            <Text style={styles.policyText}>{PRIVACY_POLICY}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
  },
  policyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  policyClose: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
    width: 50,
  },
  policyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  policyContent: {
    padding: 20,
  },
  policyText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
});
