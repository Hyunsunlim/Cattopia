import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

import DateTimePicker from '@react-native-community/datetimepicker';
import { analyzeEmotion, analyzeEmotionWithFallback, emotionToEmoji, emotionToColor } from '../utils/emotionAnalysis';
import { authFetch } from '../services/auth';

function CustomTabBar({ navigation, onPressNew, insets, theme, t }) {
  const tabBarHeight = Platform.OS === 'android' ? 60 + insets.bottom : 88;
  return (
    <View style={[
      customTabStyles.container,
      {
        height: tabBarHeight,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 0,
        backgroundColor: theme.card,
      },
    ]}>
      <TouchableOpacity
        style={customTabStyles.tab}
        activeOpacity={1}
      >
        <Ionicons name="book-outline" size={24} color={theme.accent} />
        <Text style={[customTabStyles.label, { color: theme.accent }]}>{t('home.noteTab')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={customTabStyles.centerOuter}
        onPress={onPressNew}
        activeOpacity={0.8}
      >
        <View style={[customTabStyles.centerInner, { backgroundColor: theme.cta }]}>
          <Ionicons name="add" size={32} color={theme.ctaText} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={customTabStyles.tab}
        onPress={() => navigation.navigate('InsightDetail')}
        activeOpacity={0.7}
      >
        <Ionicons name="bar-chart-outline" size={24} color={theme.inactiveTab} />
        <Text style={[customTabStyles.label, { color: theme.inactiveTab }]}>{t('home.insightsTab')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen({ navigation, route }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);

  const categoryId = route?.params?.categoryId || null;
  const categoryName = route?.params?.categoryName || 'Notes';
  const [diaries, setDiaries] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDiary, setCurrentDiary] = useState(null);
  const [writingFeedback, setWritingFeedback] = useState(null);
  const [feedbackDraft, setFeedbackDraft] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackEmotionFailed, setFeedbackEmotionFailed] = useState(false);
  const [feedbackStructureFailed, setFeedbackStructureFailed] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [memoToastVisible, setMemoToastVisible] = useState(false);
  const memoToastAnim = useRef(new Animated.Value(0)).current;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nudgeDiaryRef, setNudgeDiaryRef] = useState(null);

  // Note modal — tag picker
  const [noteTag, setNoteTag] = useState('');
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [noteExistingTags, setNoteExistingTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Search & Filter states
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('keyword');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState(null);   // Date | null
  const [endDateFilter, setEndDateFilter] = useState(null);       // Date | null
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'android' ? 60 + insets.bottom : 88;

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Animation refs
  const panelHeight = useRef(new Animated.Value(0)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;
  const contentInputRef = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDiaries();
    }, [categoryId])
  );

  // Listen for center tab button press to open new note modal
  useEffect(() => {
    if (route?.params?.openNewNote) {
      openNewModal();
    }
  }, [route?.params?.openNewNote]);

  // Handle notification tap → open edit modal for specific diary
  useEffect(() => {
    if (!route?.params?.openEditNote) return;
    const diaryId = route.params.openEditNote;
    AsyncStorage.getItem('diaries').then(saved => {
      if (!saved) return;
      const allDiaries = JSON.parse(saved);
      const diary = allDiaries.find(d => d.id === diaryId);
      if (diary) {
        setDiaries(allDiaries);
        openEditModal(diary);
      }
    });
  }, [route?.params?.openEditNote]);


  const loadDiaries = async () => {
    try {
      const savedDiaries = await AsyncStorage.getItem('diaries');
      if (savedDiaries !== null) {
        const all = JSON.parse(savedDiaries);
        const filtered = categoryId
          ? all.filter(d => d.categoryId === categoryId)
          : all;
        setDiaries(filtered);
      }
    } catch (error) {
      console.error('Failed to load diaries:', error);
    }
  };

  const saveDiaries = async (updatedCategoryDiaries) => {
    try {
      // Merge with diaries from other categories so we don't overwrite them
      const savedRaw = await AsyncStorage.getItem('diaries');
      const allDiaries = savedRaw ? JSON.parse(savedRaw) : [];
      const otherDiaries = categoryId
        ? allDiaries.filter(d => d.categoryId !== categoryId)
        : [];
      const merged = [...updatedCategoryDiaries, ...otherDiaries];
      await AsyncStorage.setItem('diaries', JSON.stringify(merged));
    } catch (error) {
      console.error('Failed to save diaries:', error);
    }
  };

  const emotions = [
    { key: 'joy', emoji: '😊', label: 'Joy' },
    { key: 'sadness', emoji: '😢', label: 'Sadness' },
    { key: 'anger', emoji: '😠', label: 'Anger' },
    { key: 'fear', emoji: '😨', label: 'Fear' },
    { key: 'surprise', emoji: '😮', label: 'Surprise' },
    { key: 'disgust', emoji: '🤢', label: 'Disgust' },
    { key: 'neutral', emoji: '😐', label: 'Neutral' },
    { key: 'uncertain', emoji: '🤔', label: 'Uncertain' },
  ];

  const toggleFilterPanel = () => {
    if (showFilterPanel) {
      Animated.timing(panelHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => setShowFilterPanel(false));
    } else {
      setShowFilterPanel(true);
      Animated.timing(panelHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    Animated.timing(tabOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const toggleEmotion = (emotionKey) => {
    setSelectedEmotions(prev =>
      prev.includes(emotionKey)
        ? prev.filter(e => e !== emotionKey)
        : [...prev, emotionKey]
    );
  };

  // Unique tags extracted from loaded diaries
  const availableTags = [...new Set(diaries.map(d => d.tag).filter(Boolean))];

  // Filter diaries
  const filteredDiaries = diaries.filter(diary => {
    const matchesSearch = searchQuery === '' ||
      diary.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      diary.content.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (startDateFilter || endDateFilter) {
      const diaryDate = new Date(diary.timestamp);
      if (startDateFilter) {
        const start = new Date(startDateFilter);
        start.setHours(0, 0, 0, 0);
        if (diaryDate < start) matchesDate = false;
      }
      if (endDateFilter) {
        const end = new Date(endDateFilter);
        end.setHours(23, 59, 59, 999);
        if (diaryDate > end) matchesDate = false;
      }
    }

    const matchesEmotion = selectedEmotions.length === 0 ||
      selectedEmotions.includes(diary.emotion);

    const matchesTag = selectedTags.length === 0 ||
      selectedTags.includes(diary.tag);

    return matchesSearch && matchesDate && matchesEmotion && matchesTag;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStartDateFilter(null);
    setEndDateFilter(null);
    setSelectedEmotions([]);
    setSelectedTags([]);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    startDateFilter !== null ||
    endDateFilter !== null ||
    selectedEmotions.length > 0 ||
    selectedTags.length > 0;

  const formatFilterDate = (date) =>
    date
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

  const toggleTag = (tag) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );

  const resetNoteModal = () => {
    setTitle('');
    setContent('');
    setNoteTag('');
    setNewTagInput('');
    setTagPickerOpen(false);
    setCurrentDiary(null);
    setModalVisible(false);
  };

  const closeFeedbackModal = useCallback(() => {
    setFeedbackModalVisible(false);
    setFeedbackDraft(null);
    setWritingFeedback(null);
    setFeedbackLoading(false);
    setFeedbackEmotionFailed(false);
    setFeedbackStructureFailed(false);
    setNudgeDiaryRef(null);
  }, []);

  const showMemoToast = useCallback(() => {
    setMemoToastVisible(true);
    memoToastAnim.setValue(0);
    Animated.timing(memoToastAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(memoToastAnim, { toValue: 0, duration: 300, useNativeDriver: true })
        .start(() => setMemoToastVisible(false));
    }, 2800);
  }, [memoToastAnim]);

  const retryAnalysis = useCallback(async () => {
    if (!feedbackDraft) return;
    setFeedbackEmotionFailed(false);
    setFeedbackStructureFailed(false);
    setWritingFeedback(null);
    setFeedbackLoading(true);
    let emotion = feedbackDraft.emotion, emoji = feedbackDraft.emoji, emotionFailed = false;
    try {
      const result = await analyzeEmotionWithFallback(feedbackDraft.content);
      emotion = result.emotion; emotionFailed = result.failed;
      emoji = emotionToEmoji(emotion);
      setFeedbackDraft(prev => ({ ...prev, emotion, emoji }));
    } catch { emotionFailed = true; }
    setFeedbackEmotionFailed(emotionFailed);
    let structureFailed = false;
    try {
      const res = await authFetch('https://lucidnote-api-production-cbe8.up.railway.app/analyze-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: feedbackDraft.content }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.is_diary) {
          if (nudgeDiaryRef && (data.structure || data.structure_score != null)) {
            setDiaries(prev => {
              const updated = prev.map(d =>
                d.id === nudgeDiaryRef.id
                  ? { ...d, structure: data.structure, structure_score: data.structure_score, thinking_type: data.thinking_type ?? d.thinking_type, language_lens: data.language_lens ?? d.language_lens }
                  : d
              );
              saveDiaries(updated);
              return updated;
            });
          }
          setWritingFeedback({ ...data, emotion, emoji });
        }
      } else { structureFailed = true; }
    } catch { structureFailed = true; }
    setFeedbackStructureFailed(structureFailed);
    setFeedbackLoading(false);
  }, [feedbackDraft]);

  const handleContinueWriting = useCallback(() => {
    const diary = nudgeDiaryRef;
    closeFeedbackModal();
    if (diary) {
      setTimeout(() => openEditModal(diary), 350);
    }
  }, [nudgeDiaryRef, closeFeedbackModal]);

  const addDiary = async () => {
    if (content.trim() === '') {
      Alert.alert('Write something', 'Please enter some content before saving.');
      return;
    }
    const savedContent = content;
    const savedTitle = title.trim() || t('home.untitled');
    setIsAnalyzing(true);

    // 1. Emotion analysis (with fallback — never throws)
    let emotion = 'neutral', emoji = '😐', emotionFailed = false;
    try {
      const result = await analyzeEmotionWithFallback(savedContent);
      emotion = result.emotion;
      emotionFailed = result.failed;
      emoji = emotionToEmoji(emotion);
    } catch { emotionFailed = true; }

    // 2. Save diary
    const today = new Date();
    const newDiary = {
      id: Date.now().toString(),
      title: savedTitle,
      content: savedContent,
      date: today.toLocaleDateString('en-US'),
      timestamp: today.toISOString(),
      emotion,
      emoji,
      tag: noteTag || null,
      categoryId,
    };
    const newDiaries = [newDiary, ...diaries];
    setDiaries(newDiaries);
    saveDiaries(newDiaries);
    // 3. Close note modal — isAnalyzing stays true (shows analyzing toast on main screen)
    const dateStr = today.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    setFeedbackDraft({ title: savedTitle, content: savedContent, emotion, emoji, dateStr });
    setFeedbackEmotionFailed(emotionFailed);
    setFeedbackStructureFailed(false);
    setWritingFeedback(null);
    resetNoteModal();

    // 4. Structure API call — show modal ONLY after response
    let structureFailed = false;
    try {
      const res = await authFetch(
        'https://lucidnote-api-production-cbe8.up.railway.app/analyze-note',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: savedContent }) }
      );
      if (res.ok) {
        const data = await res.json();
        setIsAnalyzing(false);
        if (!data.is_diary) {
          showMemoToast();
          return;
        }
        // Persist structure data back to the saved diary
        if (data.structure || data.structure_score != null) {
          const updatedDiaries = newDiaries.map(d =>
            d.id === newDiary.id
              ? { ...d, structure: data.structure, structure_score: data.structure_score, thinking_type: data.thinking_type ?? d.thinking_type, language_lens: data.language_lens ?? d.language_lens }
              : d
          );
          setDiaries(updatedDiaries);
          saveDiaries(updatedDiaries);
        }
        setNudgeDiaryRef(newDiary);
        setWritingFeedback({ ...data, emotion, emoji });
        setFeedbackModalVisible(true);
        return;
      } else {
        const errBody = await res.text().catch(() => '');
        console.warn('[analyze-note] HTTP', res.status, errBody);
        structureFailed = true;
      }
    } catch (e) {
      console.warn('[analyze-note] fetch error:', e?.message);
      structureFailed = true;
    }
    setIsAnalyzing(false);
    setNudgeDiaryRef(newDiary);
    setFeedbackStructureFailed(structureFailed);
    setFeedbackModalVisible(true);
  };

  const updateDiary = async () => {
    if (content.trim() === '') {
      Alert.alert('Write something', 'Please enter some content before saving.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const emotion = await analyzeEmotion(content);
      const emoji = emotionToEmoji(emotion);
      const savedTitle = title.trim() || t('home.untitled');
      const updatedDiaries = diaries.map(d =>
        d.id === currentDiary.id
          ? { ...d, title: savedTitle, content, emotion, emoji, tag: noteTag || null }
          : d
      );
      setDiaries(updatedDiaries);
      saveDiaries(updatedDiaries);
      setIsAnalyzing(false);
      resetNoteModal();
      Alert.alert('Updated!', `Detected emotion: ${emotion} ${emoji}`);
    } catch {
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to analyze emotion, but note updated!');
    }
  };

  const deleteDiary = (id) => {
    Alert.alert(
      'Delete Confirmation',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newDiaries = diaries.filter(diary => diary.id !== id);
            setDiaries(newDiaries);
            saveDiaries(newDiaries);
            closeModal();
            Alert.alert('Deleted', 'Note has been deleted 🗑️');
          },
        },
      ]
    );
  };

  const loadNoteExistingTags = async () => {
    try {
      const saved = await AsyncStorage.getItem('diaries');
      if (!saved) return [];
      const all = JSON.parse(saved);
      return [...new Set(all.map(d => d.tag).filter(Boolean))];
    } catch { return []; }
  };

  const openEditModal = async (diary) => {
    const tags = await loadNoteExistingTags();
    setNoteExistingTags(tags);
    setCurrentDiary(diary);
    setTitle(diary.title);
    setContent(diary.content);
    setNoteTag(diary.tag || '');
    setNewTagInput('');
    setTagPickerOpen(false);
    setModalVisible(true);
  };

  const openNewModal = async () => {
    const tags = await loadNoteExistingTags();
    setNoteExistingTags(tags);
    setCurrentDiary(null);
    setTitle('');
    setContent('');
    setNoteTag('');
    setNewTagInput('');
    setTagPickerOpen(false);
    setModalVisible(true);
  };

  const closeModal = () => resetNoteModal();

  const formatCardDate = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderDiaryItem = ({ item }) => {
    const borderColor = emotionToColor(item.emotion);
    return (
      <TouchableOpacity
        style={[styles.diaryItem, { borderLeftColor: borderColor }]}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        {/* Top row: date | emoji + emotion */}
        <View style={styles.diaryHeader}>
          <Text style={styles.diaryDate}>{formatCardDate(item.timestamp)}</Text>
          <View style={styles.emotionContainer}>
            <Text style={styles.emotionEmoji}>{item.emoji}</Text>
            <Text style={styles.emotionText}>{item.emotion}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.diaryTitle} numberOfLines={1}>{item.title}</Text>

        {/* Preview */}
        <Text style={styles.diaryContent} numberOfLines={2}>{item.content}</Text>

        {/* Tag pill — below content */}
        {item.tag ? (
          <View style={styles.tagPillWrap}>
            <View style={styles.tagPill}>
              <Text style={styles.tagPillText}>{item.tag.toUpperCase()}</Text>
            </View>
          </View>
        ) : null}

        {/* O/T/I structure strip — only when structure data exists */}
        {item.structure && (
          <View style={styles.structureStrip}>
            {[
              { icon: '👁', key: 'observation' },
              { icon: '💭', key: 'thought' },
              { icon: '✨', key: 'insight' },
            ].map(({ icon, key }) => (
              <Text key={key} style={{ fontSize: 14, opacity: item.structure[key] ? 1 : 0.2 }}>
                {icon}
              </Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.card }}>
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={theme.primaryText} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, { fontSize: 22 }]}>{categoryName}</Text>
              <Text style={styles.diaryCountText}>{diaries.length} notes</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {diaries.length > 0 && (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={toggleFilterPanel}
              >
                <Ionicons
                  name={showFilterPanel ? "filter" : "filter-outline"}
                  size={22}
                  color={hasActiveFilters ? theme.accent : theme.secondaryText}
                />
                {hasActiveFilters && <View style={styles.filterBadge} />}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="options-outline" size={24} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Filter Panel */}
      {showFilterPanel && diaries.length > 0 && (
        <Animated.View style={[
          styles.filterPanel,
          {
            maxHeight: panelHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 380],
            }),
            opacity: panelHeight,
          },
        ]}>
          {/* Tabs */}
          <View style={styles.filterTabs}>
            {[
              { key: 'keyword', icon: 'search-outline', label: 'Keyword' },
              { key: 'date', icon: 'calendar-outline', label: 'Date' },
              { key: 'emotion', icon: 'happy-outline', label: 'Emotion' },
              { key: 'tag', icon: 'pricetag-outline', label: 'Tag' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, activeTab === tab.key && styles.filterTabActive]}
                onPress={() => switchTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.key ? theme.accent : theme.secondaryText}
                />
                <Text style={[
                  styles.filterTabText,
                  activeTab === tab.key && styles.filterTabTextActive,
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <Animated.View style={[styles.filterTabContent, { opacity: tabOpacity }]}>
            {activeTab === 'keyword' && (
              <View style={styles.searchInputContainer}>
                <Ionicons name="search-outline" size={20} color={theme.secondaryText} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('insight.searchPlaceholder')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={theme.secondaryText}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {activeTab === 'date' && (
              <View style={styles.dateInputRow}>
                {/* From */}
                <TouchableOpacity
                  style={styles.dateTouchable}
                  onPress={() => { setShowEndPicker(false); setShowStartPicker(true); }}
                >
                  <Ionicons name="calendar-outline" size={15} color={theme.secondaryText} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateLabel}>{t('home.from')}</Text>
                    <Text style={[styles.dateValue, !startDateFilter && styles.datePlaceholder]}>
                      {formatFilterDate(startDateFilter) ?? 'Any date'}
                    </Text>
                  </View>
                  {startDateFilter && (
                    <TouchableOpacity onPress={() => setStartDateFilter(null)} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={theme.tertiaryText} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                <Text style={styles.dateSeparator}>→</Text>

                {/* To */}
                <TouchableOpacity
                  style={styles.dateTouchable}
                  onPress={() => { setShowStartPicker(false); setShowEndPicker(true); }}
                >
                  <Ionicons name="calendar-outline" size={15} color={theme.secondaryText} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateLabel}>{t('home.to')}</Text>
                    <Text style={[styles.dateValue, !endDateFilter && styles.datePlaceholder]}>
                      {formatFilterDate(endDateFilter) ?? 'Any date'}
                    </Text>
                  </View>
                  {endDateFilter && (
                    <TouchableOpacity onPress={() => setEndDateFilter(null)} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={theme.tertiaryText} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'emotion' && (
              <View style={styles.emotionFilterGrid}>
                {emotions.map((emotion) => (
                  <TouchableOpacity
                    key={emotion.key}
                    style={[
                      styles.emotionChip,
                      selectedEmotions.includes(emotion.key) && {
                        backgroundColor: emotionToColor(emotion.key) + '20',
                        borderColor: emotionToColor(emotion.key),
                      },
                    ]}
                    onPress={() => toggleEmotion(emotion.key)}
                  >
                    <Text style={styles.emotionChipEmoji}>{emotion.emoji}</Text>
                    <Text style={[
                      styles.emotionChipLabel,
                      selectedEmotions.includes(emotion.key) && {
                        color: emotionToColor(emotion.key),
                        fontWeight: '600',
                      },
                    ]}>
                      {emotion.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeTab === 'tag' && (
              availableTags.length === 0 ? (
                <Text style={styles.tagFilterEmpty}>{t('home.noTagsYet')}</Text>
              ) : (
                <View style={styles.tagFilterGrid}>
                  {availableTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.tagFilterChip,
                        selectedTags.includes(tag) && styles.tagFilterChipActive,
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[
                        styles.tagFilterChipText,
                        selectedTags.includes(tag) && styles.tagFilterChipTextActive,
                      ]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}
          </Animated.View>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFilterButton} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color={theme.danger} />
              <Text style={styles.clearFilterText}>{t('home.clearAllFilters')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {diaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('home.noNotesYet')}</Text>
          <Text style={styles.emptySubText}>{t('home.tapToCreate')}</Text>
          <Text style={styles.emptySubText}>{t('home.aiAnalyzeHint')}</Text>
        </View>
      ) : filteredDiaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('home.noResults')}</Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFilterLink}>{t('home.clearFilters')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredDiaries}
          renderItem={renderDiaryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: tabBarHeight + 4 }]}
        />
      )}



      <CustomTabBar navigation={navigation} onPressNew={openNewModal} insets={insets} theme={theme} t={t} />

      {/* ── Date pickers (Android: inline dialog, iOS: sheet modal) ── */}
      {(showStartPicker || showEndPicker) && Platform.OS === 'android' && (
        <DateTimePicker
          mode="date"
          display="calendar"
          value={showStartPicker ? (startDateFilter ?? new Date()) : (endDateFilter ?? new Date())}
          maximumDate={showStartPicker ? (endDateFilter ?? undefined) : undefined}
          minimumDate={showEndPicker ? (startDateFilter ?? undefined) : undefined}
          onChange={(event, date) => {
            if (showStartPicker) {
              setShowStartPicker(false);
              if (event.type === 'set' && date) setStartDateFilter(date);
            } else {
              setShowEndPicker(false);
              if (event.type === 'set' && date) setEndDateFilter(date);
            }
          }}
        />
      )}

      <Modal
        transparent
        animationType="fade"
        visible={(showStartPicker || showEndPicker) && Platform.OS === 'ios'}
        onRequestClose={() => { setShowStartPicker(false); setShowEndPicker(false); }}
      >
        <TouchableOpacity
          style={styles.datePickerOverlay}
          activeOpacity={1}
          onPress={() => { setShowStartPicker(false); setShowEndPicker(false); }}
        >
          <TouchableOpacity style={styles.datePickerCard} activeOpacity={1}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>
                {showStartPicker ? t('home.from') : t('home.to')}
              </Text>
              <TouchableOpacity
                onPress={() => { setShowStartPicker(false); setShowEndPicker(false); }}
              >
                <Text style={styles.datePickerDone}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="date"
              display="inline"
              themeVariant="light"
              textColor={theme.primaryText}
              value={showStartPicker ? (startDateFilter ?? new Date()) : (endDateFilter ?? new Date())}
              maximumDate={showStartPicker ? (endDateFilter ?? undefined) : undefined}
              minimumDate={showEndPicker ? (startDateFilter ?? undefined) : undefined}
              onChange={(_, date) => {
                if (!date) return;
                if (showStartPicker) setStartDateFilter(date);
                else setEndDateFilter(date);
              }}
              style={{ alignSelf: 'center' }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

<Modal
  animationType="slide"
  visible={modalVisible}
  presentationStyle="pageSheet"
  onRequestClose={closeModal}
  statusBarTranslucent={Platform.OS === 'android'}
>
  <KeyboardAvoidingView
    style={styles.noteModalRoot}
    behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    keyboardVerticalOffset={insets.top - 20}
  >
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.card }} />

    {/* ── Top bar ── */}
    {(() => {
      const d = new Date();
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      const rest = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      return (
        <View style={styles.noteModalTopBar}>
          <TouchableOpacity style={styles.noteModalIconBtn} onPress={closeModal} disabled={isAnalyzing} hitSlop={8}>
            <Ionicons name="close" size={22} color={isAnalyzing ? theme.tertiaryText : theme.primaryText} />
          </TouchableOpacity>
          <View style={styles.noteModalCenter}>
            <Text style={styles.noteModalLabel}>{currentDiary ? 'EDIT ENTRY' : 'NEW ENTRY'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.noteModalDateDay}>{day}, </Text>
              <Text style={styles.noteModalDateRest}>{rest}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.noteModalIconBtn}
            onPress={currentDiary ? updateDiary : addDiary}
            disabled={isAnalyzing}
            hitSlop={8}
          >
            {isAnalyzing
              ? <ActivityIndicator size="small" color={theme.primaryText} />
              : <Ionicons name="arrow-up-circle" size={28} color={theme.primaryText} />
            }
          </TouchableOpacity>
        </View>
      );
    })()}

    {isAnalyzing && (
      <View style={styles.analyzingBanner}>
        <ActivityIndicator color={theme.ctaText} size="small" />
        <Text style={styles.analyzingText}>{t('home.analyzingEmotions')}</Text>
      </View>
    )}

    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.noteModalScroll}
    >
      {/* Title */}
      <View style={styles.noteModalTitleRow}>
        <TextInput
          style={[styles.noteModalTitleInput, { flex: 1 }]}
          placeholder={t('home.titlePlaceholder')}
          placeholderTextColor={theme.placeholderText}
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, 60))}
          maxLength={60}
          editable={!isAnalyzing}
          returnKeyType="next"
          onSubmitEditing={() => contentInputRef.current?.focus()}
        />
        {title.length > 0 && (
          <Text style={styles.noteModalCharCounter}>{title.length}/60</Text>
        )}
      </View>

      {/* Tag row */}
      <View style={styles.noteModalTagRow}>
        {noteTag ? (
          <View style={styles.noteModalTagChip}>
            <Text style={styles.noteModalTagChipText}># {noteTag}</Text>
            <TouchableOpacity onPress={() => setNoteTag('')} hitSlop={6}>
              <Ionicons name="close-circle" size={15} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.noteModalAddTagBtn}
            onPress={() => { setNewTagInput(''); setTagPickerOpen(v => !v); }}
          >
            <Ionicons name="add" size={14} color={theme.secondaryText} />
            <Text style={styles.noteModalAddTagText}>{t('home.addTag')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tag picker panel */}
      {tagPickerOpen && (
        <View style={styles.noteModalTagPanel}>
          <View style={styles.noteModalTagInputRow}>
            <TextInput
              style={styles.noteModalTagTextInput}
              placeholder={t('home.addTagPlaceholder')}
              placeholderTextColor={theme.placeholderText}
              value={newTagInput}
              onChangeText={setNewTagInput}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (newTagInput.trim()) { setNoteTag(newTagInput.trim()); setTagPickerOpen(false); setNewTagInput(''); }
              }}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.noteModalTagAddBtn, !newTagInput.trim() && { opacity: 0.35 }]}
              onPress={() => {
                if (newTagInput.trim()) { setNoteTag(newTagInput.trim()); setTagPickerOpen(false); setNewTagInput(''); }
              }}
              disabled={!newTagInput.trim()}
            >
              <Text style={styles.noteModalTagAddBtnText}>{t('home.addTag')}</Text>
            </TouchableOpacity>
          </View>
          {noteExistingTags.length > 0 && (
            <>
              <View style={styles.noteModalTagPanelDivider} />
              <Text style={styles.noteModalPrevTagsLabel}>{t('home.previousTags').toUpperCase()}</Text>
              {noteExistingTags.map((tag, i) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.noteModalPrevTagRow,
                    i === noteExistingTags.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => { setNoteTag(tag); setTagPickerOpen(false); }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.noteModalPrevTagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}

      {/* Divider */}
      <View style={styles.noteModalDivider} />

      {/* Body */}
      <TextInput
        ref={contentInputRef}
        style={styles.noteModalBodyInput}
        placeholder={t('home.contentPlaceholder')}
        placeholderTextColor={theme.placeholderText}
        value={content}
        onChangeText={setContent}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        editable={!isAnalyzing}
      />
    </ScrollView>

    {/* Delete button (edit mode) — pinned to bottom, hidden when keyboard is up */}
    {currentDiary && !keyboardVisible && (
      <TouchableOpacity
        style={styles.deleteButtonModal}
        onPress={() => deleteDiary(currentDiary.id)}
        disabled={isAnalyzing}
      >
        <Text style={styles.deleteButtonText}>{t('home.deleteNote')}</Text>
      </TouchableOpacity>
    )}
  </KeyboardAvoidingView>
</Modal>

{/* ── Writing Feedback Modal ── */}
<Modal
  animationType="slide"
  transparent
  visible={feedbackModalVisible}
  onRequestClose={closeFeedbackModal}
>
  <View style={fbS.overlay}>
    <View style={fbS.sheet}>
      <View style={fbS.handle} />

      {/* Header */}
      <View style={fbS.header}>
        <View>
          <Text style={fbS.headerSub}>JUST SAVED</Text>
          <Text style={fbS.headerTitle}>
            {!feedbackLoading && feedbackEmotionFailed && feedbackStructureFailed
              ? 'Note was saved'
              : "Today's Entry"}
          </Text>
        </View>
        <TouchableOpacity onPress={closeFeedbackModal} style={fbS.closeBtn} hitSlop={8}>
          <Ionicons name="close" size={18} color="#1C1C1E" />
        </TouchableOpacity>
      </View>

      {/* ── STATE A: Both failed ── */}
      {!feedbackLoading && feedbackEmotionFailed && feedbackStructureFailed ? (
        <>
          <View style={fbS.errorCard}>
            <Text style={fbS.errorIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={fbS.errorTitle}>Analysis failed</Text>
              <Text style={fbS.errorDesc}>
                Due to a network issue, emotion and structure analysis could not be fetched. Your note was saved successfully.
              </Text>
            </View>
          </View>
          <TouchableOpacity style={fbS.retryBtn} onPress={retryAnalysis} activeOpacity={0.8}>
            <Text style={fbS.retryText}>🔄  Retry analysis</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* ── Emotion card or yellow warning ── */}
          {feedbackDraft && (
            feedbackEmotionFailed ? (
              <View style={fbS.warningCard}>
                <Text style={fbS.warningIcon}>😐</Text>
                <Text style={fbS.warningText}>Emotion analysis unavailable</Text>
              </View>
            ) : (
              <View style={fbS.emotionCard}>
                <Text style={fbS.emotionEmoji}>{feedbackDraft.emoji}</Text>
                <View style={fbS.emotionMiddle}>
                  <Text style={fbS.emotionLabel}>Emotion</Text>
                  <Text style={fbS.emotionName}>
                    {feedbackDraft.emotion.charAt(0).toUpperCase() + feedbackDraft.emotion.slice(1)}
                  </Text>
                </View>
                <View style={fbS.emotionRight}>
                  <Text style={fbS.emotionPct}>
                    {Math.round((writingFeedback?.emotion_score ?? 0.7) * 100)}%
                  </Text>
                  <View style={fbS.emotionTrack}>
                    <View style={[fbS.emotionFill, {
                      width: `${Math.round((writingFeedback?.emotion_score ?? 0.7) * 100)}%`,
                      backgroundColor: emotionToColor(feedbackDraft.emotion),
                    }]} />
                  </View>
                </View>
              </View>
            )
          )}

          {/* Divider */}
          <View style={fbS.divider} />

          {/* Writing Structure */}
          <Text style={fbS.sectionLabel}>Writing Structure</Text>

          {feedbackLoading ? (
            <View style={fbS.loadingRow}>
              <ActivityIndicator size="small" color="#8E8E93" />
            </View>
          ) : (
            <>
              <View style={fbS.structureRow}>
                {[
                  { key: 'observation', icon: '👁', label: 'What\nhappened', color: '#007AFF' },
                  { key: 'thought',     icon: '💭', label: 'How I\nfelt',     color: '#AF52DE' },
                  { key: 'insight',     icon: '✨', label: 'What I\nlearned',  color: '#FF9F0A' },
                ].map(({ key, icon, label, color }) => {
                  const active = writingFeedback?.structure?.[key];
                  return (
                    <View key={key} style={[fbS.structureCard, active && { borderColor: color, backgroundColor: color + '14' }]}>
                      <View style={[fbS.badge, active ? { backgroundColor: color } : fbS.badgeInactive]}>
                        {active ? <Ionicons name="checkmark" size={9} color="#fff" /> : <Text style={fbS.badgeDash}>—</Text>}
                      </View>
                      <Text style={fbS.structureIcon}>{icon}</Text>
                      <Text style={[fbS.structureLabel, active && { color }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
              {feedbackStructureFailed && (
                <View style={fbS.structureWarnBox}>
                  <Ionicons name="alert-circle-outline" size={14} color="#FF9F0A" />
                  <Text style={fbS.structureWarnText}>
                    Couldn't retrieve structure analysis. We'll try again next time.
                  </Text>
                </View>
              )}
              {writingFeedback && (() => {
                const level = fbGetLevel(writingFeedback.structure);
                const apiNudge = writingFeedback.nudge;
                const staticNudge = FB_NUDGE[level];
                if (!apiNudge && !staticNudge) return null;
                const levelColors = { 1: '#007AFF', 2: '#AF52DE', 3: '#FF9F0A' };
                const dotColor = levelColors[level] || '#8E8E93';
                if (apiNudge) {
                  return (
                    <View style={fbS.nudgeBox}>
                      <View style={[fbS.nudgeDot, { backgroundColor: dotColor }]} />
                      <View style={fbS.nudgeContent}>
                        <Text style={[fbS.nudgeQuote, { color: dotColor }]}>"{apiNudge}"</Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View style={fbS.nudgeBox}>
                    <View style={[fbS.nudgeDot, { backgroundColor: staticNudge.color }]} />
                    <View style={fbS.nudgeContent}>
                      <Text style={fbS.nudgeDesc}>{staticNudge.desc}</Text>
                      {staticNudge.quote
                        ? <Text><Text style={[fbS.nudgeQuote, { color: staticNudge.color }]}>"{staticNudge.quote}"</Text><Text style={fbS.nudgeAction}>{staticNudge.action}</Text></Text>
                        : <Text style={fbS.nudgeBold}>{staticNudge.bold}</Text>}
                    </View>
                  </View>
                );
              })()}
            </>
          )}
        </>
      )}

      {/* CTA */}
      {writingFeedback?.nudge ? (
        <>
          <TouchableOpacity style={fbS.ctaButton} onPress={handleContinueWriting} activeOpacity={0.8}>
            <Text style={fbS.ctaText}>이어서 쓰기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fbS.laterBtn} onPress={closeFeedbackModal} activeOpacity={0.8}>
            <Text style={fbS.laterText}>나중에</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={fbS.ctaButton} onPress={closeFeedbackModal} activeOpacity={0.8}>
          <Text style={fbS.ctaText}>Confirm</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
</Modal>

{/* ── Analyzing Toast ── */}
{isAnalyzing && !modalVisible && (
  <View pointerEvents="none" style={[toastS.container, { bottom: tabBarHeight + insets.bottom + 12 }]}>
    <ActivityIndicator size="small" color="#fff" />
    <View style={toastS.textWrap}>
      <Text style={toastS.title}>Analyzing your note…</Text>
    </View>
  </View>
)}

{/* ── Memo Toast ── */}
{memoToastVisible && (
  <Animated.View
    pointerEvents="none"
    style={[
      toastS.container,
      {
        bottom: tabBarHeight + insets.bottom + 12,
        opacity: memoToastAnim,
        transform: [{ translateY: memoToastAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      },
    ]}
  >
    <View style={toastS.iconWrap}>
      <Ionicons name="checkmark" size={16} color="#fff" />
    </View>
    <View style={toastS.textWrap}>
      <Text style={toastS.title}>{t('home.saved')}</Text>
      <Text style={toastS.subtitle}>Memo saved without analysis.</Text>
    </View>
  </Animated.View>
)}

    </View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.primaryText,
  },
  diaryCountText: {
    color: theme.secondaryText,
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerButton: {
    padding: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: theme.secondaryText,
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.secondaryText,
    marginTop: 4,
  },
  clearFilterLink: {
    fontSize: 14,
    color: theme.accent,
    marginTop: 12,
  },
  // Filter panel styles
  filterPanel: {
    backgroundColor: theme.card,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.background,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: theme.border,
  },
  filterTabText: {
    fontSize: 13,
    color: theme.secondaryText,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: theme.primaryText,
    fontWeight: '600',
  },
  filterTabContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    color: theme.primaryText,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateLabel: {
    fontSize: 11,
    color: theme.secondaryText,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 14,
    color: theme.primaryText,
    fontWeight: '500',
  },
  datePlaceholder: {
    color: theme.tertiaryText,
  },
  dateSeparator: {
    fontSize: 16,
    color: theme.tertiaryText,
  },
  // Tag filter
  tagFilterEmpty: {
    fontSize: 14,
    color: theme.tertiaryText,
    textAlign: 'center',
    paddingVertical: 8,
  },
  tagFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tagFilterChipActive: {
    backgroundColor: theme.primaryText,
  },
  tagFilterChipText: {
    fontSize: 13,
    color: theme.accent,
    fontWeight: '500',
  },
  tagFilterChipTextActive: {
    color: theme.card,
    fontWeight: '700',
  },
  // Date picker modal (iOS)
  datePickerOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'flex-end',
  },
  datePickerCard: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.primaryText,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.primaryText,
  },
  emotionFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
  },
  emotionChipEmoji: {
    fontSize: 16,
  },
  emotionChipLabel: {
    fontSize: 13,
    color: theme.secondaryText,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  clearFilterText: {
    fontSize: 13,
    color: theme.danger,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  diaryItem: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  diaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diaryDate: {
    fontSize: 12,
    color: theme.secondaryText,
    fontWeight: '500',
  },
  emotionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  emotionEmoji: {
    fontSize: 18,
  },
  emotionText: {
    fontSize: 12,
    color: theme.secondaryText,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tagPillWrap: {
    marginTop: 10,
    flexDirection: 'row',
  },
  tagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.primaryText,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.card,
  },
  diaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    color: theme.primaryText,
    letterSpacing: -0.3,
  },
  diaryContent: {
    fontSize: 14,
    color: theme.secondaryText,
    lineHeight: 20,
  },
  structureStrip: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButton: {
    backgroundColor: '#6366f1',
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: theme.danger,
  },
  buttonText: {
    color: theme.card,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primaryText,
  },
  cancelButton: {
    fontSize: 16,
    color: theme.secondaryText,
  },
  saveButton: {
    fontSize: 16,
    color: theme.primaryText,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  analyzingBanner: {
    backgroundColor: theme.accent,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    color: theme.card,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    padding: 12,
    backgroundColor: theme.background,
    borderRadius: 8,
    color: theme.primaryText,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    padding: 12,
    backgroundColor: theme.background,
    borderRadius: 8,
    color: theme.primaryText,
  },
  deleteContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: theme.card,
  },
  deleteButtonModal: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.card,
  },
  deleteButtonText: {
    color: theme.danger,
    fontSize: 16,
    fontWeight: '500',
  },

  // ── New-style note modal (matches LandingScreen) ──────────────────────────
  noteModalRoot: {
    flex: 1,
    backgroundColor: theme.card,
    paddingTop: Platform.OS === 'android' ? 0 : 0,
  },
  noteModalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  noteModalIconBtn: { width: 40, alignItems: 'center' },
  noteModalCenter: { alignItems: 'center', flex: 1 },
  noteModalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.secondaryText,
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  noteModalDateDay: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 13,
    color: theme.primaryText,
  },
  noteModalDateRest: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.primaryText,
  },
  noteModalScroll: { padding: 20, paddingBottom: 20 },
  noteModalTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  noteModalTitleInput: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 26,
    fontWeight: '700',
    color: theme.primaryText,
    paddingVertical: 4,
  },
  noteModalCharCounter: { fontSize: 12, color: theme.tertiaryText, marginLeft: 8, alignSelf: 'flex-end' },
  noteModalTagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, minHeight: 32 },
  noteModalAddTagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: theme.tertiaryText, borderStyle: 'dashed',
  },
  noteModalAddTagText: { fontSize: 13, color: theme.secondaryText, fontWeight: '500' },
  noteModalTagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: theme.primaryText,
  },
  noteModalTagChipText: { fontSize: 13, color: theme.card, fontWeight: '600' },
  noteModalTagPanel: {
    backgroundColor: theme.card, borderRadius: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden',
  },
  noteModalTagInputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  noteModalTagTextInput: {
    flex: 1, backgroundColor: theme.background, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: theme.primaryText,
  },
  noteModalTagAddBtn: {
    backgroundColor: theme.primaryText, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  noteModalTagAddBtnText: { fontSize: 13, color: theme.card, fontWeight: '700' },
  noteModalTagPanelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginHorizontal: 14 },
  noteModalPrevTagsLabel: {
    fontSize: 11, fontWeight: '700', color: theme.secondaryText, letterSpacing: 2,
    marginHorizontal: 14, marginTop: 14, marginBottom: 4,
  },
  noteModalPrevTagRow: {
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.background,
  },
  noteModalPrevTagText: { fontSize: 16, color: theme.primaryText, fontWeight: '400' },
  noteModalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 16 },
  noteModalBodyInput: {
    fontSize: 16, color: theme.primaryText, lineHeight: 24, minHeight: 200,
  },
  noteModalWordCounter: { fontSize: 12, color: theme.tertiaryText, textAlign: 'right', marginTop: 8 },
});

const customTabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
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
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});

// ── Feedback modal helpers ─────────────────────────────────────────────────────
function fbGetLevel(structure) {
  if (!structure) return 0;
  const { observation, thought, insight } = structure;
  if (observation && thought && insight) return 3;
  if (observation && thought) return 2;
  if (observation) return 1;
  return 0;
}

const FB_NUDGE = {
  1: {
    color: '#007AFF',
    desc: 'What happened is captured.',
    quote: 'How did it make you feel?',
    action: ' One more sentence changes everything.',
  },
  2: {
    color: '#AF52DE',
    desc: 'What happened and how you felt is captured.',
    quote: 'What did you take away from it?',
    action: ' One more line becomes insight.',
  },
  3: {
    color: '#FF9F0A',
    desc: 'All three layers are present.',
    bold: 'The more you write like this, the more your thinking evolves.',
  },
};

// ── Writing Feedback Modal styles ─────────────────────────────────────────────
const fbS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerSub: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    gap: 12,
  },
  emotionEmoji: {
    fontSize: 40,
  },
  emotionMiddle: {
    flex: 1,
  },
  emotionLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  emotionName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  emotionRight: {
    alignItems: 'flex-end',
    width: 88,
  },
  emotionPct: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  emotionTrack: {
    height: 5,
    width: 80,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  emotionFill: {
    height: 5,
    borderRadius: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  structureRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  structureCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#F9F9F9',
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInactive: {
    backgroundColor: '#E5E5EA',
  },
  badgeDash: {
    fontSize: 8,
    color: '#8E8E93',
    fontWeight: '700',
  },
  structureIcon: {
    fontSize: 24,
  },
  structureLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 15,
  },
  nudgeBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  nudgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  nudgeContent: {
    flex: 1,
  },
  nudgeDesc: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 20,
    marginBottom: 2,
  },
  nudgeQuote: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  nudgeAction: {
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 20,
  },
  nudgeBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterBtn: {
    alignItems: 'center',
    paddingTop: 14,
  },
  laterText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '500',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorIcon: { fontSize: 22 },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D32F2F',
    marginBottom: 4,
  },
  errorDesc: {
    fontSize: 13,
    color: '#B71C1C',
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningIcon: { fontSize: 24 },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  structureWarnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  structureWarnText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
});

const toastS = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 1,
  },
});
