import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  StatusBar as RNStatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

import { analyzeEmotionWithFallback, emotionToEmoji, emotionToColor } from '../utils/emotionAnalysis';
import { authFetch } from '../services/auth';
import { APP_NAME } from '../constants/appConfig';

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

// ─── Date helpers ────────────────────────────────────────────────────────────
function getHeaderDate() {
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });     // "Sat"
  const rest = d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });                                                                    // "February 28, 2026"
  return { day, rest };
}

function countWords(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function countChars(text) {
  return text.replace(/\s/g, '').length;
}

function isKorean(text) {
  const koreanChars = (text.match(/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && koreanChars / totalChars > 0.3;
}

function getContentCounter(text) {
  if (text.length === 0) return null;
  return isKorean(text)
    ? `${countChars(text)} chars`
    : `${countWords(text)} words`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LandingScreen({ navigation, route }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const [diaries, setDiaries] = useState([]);

  // ── Note modal state
  const [modalVisible, setModalVisible]   = useState(false);
  const [title, setTitle]                 = useState('');
  const [content, setContent]             = useState('');
  const [isAnalyzing, setIsAnalyzing]     = useState(false);
  const [writingFeedback, setWritingFeedback]           = useState(null);
  const [feedbackDraft, setFeedbackDraft]               = useState(null);
  const [feedbackLoading, setFeedbackLoading]           = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackEmotionFailed, setFeedbackEmotionFailed] = useState(false);
  const [feedbackStructureFailed, setFeedbackStructureFailed] = useState(false);
  const [memoToastVisible, setMemoToastVisible] = useState(false);
  const memoToastAnim = useRef(new Animated.Value(0)).current;

  // ── Tag picker state
  const [selectedTag, setSelectedTag]         = useState('');
  const [tagPickerOpen, setTagPickerOpen]     = useState(false);
  const [existingTags, setExistingTags]       = useState([]);
  const [newTagInput, setNewTagInput]         = useState('');

  const contentInputRef = useRef(null);

  // ── Load diaries on focus
  useFocusEffect(
    useCallback(() => { loadDiaries(); }, [])
  );

  // ── Center tab button → open modal
  useEffect(() => {
    if (!route?.params?.openNewNote) return;
    openNewModal();
  }, [route?.params?.openNewNote]);

  const loadDiaries = async () => {
    try {
      const saved = await AsyncStorage.getItem('diaries');
      if (saved) setDiaries(JSON.parse(saved));
    } catch {}
  };

  // ── Collect unique tags from all saved diaries
  const loadExistingTags = async () => {
    try {
      const saved = await AsyncStorage.getItem('diaries');
      if (!saved) return [];
      const all = JSON.parse(saved);
      const tags = [...new Set(all.map(d => d.tag).filter(Boolean))];
      return tags;
    } catch {
      return [];
    }
  };

  // ── Open / close modal
  const openNewModal = async () => {
    const tags = await loadExistingTags();
    setExistingTags(tags);
    setTitle('');
    setContent('');
    setSelectedTag('');
    setNewTagInput('');
    setTagPickerOpen(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTagPickerOpen(false);
  };

  // ── Tag picker
  const handleTagPickerToggle = () => {
    setNewTagInput('');
    setTagPickerOpen(v => !v);
  };

  const confirmTag = (tag) => {
    setSelectedTag(tag.trim());
    setTagPickerOpen(false);
    setNewTagInput('');
  };

  const confirmNewTag = () => {
    if (newTagInput.trim()) confirmTag(newTagInput);
  };

  const removeTag = () => setSelectedTag('');

  const closeFeedbackModal = useCallback(() => {
    setFeedbackModalVisible(false);
    setFeedbackDraft(null);
    setWritingFeedback(null);
    setFeedbackLoading(false);
    setFeedbackEmotionFailed(false);
    setFeedbackStructureFailed(false);
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
        if (data.is_diary) setWritingFeedback({ ...data, emotion, emoji });
      } else { structureFailed = true; }
    } catch { structureFailed = true; }
    setFeedbackStructureFailed(structureFailed);
    setFeedbackLoading(false);
  }, [feedbackDraft]);

  // ── Save
  const addDiary = async () => {
    if (content.trim() === '') {
      Alert.alert('Write something', 'Please enter some content before saving.');
      return;
    }
    const savedContent = content;
    const savedTitle = title.trim() || 'Untitled';
    setIsAnalyzing(true);

    // 1. Emotion analysis (with fallback — never throws)
    let emotion = 'neutral', emoji = '😐', emotionFailed = false;
    try {
      const result = await analyzeEmotionWithFallback(savedContent);
      emotion = result.emotion;
      emotionFailed = result.failed;
      emoji = emotionToEmoji(emotion);
    } catch { emotionFailed = true; }

    // 2. Save diary — isAnalyzing stays true (shows analyzing toast on main screen)
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    const savedDiaryId = await persistDiary(savedTitle, emotion, emoji);
    setModalVisible(false);
    loadDiaries();
    setFeedbackDraft({ title: savedTitle, content: savedContent, emotion, emoji, dateStr });
    setFeedbackEmotionFailed(emotionFailed);
    setFeedbackStructureFailed(false);
    setWritingFeedback(null);

    // 3. Structure API call — show modal ONLY after response
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
        if (savedDiaryId && (data.structure || data.structure_score != null)) {
          const rawAll = await AsyncStorage.getItem('diaries');
          const allDiaries = rawAll ? JSON.parse(rawAll) : [];
          const updated = allDiaries.map(d =>
            d.id === savedDiaryId
              ? { ...d, structure: data.structure, structure_score: data.structure_score, thinking_type: data.thinking_type ?? d.thinking_type, language_lens: data.language_lens ?? d.language_lens }
              : d
          );
          await AsyncStorage.setItem('diaries', JSON.stringify(updated));
          loadDiaries();
        }
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
    setFeedbackStructureFailed(structureFailed);
    setFeedbackModalVisible(true);
  };

  const persistDiary = async (savedTitle, emotion, emoji) => {
    const newDiary = {
      id: Date.now().toString(),
      title: savedTitle,
      content,
      date: new Date().toLocaleDateString('en-US'),
      timestamp: new Date().toISOString(),
      emotion,
      emoji,
      tag: selectedTag || null,
      categoryId: null,
    };
    const saved = await AsyncStorage.getItem('diaries');
    const all = saved ? JSON.parse(saved) : [];
    await AsyncStorage.setItem('diaries', JSON.stringify([newDiary, ...all]));
    return newDiary.id;
  };

  // ── Landing UI helpers
  const recentEntries = [...diaries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 7);

  const formatDateTime = (ts) =>
    new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });

  const { day, rest } = getHeaderDate();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── Landing header ── */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>{APP_NAME}</Text>
            <Text style={styles.welcomeText}>WELCOME BACK</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="options-outline" size={24} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* CTA Card */}
        <TouchableOpacity style={styles.ctaCard} onPress={openNewModal} activeOpacity={0.88}>
          <View style={styles.ctaCircle}>
            <Ionicons name="pencil" size={28} color={theme.primaryText} />
          </View>
          <Text style={styles.ctaText}>{t('landing.writeNewNote')}</Text>
        </TouchableOpacity>

        {/* 2-column cards */}
        <View style={styles.twoCol}>
          <TouchableOpacity style={styles.halfCard} onPress={() => navigation.navigate('Notes')} activeOpacity={0.8}>
            <Ionicons name="book-outline" size={28} color={theme.accent} style={styles.halfIcon} />
            <Text style={styles.halfTitle}>{t('landing.noteList')}</Text>
            <Text style={styles.halfSub}>{diaries.length} ENTRIES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.halfCard} onPress={() => navigation.navigate('InsightDetail')} activeOpacity={0.8}>
            <Ionicons name="trending-up-outline" size={28} color={theme.accent} style={styles.halfIcon} />
            <Text style={styles.halfTitle}>{t('landing.viewInsights')}</Text>
            <Text style={styles.halfSub}>AI ANALYSIS</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Entries */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t('landing.recentEntries')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Notes')}>
            <Text style={styles.viewAll}>{t('landing.viewAll')}</Text>
          </TouchableOpacity>
        </View>

        {recentEntries.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('landing.noNotes')}</Text>
          </View>
        ) : (
          recentEntries.map((diary) => (
            <TouchableOpacity
              key={diary.id}
              style={styles.entryCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('Notes', { openEditNote: diary.id })}
            >
              <Text style={styles.entryDate}>{formatDateTime(diary.timestamp)}</Text>
              <Text style={styles.entryPreview} numberOfLines={2}>{diary.content}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW ENTRY MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        animationType="slide"
        visible={modalVisible}
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <KeyboardAvoidingView
          style={modal.root}
          behavior={Platform.OS === 'android' ? 'height' : 'padding'}
          keyboardVerticalOffset={insets.top - 20}
        >
          <SafeAreaView edges={['top']} style={{ backgroundColor: theme.card }} />

          {/* ── Top bar ── */}
          <View style={modal.topBar}>
            {/* Left: X */}
            <TouchableOpacity style={modal.iconBtn} onPress={closeModal} disabled={isAnalyzing} hitSlop={8}>
              <Ionicons name="close" size={22} color={isAnalyzing ? theme.tertiaryText : theme.primaryText} />
            </TouchableOpacity>

            {/* Center: label + date */}
            <View style={modal.centerLabel}>
              <Text style={modal.newEntryLabel}>NEW ENTRY</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={modal.dateDay}>{day}, </Text>
                <Text style={modal.dateRest}>{rest}</Text>
              </View>
            </View>

            {/* Right: send icon */}
            <TouchableOpacity style={modal.iconBtn} onPress={addDiary} disabled={isAnalyzing} hitSlop={8}>
              {isAnalyzing
                ? <ActivityIndicator size="small" color={theme.primaryText} />
                : <Ionicons name="arrow-up-circle" size={28} color={theme.primaryText} />
              }
            </TouchableOpacity>
          </View>

          {isAnalyzing && (
            <View style={modal.analyzingBanner}>
              <ActivityIndicator color={theme.ctaText} size="small" />
              <Text style={modal.analyzingText}>Analyzing emotions…</Text>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={modal.scrollContent}
          >
            {/* ── Title ── */}
            <View style={modal.titleRow}>
              <TextInput
                style={[modal.titleInput, { flex: 1 }]}
                placeholder={t('landing.titlePlaceholder')}
                placeholderTextColor={theme.placeholderText}
                value={title}
                onChangeText={(t) => setTitle(t.slice(0, 60))}
                maxLength={60}
                editable={!isAnalyzing}
                returnKeyType="next"
                onSubmitEditing={() => contentInputRef.current?.focus()}
              />
              {title.length > 0 && (
                <Text style={modal.charCounter}>{title.length}/60</Text>
              )}
            </View>

            {/* ── Tag row ── */}
            <View style={modal.tagRow}>
              {selectedTag ? (
                <View style={modal.tagChip}>
                  <Text style={modal.tagChipText}># {selectedTag}</Text>
                  <TouchableOpacity onPress={removeTag} hitSlop={6}>
                    <Ionicons name="close-circle" size={15} color={theme.secondaryText} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={modal.addTagBtn} onPress={handleTagPickerToggle}>
                  <Ionicons name="add" size={14} color={theme.secondaryText} />
                  <Text style={modal.addTagText}>{t('landing.addTagPlaceholder')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Tag picker panel ── */}
            {tagPickerOpen && (
              <View style={modal.tagPanel}>
                {/* Input row: "New tag..." + "Add tag" button */}
                <View style={modal.tagInputRow}>
                  <TextInput
                    style={modal.tagTextInput}
                    placeholder={t('landing.addTagPlaceholder')}
                    placeholderTextColor={theme.placeholderText}
                    value={newTagInput}
                    onChangeText={setNewTagInput}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={confirmNewTag}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[modal.tagAddBtn, !newTagInput.trim() && { opacity: 0.35 }]}
                    onPress={confirmNewTag}
                    disabled={!newTagInput.trim()}
                  >
                    <Text style={modal.tagAddBtnText}>Add tag</Text>
                  </TouchableOpacity>
                </View>

                {/* Previous tags list */}
                {existingTags.length > 0 && (
                  <>
                    <View style={modal.tagPanelDivider} />
                    <Text style={modal.prevTagsLabel}>PREVIOUS TAGS</Text>
                    {existingTags.map((tag, i) => (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          modal.prevTagRow,
                          i === existingTags.length - 1 && { borderBottomWidth: 0 },
                        ]}
                        onPress={() => confirmTag(tag)}
                        activeOpacity={0.6}
                      >
                        <Text style={modal.prevTagText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── Divider ── */}
            <View style={modal.divider} />

            {/* ── Body ── */}
            <View style={{ flex: 1 }}>
              <TextInput
                ref={contentInputRef}
                style={modal.bodyInput}
                placeholder={t('landing.contentPlaceholder')}
                placeholderTextColor={theme.placeholderText}
                value={content}
                onChangeText={setContent}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                editable={!isAnalyzing}
              />
            </View>
          </ScrollView>
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
                    : t('landing.todayEntry')}
                </Text>
              </View>
              <TouchableOpacity onPress={closeFeedbackModal} style={fbS.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={18} color={theme.primaryText} />
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
                <Text style={fbS.sectionLabel}>{t('insight.writingStructure')}</Text>

                {feedbackLoading ? (
                  <View style={fbS.loadingRow}>
                    <ActivityIndicator size="small" color={theme.secondaryText} />
                  </View>
                ) : (
                  <>
                    <View style={fbS.structureRow}>
                      {[
                        { key: 'observation', icon: '👁', label: t('landing.whatHappened'), color: theme.observation },
                        { key: 'thought',     icon: '💭', label: t('landing.howIFelt'),     color: theme.thought },
                        { key: 'insight',     icon: '✨', label: t('landing.whatILearned'),  color: theme.insight },
                      ].map(({ key, icon, label, color }) => {
                        const active = writingFeedback?.structure?.[key];
                        return (
                          <View key={key} style={[fbS.structureCard, active && { borderColor: color, backgroundColor: color + '14' }]}>
                            <View style={[fbS.badge, active ? { backgroundColor: color } : fbS.badgeInactive]}>
                              {active
                                ? <Ionicons name="checkmark" size={9} color="#fff" />
                                : <Text style={fbS.badgeDash}>—</Text>
                              }
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
                      const nudge = FB_NUDGE[level];
                      if (!nudge) return null;
                      return (
                        <View style={fbS.nudgeBox}>
                          <View style={[fbS.nudgeDot, { backgroundColor: nudge.color }]} />
                          <View style={fbS.nudgeContent}>
                            <Text style={fbS.nudgeDesc}>{nudge.desc}</Text>
                            {nudge.quote
                              ? <Text><Text style={[fbS.nudgeQuote, { color: nudge.color }]}>"{nudge.quote}"</Text><Text style={fbS.nudgeAction}>{nudge.action}</Text></Text>
                              : <Text style={fbS.nudgeBold}>{nudge.bold}</Text>}
                          </View>
                        </View>
                      );
                    })()}
                  </>
                )}
              </>
            )}

            {/* CTA */}
            <TouchableOpacity style={fbS.ctaButton} onPress={closeFeedbackModal} activeOpacity={0.8}>
              <Text style={fbS.ctaText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Analyzing Toast ── */}
      {isAnalyzing && !modalVisible && (
        <View pointerEvents="none" style={[toastS.container, { bottom: insets.bottom + 24 }]}>
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
              bottom: insets.bottom + 24,
              opacity: memoToastAnim,
              transform: [{ translateY: memoToastAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <View style={toastS.iconWrap}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
          <View style={toastS.textWrap}>
            <Text style={toastS.title}>{t('landing.saved')}</Text>
            <Text style={toastS.subtitle}>Memo saved without analysis.</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Landing styles ───────────────────────────────────────────────────────────
const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  safeTop: { backgroundColor: theme.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16,
  },
  logo: { fontFamily: SERIF, fontSize: 34, fontWeight: '700', color: theme.primaryText, letterSpacing: -0.5 },
  welcomeText: { fontSize: 11, fontWeight: '700', color: theme.secondaryText, letterSpacing: 2.5, marginTop: 3 },
  settingsBtn: { padding: 8 },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  ctaCard: {
    backgroundColor: theme.cta, borderRadius: 22, height: 210,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 16,
  },
  ctaCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center',
  },
  ctaText: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, color: theme.ctaText, letterSpacing: 0.3 },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  halfCard: {
    flex: 1, backgroundColor: theme.card, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  halfIcon: { marginBottom: 10 },
  halfTitle: { fontSize: 15, fontWeight: '700', color: theme.primaryText, marginBottom: 4 },
  halfSub: { fontSize: 11, fontWeight: '700', color: theme.secondaryText, letterSpacing: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.secondaryText, letterSpacing: 2.5 },
  viewAll: { fontSize: 11, fontWeight: '700', color: theme.accent, letterSpacing: 1 },
  entryCard: {
    backgroundColor: theme.card, borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  entryDate: { fontSize: 12, color: theme.secondaryText, fontWeight: '500', marginBottom: 6 },
  entryPreview: { fontSize: 14, color: theme.primaryText, lineHeight: 20 },
  emptyBox: { paddingVertical: 36, alignItems: 'center' },
  emptyText: { fontSize: 14, color: theme.tertiaryText },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  iconBtn: { width: 40, alignItems: 'center' },
  centerLabel: { alignItems: 'center', flex: 1 },
  newEntryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  dateDay: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 13,
    color: '#1C1C1E',
  },
  dateRest: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1C1C1E',
  },

  // Analyzing banner
  analyzingBanner: {
    backgroundColor: '#3A3A3C',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzingText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  scrollContent: { padding: 20, paddingBottom: 20 },

  // Title
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  titleInput: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    paddingVertical: 4,
  },
  charCounter: { fontSize: 12, color: '#C7C7CC', marginLeft: 8, alignSelf: 'flex-end' },

  // Tag row
  tagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, minHeight: 32 },
  addTagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C7C7CC',
    borderStyle: 'dashed',
  },
  addTagText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#1C1C1E',
  },
  tagChipText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // Tag picker panel
  tagPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  tagInputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  tagTextInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#1C1C1E',
  },
  tagAddBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  tagAddBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  tagPanelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA', marginHorizontal: 14 },
  prevTagsLabel: {
    fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 2,
    marginHorizontal: 14, marginTop: 14, marginBottom: 4,
  },
  prevTagRow: {
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  prevTagText: { fontSize: 16, color: '#1C1C1E', fontWeight: '400' },

  // Divider
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA', marginVertical: 16 },

  // Body
  bodyInput: {
    fontSize: 16, color: '#1C1C1E', lineHeight: 24,
    minHeight: 200,
  },
  wordCounter: {
    fontSize: 12, color: '#C7C7CC', textAlign: 'right', marginTop: 8,
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
  emotionEmoji: { fontSize: 40 },
  emotionMiddle: { flex: 1 },
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
  structureIcon: { fontSize: 24 },
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
  nudgeContent: { flex: 1 },
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
