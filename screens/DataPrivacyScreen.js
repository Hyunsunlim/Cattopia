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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PRIVACY_POLICY } from '../constants/privacyPolicy';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainer: '#f0eded',
  onSurface: '#1b1c1c',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export default function DataPrivacyScreen({ navigation }) {
  const { t } = useTranslation();
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
      value ? t('privacy.aiEnabledAlertTitle') : t('privacy.aiDisabledAlertTitle'),
      value ? t('privacy.aiEnabledAlertMsg') : t('privacy.aiDisabledAlertMsg')
    );
  };

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.outline} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{t('privacy.screenTitle')}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        <View style={S.card}>
          <View style={S.row}>
            <View style={S.info}>
              <Text style={S.title}>{t('privacy.aiAnalysisTitle')}</Text>
              <Text style={S.desc}>
                {useAIAnalysis ? t('privacy.aiEnabledDesc') : t('privacy.aiDisabledDesc')}
              </Text>
            </View>
            <Switch
              value={useAIAnalysis}
              onValueChange={handleAIToggle}
              trackColor={{ false: C.surfaceContainer, true: C.primaryContainer }}
              thumbColor={useAIAnalysis ? C.primary : C.outline}
            />
          </View>
        </View>

        <TouchableOpacity style={S.card} onPress={() => setShowPrivacyPolicy(true)} activeOpacity={0.7}>
          <View style={S.row}>
            <Text style={S.title}>{t('privacy.policyLink')}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.outlineVariant} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        animationType="slide"
        visible={showPrivacyPolicy}
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivacyPolicy(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={['top']}>
          <View style={S.policyHeader}>
            <TouchableOpacity onPress={() => setShowPrivacyPolicy(false)}>
              <Text style={S.policyClose}>{t('privacy.policyClose')}</Text>
            </TouchableOpacity>
            <Text style={S.policyTitle}>{t('privacy.policyTitle')}</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={S.policyContent}>
            <Text style={S.policyText}>{PRIVACY_POLICY}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.onSurface, fontFamily: SERIF },

  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 16 },

  card: {
    backgroundColor: C.surface, borderRadius: 16, padding: 16,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1, marginRight: 12 },
  title: { fontSize: 15, fontWeight: '600', color: C.onSurface, marginBottom: 3 },
  desc: { fontSize: 13, color: C.outline },

  policyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.outlineVariant,
  },
  policyClose: { fontSize: 15, color: C.primary, fontWeight: '600', width: 50 },
  policyTitle: { fontSize: 17, fontWeight: '700', color: C.onSurface, fontFamily: SERIF },
  policyContent: { padding: 20 },
  policyText: { fontSize: 15, color: C.onSurface, lineHeight: 24 },
});
