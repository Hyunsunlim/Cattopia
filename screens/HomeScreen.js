import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';

import { analyzeEmotion, emotionToEmoji, emotionToColor } from '../utils/emotionAnalysis';

export default function HomeScreen({ navigation, route }) {
  const [diaries, setDiaries] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
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

  const insets = useSafeAreaInsets();

  // Animation refs
  const panelHeight = useRef(new Animated.Value(0)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;
  const contentInputRef = useRef(null);


  useEffect(() => {
    loadDiaries();
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
            closeModal();
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
              onPress={() => navigation.navigate('Settings')}
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
  <KeyboardAvoidingView
    style={{ flex: 1, backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 }}
    behavior="padding"
    keyboardVerticalOffset={insets.top - 20}
  >
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

    <View style={styles.modalContent}>
      <TextInput
        style={styles.titleInput}
        placeholder="Enter title"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
        editable={!isAnalyzing}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => contentInputRef.current?.focus()}
      />
      <TextInput
        ref={contentInputRef}
        style={styles.contentInput}
        placeholder="How was your day? AI will analyze your emotions!"
        placeholderTextColor="#999"
        value={content}
        onChangeText={setContent}
        multiline
        scrollEnabled={true}
        textAlignVertical="top"
        editable={!isAnalyzing}
      />
    </View>

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
  </KeyboardAvoidingView>
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
    flex: 1,
    fontSize: 16,
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
});