import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../constants/appConfig';
import { useTheme } from '../context/ThemeContext';

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

import {
  loadCategories,
  saveCategories,
  createCategory,
  migrateIfNeeded,
} from '../utils/categories';

export default function CategoryListScreen({ navigation, route }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);

  const [categories, setCategories] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        await migrateIfNeeded();
        const [cats, saved] = await Promise.all([
          loadCategories(),
          AsyncStorage.getItem('diaries'),
        ]);
        setCategories(cats || []);
        setDiaries(saved ? JSON.parse(saved) : []);
      };
      load();
    }, [])
  );

  useEffect(() => {
    if (!route?.params?.openNewNote) return;
    if (categories.length > 0) {
      const first = categories[0];
      navigation.navigate('Notes', {
        categoryId: first.id,
        categoryName: first.name,
        openNewNote: route.params.openNewNote,
      });
    }
  }, [route?.params?.openNewNote]);

  const countForCategory = (id) => diaries.filter(d => d.categoryId === id).length;

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { Alert.alert('Notice', t('category.nameRequired')); return; }
    const { categories: updated } = await createCategory(name, newEmoji.trim() || '📁');
    setCategories(updated);
    setCreateModalVisible(false);
    setNewName(''); setNewEmoji('');
  };

  const handleLongPress = (item) => {
    Alert.alert(item.name, t('category.actionTitle'), [
      { text: t('category.actionEdit'), onPress: () => { setEditingCategory(item); setEditName(item.name); setEditEmoji(item.emoji); setEditModalVisible(true); } },
      { text: t('category.actionDelete'), style: 'destructive', onPress: () => { setDeletingCategory(item); setDeleteConfirmText(''); setDeleteModalVisible(true); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleEditSave = async () => {
    if (!editName.trim()) return;
    const updated = categories.map(c =>
      c.id === editingCategory.id ? { ...c, name: editName.trim(), emoji: editEmoji.trim() || c.emoji } : c
    );
    await saveCategories(updated);
    setCategories(updated);
    setEditModalVisible(false);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'delete') return;
    const allDiaries = diaries.filter(d => d.categoryId !== deletingCategory.id);
    await AsyncStorage.setItem('diaries', JSON.stringify(allDiaries));
    setDiaries(allDiaries);
    const updated = categories.filter(c => c.id !== deletingCategory.id);
    await saveCategories(updated);
    setCategories(updated);
    setDeleteModalVisible(false);
    setDeleteConfirmText('');
  };

  const renderCategory = ({ item }) => {
    const count = countForCategory(item.id);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Notes', { categoryId: item.id, categoryName: item.name })}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.cardAccent, { backgroundColor: item.color }]} />
        <View style={[styles.emojiWrap, { backgroundColor: item.color + '18' }]}>
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>{count} {count === 1 ? t('category.noteSingular') : t('category.notePlural')}</Text>
        </View>
        <View style={[styles.countBubble, { backgroundColor: item.color + '18' }]}>
          <Text style={[styles.countBubbleText, { color: item.color }]}>{count}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.separator} style={{ marginRight: 14 }} />
      </TouchableOpacity>
    );
  };

  const NewCard = () => (
    <TouchableOpacity style={styles.newCard} onPress={() => setCreateModalVisible(true)} activeOpacity={0.75}>
      <View style={[styles.cardAccent, { backgroundColor: '#6366f1' }]} />
      <View style={[styles.emojiWrap, { backgroundColor: theme.border }]}>
        <Ionicons name="add" size={22} color={theme.accent} />
      </View>
      <View style={styles.cardMeta}>
        <Text style={[styles.cardName, { color: theme.accent }]}>{t('category.newCategory')}</Text>
        <Text style={[styles.cardSub, { color: theme.secondaryText }]}>{t('category.tapToCreate')}</Text>
      </View>
      <View style={styles.newBadge}>
        <Text style={styles.newBadgeText}>{t('category.newBadge')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.separator} style={{ marginRight: 14 }} />
    </TouchableOpacity>
  );

  const ListHeader = () => (
    <>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={theme.tertiaryText} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('category.searchPlaceholder')}
          placeholderTextColor={theme.placeholderText}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={theme.separator} />
          </TouchableOpacity>
        )}
      </View>
      <NewCard />
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{APP_NAME}</Text>
            <Text style={styles.subTitle}>
              {categories.length} {categories.length === 1 ? t('category.categorySingular') : t('category.categoryPlural')}
            </Text>
          </View>

          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="options-outline" size={24} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        data={filteredCategories}
        renderItem={renderCategory}
        keyExtractor={item => item.id}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          searchQuery ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('category.noResults')}</Text>
            </View>
          ) : null
        }
      />

      <SafeAreaView edges={['bottom']} style={styles.trendBarWrap}>
        <TouchableOpacity style={styles.trendPill} onPress={() => navigation.navigate('Insights')} activeOpacity={0.85}>
          <Text style={styles.trendPillText}>{t('category.viewInsights')}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Create Modal */}
      <Modal visible={createModalVisible} transparent animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCreateModalVisible(false)}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <Text style={styles.modalTitle}>{t('category.createTitle')}</Text>
            <TextInput style={styles.modalInput} placeholder={t('category.emojiPlaceholder')} placeholderTextColor={theme.placeholderText} value={newEmoji} onChangeText={setNewEmoji} maxLength={4} />
            <TextInput style={styles.modalInput} placeholder={t('category.namePlaceholder')} placeholderTextColor={theme.placeholderText} value={newName} onChangeText={setNewName} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreateModalVisible(false); setNewName(''); setNewEmoji(''); }}>
                <Text style={styles.cancelBtnTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, !newName.trim() && styles.dimBtn]} onPress={handleCreate} disabled={!newName.trim()}>
                <Text style={styles.confirmBtnTxt}>{t('category.createButton')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setEditModalVisible(false)}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <Text style={styles.modalTitle}>{t('category.editTitle')}</Text>
            <TextInput style={styles.modalInput} placeholder="Emoji" placeholderTextColor={theme.placeholderText} value={editEmoji} onChangeText={setEditEmoji} maxLength={4} />
            <TextInput style={styles.modalInput} placeholder={t('category.namePlaceholder')} placeholderTextColor={theme.placeholderText} value={editName} onChangeText={setEditName} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, !editName.trim() && styles.dimBtn]} onPress={handleEditSave} disabled={!editName.trim()}>
                <Text style={styles.confirmBtnTxt}>{t('category.saveButton')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDeleteModalVisible(false)}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <Text style={styles.modalTitle}>{t('category.deleteTitle')}</Text>
            <Text style={styles.deleteWarn}>
              {t('category.deleteWarning').split('\n')[0]}{'\n'}
              <Text style={{ fontWeight: '700', color: theme.danger }}>'delete'</Text>{' '}
              {t('category.deleteWarning').split('\n')[1]?.replace("Type 'delete' below to confirm.", '') || ''}
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: deleteConfirmText === 'delete' ? theme.danger : theme.border }]}
              placeholder="delete"
              placeholderTextColor={theme.placeholderText}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="none"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setDeleteModalVisible(false); setDeleteConfirmText(''); }}>
                <Text style={styles.cancelBtnTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: theme.danger }, deleteConfirmText !== 'delete' && styles.dimBtn]}
                onPress={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'delete'}
              >
                <Text style={styles.confirmBtnTxt}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  headerWrap: { backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    color: theme.primaryText,
  },
  subTitle: { fontSize: 13, color: theme.secondaryText, marginTop: 2, fontWeight: '500' },
  iconBtn: { padding: 8 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 12,
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.primaryText, fontWeight: '500' },

  listContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 110 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    height: 72,
  },
  cardAccent: { width: 4, alignSelf: 'stretch' },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 12,
  },
  cardEmoji: { fontSize: 22 },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: theme.primaryText },
  cardSub: { fontSize: 12, color: theme.secondaryText, marginTop: 2, fontWeight: '400' },
  countBubble: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  countBubbleText: { fontSize: 14, fontWeight: '800' },

  newCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    height: 72,
  },
  newBadge: {
    backgroundColor: theme.accent,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 8,
  },
  newBadgeText: { fontSize: 11, color: theme.card, fontWeight: '800', letterSpacing: 0.5 },

  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontSize: 15, color: theme.tertiaryText },

  trendBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 14,
    backgroundColor: 'transparent',
  },
  trendPill: {
    backgroundColor: theme.cta,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  trendPillText: { color: theme.ctaText, fontSize: 15, fontWeight: '700' },

  overlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: theme.modalBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.primaryText, marginBottom: 18 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.primaryText,
    marginBottom: 12,
    backgroundColor: theme.background,
  },
  deleteWarn: { fontSize: 13, color: theme.secondaryText, lineHeight: 20, marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center',
  },
  cancelBtnTxt: { fontSize: 15, color: theme.secondaryText, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  confirmBtnTxt: { fontSize: 15, color: theme.card, fontWeight: '700' },
  dimBtn: { opacity: 0.35 },
});
