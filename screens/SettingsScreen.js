import {
  StyleSheet, Text, View,
  TouchableOpacity, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../i18n';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  secondary: '#3d665a',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  surfaceContainer: '#f0eded',
  onSurface: '#1b1c1c',
  onSurfaceVariant: '#4f453e',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const SECTION_ICONS = {
  account:       { name: 'person-circle-outline',     color: C.primary },
  notifications: { name: 'notifications-outline',      color: C.secondary },
  privacy:       { name: 'shield-checkmark-outline',   color: C.secondary },
};

export default function SettingsScreen({ navigation, onLogout }) {
  const { t, i18n } = useTranslation();

  const currentLangLabel =
    SUPPORTED_LANGUAGES.find(l => l.code === i18n.language)?.label ?? 'English';

  const handleLanguageChange = () => {
    Alert.alert(
      'Language / 언어 / 言語 / 語言',
      undefined,
      [
        ...SUPPORTED_LANGUAGES.map(lang => ({
          text: lang.label,
          onPress: () => changeLanguage(lang.code),
        })),
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: () => {
          Alert.alert(t('settings.finalConfirmTitle'), t('settings.finalConfirmMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('category.deleteEverything'), style: 'destructive',
              onPress: async () => { await AsyncStorage.clear(); if (onLogout) onLogout(); },
            },
          ]);
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logoutTitle'), t('settings.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.onSurfaceVariant} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{t('settings.headerTitle')}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 계정 ── */}
        <SectionLabel icon="person-outline" color={C.primary} label={t('settings.accountSection')} />
        <View style={S.group}>
          <Row
            icon="person-outline" iconColor={C.primary}
            label={t('settings.profile')}
            sub={undefined}
            onPress={() => navigation.navigate('Profile')}
          />
          <Separator />
          <Row
            icon="globe-outline" iconColor={C.secondary}
            label="Language"
            sub={currentLangLabel}
            onPress={handleLanguageChange}
          />
        </View>

        {/* ── 알림 ── */}
        <SectionLabel icon="notifications-outline" color={C.secondary} label={t('settings.notificationsSection')} />
        <View style={S.group}>
          <Row
            icon="notifications-outline" iconColor={C.secondary}
            label={t('settings.reminders')}
            onPress={() => navigation.navigate('Reminders')}
          />
          <Separator />
          <Row
            icon="chatbubble-ellipses-outline" iconColor={C.secondary}
            label={t('settings.messages')}
            onPress={() => navigation.navigate('Messages')}
          />
        </View>

        {/* ── 개인정보 ── */}
        <SectionLabel icon="shield-checkmark-outline" color={C.outline} label={t('settings.privacySection')} />
        <View style={S.group}>
          <Row
            icon="lock-closed-outline" iconColor={C.outline}
            label={t('settings.dataPrivacy')}
            onPress={() => navigation.navigate('DataPrivacy')}
          />
          <Separator />
          <Row
            icon="trash-outline" iconColor={C.error}
            label={t('settings.deleteAllData')}
            danger
            onPress={handleDeleteAllData}
          />
          {onLogout && (
            <>
              <Separator />
              <Row
                icon="log-out-outline" iconColor={C.error}
                label={t('settings.logout')}
                danger
                onPress={handleLogout}
              />
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon, color, label }) {
  return (
    <View style={S.sectionLabel}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={S.sectionLabelText}>{label}</Text>
    </View>
  );
}

function Row({ icon, iconColor, label, sub, danger, onPress }) {
  return (
    <TouchableOpacity style={S.row} onPress={onPress} activeOpacity={0.65}>
      <View style={[S.iconWrap, { backgroundColor: danger ? C.errorContainer : C.surfaceContainer }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={S.rowCenter}>
        <Text style={[S.rowLabel, danger && { color: C.error }]}>{label}</Text>
        {sub && <Text style={S.rowSub}>{sub}</Text>}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={18} color={C.outlineVariant} />}
    </TouchableOpacity>
  );
}

function Separator() {
  return <View style={S.separator} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: C.onSurface,
    fontFamily: SERIF,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },

  // Section label
  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, marginLeft: 4, marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 11, fontWeight: '700', color: C.outline,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  // Group card
  group: {
    backgroundColor: C.surface,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  rowCenter: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: C.onSurface },
  rowSub: { fontSize: 12, color: C.outline, marginTop: 1 },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.outlineVariant,
    marginLeft: 64,
    opacity: 0.5,
  },
});
