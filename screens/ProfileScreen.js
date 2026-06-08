import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Alert, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getToken } from '../services/auth';
import { getMe } from '../services/auth';
import { useCatName } from '../context/CatNameContext';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  secondary: '#3d665a',
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

export default function ProfileScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { catName, setCatName } = useCatName();

  const [userEmail, setUserEmail] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [editingCatName, setEditingCatName] = useState(false);
  const [catNameDraft, setCatNameDraft] = useState('');

  useFocusEffect(useCallback(() => {
    loadUser();
  }, []));

  const loadUser = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const user = await getMe(token);
      setUserEmail(user.email || user.username || '');
      if (user.created_at) {
        const lang = i18n.language.split('-')[0];
        const d = new Date(user.created_at);
        setJoinDate(d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-TW' : 'en-US'));
      }
    } catch {
      // offline — leave blank
    }
  };

  const handleEditCatName = () => {
    setCatNameDraft(catName);
    setEditingCatName(true);
  };

  const handleSaveCatName = async () => {
    const name = catNameDraft.trim();
    if (!name) return;
    await setCatName(name);
    setEditingCatName(false);
  };

  const handleCancelCatName = () => {
    setEditingCatName(false);
  };

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.onSurfaceVariant} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>{t('profile.headerTitle')}</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={S.content}>
        {/* Account Info */}
        <SectionLabel label={t('profile.accountSection')} />
        <View style={S.group}>
          <InfoRow label={t('profile.userId')} value={userEmail || '—'} />
          {joinDate ? (
            <>
              <Separator />
              <InfoRow label={t('profile.joinDate')} value={joinDate} />
            </>
          ) : null}
        </View>

        {/* Cat */}
        <SectionLabel label={t('profile.catSection')} />
        <View style={S.group}>
          {editingCatName ? (
            <View style={S.editRow}>
              <Text style={S.rowLabel}>{t('profile.catName')}</Text>
              <View style={S.editRight}>
                <TextInput
                  style={S.catInput}
                  value={catNameDraft}
                  onChangeText={setCatNameDraft}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveCatName}
                  selectionColor={C.primary}
                />
                <TouchableOpacity onPress={handleSaveCatName} hitSlop={8}>
                  <Ionicons name="checkmark" size={20} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancelCatName} hitSlop={8}>
                  <Ionicons name="close" size={20} color={C.outline} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={S.row} onPress={handleEditCatName} activeOpacity={0.65}>
              <Text style={S.rowLabel}>{t('profile.catName')}</Text>
              <View style={S.rowRight}>
                <Text style={S.rowValue}>{catName}</Text>
                <Ionicons name="chevron-forward" size={18} color={C.outlineVariant} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function SectionLabel({ label }) {
  return (
    <View style={S.sectionLabel}>
      <Text style={S.sectionLabelText}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={S.row}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowValue}>{value}</Text>
    </View>
  );
}

function Separator() {
  return <View style={S.separator} />;
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(211,196,187,0.6)',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: C.onSurface, fontFamily: SERIF,
  },

  content: { paddingHorizontal: 20, paddingTop: 24 },

  sectionLabel: { marginBottom: 8, marginLeft: 4, marginTop: 4 },
  sectionLabelText: {
    fontSize: 11, fontWeight: '700', color: C.outline,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  group: {
    backgroundColor: C.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  rowLabel: { fontSize: 15, fontWeight: '500', color: C.onSurface },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { fontSize: 15, color: C.outline },

  separator: {
    height: StyleSheet.hairlineWidth, backgroundColor: C.outlineVariant,
    marginLeft: 16, opacity: 0.5,
  },

  editRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  editRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catInput: {
    fontSize: 15, color: C.onSurface,
    borderBottomWidth: 1.5, borderBottomColor: C.primary,
    paddingVertical: 2, minWidth: 80, textAlign: 'right',
  },
});
