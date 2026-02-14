import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';

import { analyzeEmotion, emotionToEmoji, emotionToColor } from '../utils/emotionAnalysis';
import { PRIVACY_POLICY } from '../constants/privacyPolicy';
import {
  registerForPushNotificationsAsync,
  scheduleMultipleNotifications,
  cancelAllNotifications,
} from '../utils/notifications';

export default function HomeScreen({ onLogout, serverUserName, route }) {
  const [diaries, setDiaries] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [currentDiary, setCurrentDiary] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Search & Filter states
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('keyword');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState([]);

  // Animation refs
  const panelHeight = useRef(new Animated.Value(0)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;

  // Settings states
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState(['21:00']);
  const [notificationPreview, setNotificationPreview] = useState('How was your day?');

  // Profile states
  const [userName, setUserName] = useState(serverUserName || 'User');
  const [startDate, setStartDate] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Time picker states
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(12);
  const [pickerMinute, setPickerMinute] = useState(0);
  const pickerAnim = useRef(new Animated.Value(0)).current;

  // Privacy states
  const [useAIAnalysis, setUseAIAnalysis] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  useEffect(() => {
    loadDiaries();
    loadSettings();
  }, []);

  // Listen for center tab button press to open new note modal
  useEffect(() => {
    if (route?.params?.openNewNote) {
      openNewModal();
    }
  }, [route?.params?.openNewNote]);


  const loadDiaries = async () => {
    try {
      const savedDiaries = await AsyncStorage.getItem('diaries');
      if (savedDiaries !== null) {
        setDiaries(JSON.parse(savedDiaries));
      }
    } catch (error) {
      console.error('Failed to load diaries:', error);
    }
  };

  const saveDiaries = async (newDiaries) => {
    try {
      await AsyncStorage.setItem('diaries', JSON.stringify(newDiaries));
    } catch (error) {
      console.error('Failed to save diaries:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setReminderEnabled(parsed.reminderEnabled === true);
        if (Array.isArray(parsed.reminderTimes)) {
          setReminderTimes(parsed.reminderTimes);
        } else if (parsed.reminderTime) {
          setReminderTimes([String(parsed.reminderTime)]);
        }
        setNotificationPreview(String(parsed.notificationPreview ?? 'How was your day?'));
        setUserName(serverUserName || String(parsed.userName ?? 'User'));
        setStartDate(String(parsed.startDate ?? ''));
      } else {
        // First time user - save start date
        const today = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        setStartDate(today);
        saveSettings({ startDate: today });
      }

      // Always read AI setting (stored separately from settings)
      const aiSetting = await AsyncStorage.getItem('useAIAnalysis');
      setUseAIAnalysis(aiSetting === 'true');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      const settings = {
        reminderEnabled,
        reminderTimes,
        notificationPreview,
        userName,
        startDate,
        ...newSettings,
      };
      await AsyncStorage.setItem('settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReminderToggle = async (value) => {
    setReminderEnabled(value);
    saveSettings({ reminderEnabled: value });
    if (value) {
      await registerForPushNotificationsAsync();
      await scheduleMultipleNotifications(reminderTimes, notificationPreview);
    } else {
      await cancelAllNotifications();
    }
  };

  const handlePreviewChange = async (text) => {
    setNotificationPreview(text);
    saveSettings({ notificationPreview: text });
    if (reminderEnabled) {
      await scheduleMultipleNotifications(reminderTimes, text);
    }
  };

  const openTimePicker = () => {
    setPickerHour(12);
    setPickerMinute(0);
    setShowTimePicker(true);
    Animated.timing(pickerAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const closeTimePicker = () => {
    Animated.timing(pickerAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setShowTimePicker(false));
  };

  const addReminderTime = async () => {
    const timeStr = `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
    if (reminderTimes.includes(timeStr)) {
      Alert.alert('Duplicate', `${timeStr} is already set.`);
      return;
    }
    const newTimes = [...reminderTimes, timeStr].sort();
    setReminderTimes(newTimes);
    saveSettings({ reminderTimes: newTimes });
    closeTimePicker();
    if (reminderEnabled) {
      await scheduleMultipleNotifications(newTimes, notificationPreview);
    }
  };

  const removeReminderTime = async (time) => {
    const newTimes = reminderTimes.filter(t => t !== time);
    setReminderTimes(newTimes);
    saveSettings({ reminderTimes: newTimes });
    if (reminderEnabled) {
      if (newTimes.length === 0) {
        await cancelAllNotifications();
      } else {
        await scheduleMultipleNotifications(newTimes, notificationPreview);
      }
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

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

  const handleDeleteAllData = () => {
    Alert.alert('Delete All Data', 'Are you sure you want to delete all your data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Final Confirmation', 'This cannot be undone! All notes and settings will be permanently deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete Everything',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.clear();
                if (onLogout) onLogout();
              },
            },
          ]);
        },
      },
    ]);
  };

  const handleNameChange = (name) => {
    setUserName(name);
  };

  const handleNameSubmit = () => {
    setIsEditingName(false);
    saveSettings({ userName });
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

  // Filter diaries based on search, date, and emotion
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

    return matchesSearch && matchesDate && matchesEmotion;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSelectedEmotions([]);
  };

  const hasActiveFilters = searchQuery !== '' || startDateFilter !== '' || endDateFilter !== '' || selectedEmotions.length > 0;

  const addDiary = async () => {
    if (title.trim() === '' || content.trim() === '') {
      Alert.alert('Notice', 'Please enter both title and content!');
      return;
    }

    setIsAnalyzing(true);

    try {
      const emotion = await analyzeEmotion(content);
      const emoji = emotionToEmoji(emotion);

      const newDiary = {
        id: Date.now().toString(),
        title: title,
        content: content,
        date: new Date().toLocaleDateString('en-US'),
        timestamp: new Date().toISOString(),
        emotion: emotion,
        emoji: emoji,
      };

      const newDiaries = [newDiary, ...diaries];
      setDiaries(newDiaries);
      saveDiaries(newDiaries);

      setTitle('');
      setContent('');
      setModalVisible(false);
      setIsAnalyzing(false);

      Alert.alert('Success', `Note saved!\nDetected emotion: ${emotion} ${emoji}`);
    } catch (error) {
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to analyze emotion, but note saved!');
      
      const newDiary = {
        id: Date.now().toString(),
        title: title,
        content: content,
        date: new Date().toLocaleDateString('en-US'),
        timestamp: new Date().toISOString(),
        emotion: 'neutral',
        emoji: '😐',
      };

      const newDiaries = [newDiary, ...diaries];
      setDiaries(newDiaries);
      saveDiaries(newDiaries);
      
      setTitle('');
      setContent('');
      setModalVisible(false);
    }
  };

  const updateDiary = async () => {
    if (title.trim() === '' || content.trim() === '') {
      Alert.alert('Notice', 'Please enter both title and content!');
      return;
    }

    setIsAnalyzing(true);

    try {
      const emotion = await analyzeEmotion(content);
      const emoji = emotionToEmoji(emotion);

      const updatedDiaries = diaries.map(diary =>
        diary.id === currentDiary.id
          ? { ...diary, title, content, emotion, emoji }
          : diary
      );

      setDiaries(updatedDiaries);
      saveDiaries(updatedDiaries);
      
      setTitle('');
      setContent('');
      setCurrentDiary(null);
      setModalVisible(false);
      setIsAnalyzing(false);
      
      Alert.alert('Success', `Note updated!\nDetected emotion: ${emotion} ${emoji}`);
    } catch (error) {
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
            Alert.alert('Deleted', 'Note has been deleted 🗑️');
          },
        },
      ]
    );
  };

  const openEditModal = (diary) => {
    setCurrentDiary(diary);
    setTitle(diary.title);
    setContent(diary.content);
    setModalVisible(true);
  };

  const openNewModal = () => {
    setCurrentDiary(null);
    setTitle('');
    setContent('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setTitle('');
    setContent('');
    setCurrentDiary(null);
  };

  const renderDiaryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.diaryItem,
        { borderLeftWidth: 4, borderLeftColor: emotionToColor(item.emotion) }
      ]}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.diaryHeader}>
        <Text style={styles.diaryDate}>{item.date}</Text>
        <View style={styles.emotionContainer}>
          <Text style={styles.emotionEmoji}>{item.emoji}</Text>
          <Text style={styles.emotionText}>{item.emotion}</Text>
        </View>
      </View>
      <Text style={styles.diaryTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.diaryContent} numberOfLines={2}>
        {item.content}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'white' }}>
        <View style={[styles.header, { backgroundColor: 'white' }]}>
          <View>
            {Platform.OS === 'android' ? (
              <Text style={[styles.headerTitle, { color: '#6366f1' }]}>
                LucidNote
              </Text>
            ) : (
              <MaskedView
                maskElement={
                  <Text style={[styles.headerTitle, { backgroundColor: 'transparent' }]}>
                    LucidNote
                  </Text>
                }
              >
                <LinearGradient
                  colors={['#5A6CFF', '#8B3DFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[styles.headerTitle, { opacity: 0 }]}>
                    LucidNote
                  </Text>
                </LinearGradient>
              </MaskedView>
            )}
            <Text style={styles.diaryCountText}>{diaries.length} notes</Text>
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
                  color={hasActiveFilters ? '#6366f1' : '#666'}
                />
                {hasActiveFilters && <View style={styles.filterBadge} />}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setSettingsVisible(true)}
            >
              <Ionicons name="options-outline" size={24} color="#666" />
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
              outputRange: [0, 300],
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
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, activeTab === tab.key && styles.filterTabActive]}
                onPress={() => switchTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.key ? '#6366f1' : '#999'}
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
                <Ionicons name="search-outline" size={20} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#999"
                />
                {searchQuery !== '' && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {activeTab === 'date' && (
              <View style={styles.dateInputRow}>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateLabel}>From</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    value={startDateFilter}
                    onChangeText={setStartDateFilter}
                    placeholderTextColor="#999"
                  />
                </View>
                <Text style={styles.dateSeparator}>~</Text>
                <View style={styles.dateInputWrapper}>
                  <Text style={styles.dateLabel}>To</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    value={endDateFilter}
                    onChangeText={setEndDateFilter}
                    placeholderTextColor="#999"
                  />
                </View>
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
          </Animated.View>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFilterButton} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
              <Text style={styles.clearFilterText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {diaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notes yet</Text>
          <Text style={styles.emptySubText}>Tap the + button to create your first note!</Text>
          <Text style={styles.emptySubText}>AI will analyze your emotions 🤖</Text>
        </View>
      ) : filteredDiaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found</Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFilterLink}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredDiaries}
          renderItem={renderDiaryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}



<Modal
  animationType="slide"
  visible={modalVisible}
  presentationStyle="pageSheet"
  onRequestClose={closeModal}
  statusBarTranslucent={Platform.OS === 'android'}
>
  <View style={{ flex: 1, backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 }}>
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'white' }} />
    <View style={styles.modalHeader}>
      <TouchableOpacity onPress={closeModal} disabled={isAnalyzing}>
        <Text style={[styles.cancelButton, isAnalyzing && styles.disabled]}>
          Cancel
        </Text>
      </TouchableOpacity>

      <Text style={styles.modalTitle}>
        {currentDiary ? 'Edit Note' : 'New Note'}
      </Text>

      <TouchableOpacity
        onPress={currentDiary ? updateDiary : addDiary}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <ActivityIndicator color="#6366f1" />
        ) : (
          <Text style={styles.saveButton}>Save</Text>
        )}
      </TouchableOpacity>
    </View>

    {isAnalyzing && (
      <View style={styles.analyzingBanner}>
        <ActivityIndicator color="white" size="small" />
        <Text style={styles.analyzingText}>Analyzing emotions...</Text>
      </View>
    )}

    <ScrollView
      style={styles.modalContent}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        style={styles.titleInput}
        placeholder="Enter title"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
        editable={!isAnalyzing}
      />
      <TextInput
        style={styles.contentInput}
        placeholder="How was your day? AI will analyze your emotions!"
        placeholderTextColor="#999"
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
        editable={!isAnalyzing}
      />
    </ScrollView>

    {currentDiary && (
      <SafeAreaView edges={['bottom']} style={styles.deleteContainer}>
        <TouchableOpacity
          style={styles.deleteButtonModal}
          onPress={() => deleteDiary(currentDiary.id)}
          disabled={isAnalyzing}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )}
  </View>
</Modal>

{/* Settings Modal */}
<Modal
  animationType="slide"
  visible={settingsVisible}
  presentationStyle="pageSheet"
  onRequestClose={() => setSettingsVisible(false)}
  statusBarTranslucent={Platform.OS === 'android'}
>
  <View style={{ flex: 1, backgroundColor: '#f9f5f5', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 }}>
    <SafeAreaView edges={['top']} style={{ backgroundColor: '#f9f5f5' }} />

    <View style={styles.settingsHeader}>
      <TouchableOpacity onPress={() => setSettingsVisible(false)}>
        <Ionicons name="chevron-down" size={28} color="#333" />
      </TouchableOpacity>
      <Text style={styles.settingsTitle}>Settings</Text>
      <View style={{ width: 28 }} />
    </View>

    <ScrollView style={styles.settingsContent}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileIcon}>
          <Ionicons name="person" size={32} color="#6366f1" />
        </View>
        <View style={styles.profileInfo}>
          {isEditingName ? (
            <TextInput
              style={styles.profileNameInput}
              value={userName}
              onChangeText={handleNameChange}
              onBlur={handleNameSubmit}
              onSubmitEditing={handleNameSubmit}
              autoFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setIsEditingName(true)}>
              <Text style={styles.profileName}>{userName}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.profileDate}>Started {startDate}</Text>
        </View>
      </View>

      {/* Reminder Toggle */}
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Daily Reminder</Text>
          <Text style={styles.settingDescription}>Get notified to write your note</Text>
        </View>
        <Switch
          value={reminderEnabled}
          onValueChange={handleReminderToggle}
          trackColor={{ false: '#e0e0e0', true: '#6366f1' }}
          thumbColor="white"
        />
      </View>

      {/* Reminder Times */}
      <View style={[styles.settingItemColumn, !reminderEnabled && styles.settingDisabled]}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Reminder Times</Text>
          <Text style={styles.settingDescription}>
            {reminderTimes.length} reminder{reminderTimes.length !== 1 ? 's' : ''} set
          </Text>
        </View>

        <View style={styles.timeChipsContainer}>
          {reminderTimes.map((time) => (
            <View key={time} style={styles.timeChip}>
              <Ionicons name="time-outline" size={14} color="#6366f1" />
              <Text style={styles.timeChipText}>{time}</Text>
              {reminderEnabled && (
                <TouchableOpacity
                  onPress={() => removeReminderTime(time)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {reminderEnabled && (
            <TouchableOpacity style={styles.addTimeButton} onPress={openTimePicker}>
              <Ionicons name="add" size={18} color="#6366f1" />
              <Text style={styles.addTimeText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {showTimePicker && reminderEnabled && (
          <Animated.View style={[
            styles.pickerContainer,
            {
              maxHeight: pickerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 250],
              }),
              opacity: pickerAnim,
            },
          ]}>
            <Text style={styles.pickerLabel}>Hour</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {hours.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.pickerChip, pickerHour === h && styles.pickerChipSelected]}
                  onPress={() => setPickerHour(h)}
                >
                  <Text style={[styles.pickerChipText, pickerHour === h && styles.pickerChipTextSelected]}>
                    {String(h).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.pickerLabel}>Minute</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
            >
              {minutes.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerChip, pickerMinute === m && styles.pickerChipSelected]}
                  onPress={() => setPickerMinute(m)}
                >
                  <Text style={[styles.pickerChipText, pickerMinute === m && styles.pickerChipTextSelected]}>
                    {String(m).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.pickerActions}>
              <Text style={styles.pickerPreview}>
                {String(pickerHour).padStart(2, '0')}:{String(pickerMinute).padStart(2, '0')}
              </Text>
              <View style={styles.pickerButtons}>
                <TouchableOpacity style={styles.pickerCancelBtn} onPress={closeTimePicker}>
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerDoneBtn} onPress={addReminderTime}>
                  <Text style={styles.pickerDoneText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Notification Preview */}
      <View style={[styles.settingItem, styles.settingItemColumn, !reminderEnabled && styles.settingDisabled]}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Notification Message</Text>
          <Text style={styles.settingDescription}>Customize your reminder text</Text>
        </View>
        <TextInput
          style={styles.previewInput}
          value={notificationPreview}
          onChangeText={handlePreviewChange}
          placeholder="Enter notification message"
          placeholderTextColor="#999"
          editable={reminderEnabled}
        />
      </View>

      {/* Privacy & Data Section */}
      <Text style={styles.sectionHeader}>Privacy & Data</Text>

      {/* AI Analysis Toggle */}
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>AI Emotion Analysis</Text>
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
          <Text style={styles.settingLabel}>Privacy Policy</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      {/* Delete All Data */}
      <TouchableOpacity style={styles.deleteDataButton} onPress={handleDeleteAllData}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
        <Text style={styles.deleteDataText}>Delete All Data</Text>
      </TouchableOpacity>

      {/* Logout */}
      {onLogout && (
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: onLogout },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  </View>
</Modal>

{/* Privacy Policy Modal */}
<Modal
  animationType="slide"
  visible={showPrivacyPolicy}
  presentationStyle="pageSheet"
  onRequestClose={() => setShowPrivacyPolicy(false)}
  statusBarTranslucent={Platform.OS === 'android'}
>
  <View style={{ flex: 1, backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 }}>
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'white' }} />
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
  </View>
</Modal>

    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  diaryCountText: {
    color: '#999',
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
    backgroundColor: '#6366f1',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  clearFilterLink: {
    fontSize: 14,
    color: '#6366f1',
    marginTop: 12,
  },
  // Filter panel styles
  filterPanel: {
    backgroundColor: 'white',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    backgroundColor: '#f5f5f5',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#f0f0ff',
  },
  filterTabText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  filterTabContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    color: '#333',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  dateSeparator: {
    marginHorizontal: 12,
    fontSize: 16,
    color: '#999',
    marginTop: 16,
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
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
  },
  emotionChipEmoji: {
    fontSize: 16,
  },
  emotionChipLabel: {
    fontSize: 13,
    color: '#666',
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
    color: '#ef4444',
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  diaryItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    height: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  diaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  diaryDate: {
    fontSize: 12,
    color: '#999',
  },
  emotionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emotionEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  emotionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  diaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  diaryContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
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
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  analyzingBanner: {
    backgroundColor: '#6366f1',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    color: 'white',
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
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  contentInput: {
    fontSize: 16,
    flex: 1,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  deleteContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'white',
  },
  deleteButtonModal: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '500',
  },
  // Settings styles
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  settingsContent: {
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  profileNameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#6366f1',
  },
  profileDate: {
    fontSize: 13,
    color: '#999',
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
  settingItemColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#999',
  },
  settingDisabled: {
    opacity: 0.5,
  },
  previewInput: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    marginTop: 12,
    color: '#333',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  deleteDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 8,
  },
  deleteDataText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 32,
    gap: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  // Time picker styles
  timeChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  timeChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    gap: 4,
  },
  addTimeText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  pickerContainer: {
    marginTop: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 6,
    marginTop: 4,
  },
  pickerScroll: {
    marginBottom: 8,
  },
  pickerScrollContent: {
    gap: 6,
    paddingRight: 12,
  },
  pickerChip: {
    width: 42,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ececec',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerChipSelected: {
    backgroundColor: '#6366f1',
  },
  pickerChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  pickerChipTextSelected: {
    color: 'white',
    fontWeight: '700',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  pickerPreview: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366f1',
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickerCancelText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  pickerDoneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  pickerDoneText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  // Privacy Policy Modal
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