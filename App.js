
import React, { useState, useEffect } from 'react';
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
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

// ⚠️ emotionAnalysis.js 파일을 utils 폴더에 넣으세요!
// 프로젝트 구조: MyDiary/utils/emotionAnalysis.js
import { analyzeEmotion, emotionToEmoji, emotionToColor } from './utils/emotionAnalysis';
export default function App() {
  // State management
  const [diaries, setDiaries] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDiary, setCurrentDiary] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false); // 감정 분석 중

  // Load diaries when app starts
  useEffect(() => {
    loadDiaries();
  }, []);

  // Load diaries from AsyncStorage
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

  // Save diaries to AsyncStorage
  const saveDiaries = async (newDiaries) => {
    try {
      await AsyncStorage.setItem('diaries', JSON.stringify(newDiaries));
    } catch (error) {
      console.error('Failed to save diaries:', error);
    }
  };

  // Add new diary with emotion analysis
  const addDiary = async () => {
    if (title.trim() === '' || content.trim() === '') {
      Alert.alert('Notice', 'Please enter both title and content!');
      return;
    }

    setIsAnalyzing(true);

    try {
      // 감정 분석 실행!
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
      
      Alert.alert('Success', `Diary saved!\nDetected emotion: ${emotion} ${emoji}`);
    } catch (error) {
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to analyze emotion, but diary saved!');
      
      // 에러가 나도 일기는 저장 (감정 없이)
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

  // Update diary
  const updateDiary = async () => {
    if (title.trim() === '' || content.trim() === '') {
      Alert.alert('Notice', 'Please enter both title and content!');
      return;
    }

    setIsAnalyzing(true);

    try {
      // 수정할 때도 감정 재분석
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
      
      Alert.alert('Success', `Diary updated!\nDetected emotion: ${emotion} ${emoji}`);
    } catch (error) {
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to analyze emotion, but diary updated!');
    }
  };

  // Delete diary
  const deleteDiary = (id) => {
    Alert.alert(
      'Delete Confirmation',
      'Are you sure you want to delete this diary?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newDiaries = diaries.filter(diary => diary.id !== id);
            setDiaries(newDiaries);
            saveDiaries(newDiaries);
            Alert.alert('Deleted', 'Diary has been deleted 🗑️');
          },
        },
      ]
    );
  };

  // Open edit modal
  const openEditModal = (diary) => {
    setCurrentDiary(diary);
    setTitle(diary.title);
    setContent(diary.content);
    setModalVisible(true);
  };

  // Open new diary modal
  const openNewModal = () => {
    setCurrentDiary(null);
    setTitle('');
    setContent('');
    setModalVisible(true);
  };

  // Close modal
  const closeModal = () => {
    setModalVisible(false);
    setTitle('');
    setContent('');
    setCurrentDiary(null);
  };

  // Render diary item with emotion
  const renderDiaryItem = ({ item }) => (
    <View style={[
      styles.diaryItem,
      { borderLeftWidth: 4, borderLeftColor: emotionToColor(item.emotion) }
    ]}>
      <View style={styles.diaryHeader}>
        <Text style={styles.diaryDate}>{item.date}</Text>
        <View style={styles.emotionContainer}>
          <Text style={styles.emotionEmoji}>{item.emoji}</Text>
          <Text style={styles.emotionText}>{item.emotion}</Text>
        </View>
      </View>
      <Text style={styles.diaryTitle}>{item.title}</Text>
      <Text style={styles.diaryContent} numberOfLines={3}>
        {item.content}
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => deleteDiary(item.id)}
        >
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
<View style={styles.header}>
  {/* 제목 + 그라데이션 */}
  <MaskedView
    maskElement={
      <Text style={[styles.headerTitle, { backgroundColor: 'transparent' }]}>
        BetterDiary
      </Text>
    }
  >
    <LinearGradient
      colors={['#5A6CFF', '#8B3DFF']} // 원하는 그라데이션 색상
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      <Text style={[styles.headerTitle, { opacity: 0 }]}>
        BetterDiary
      </Text>
    </LinearGradient>
  </MaskedView>

  {/* 오른쪽 다이어리 개수 */}
  <View style={styles.diaryCountContainer}>
    <Text style={styles.diaryCountText}>{diaries.length} diaries</Text>
  </View>
</View>


      {/* Diary List */}
      {diaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No diaries yet</Text>
          <Text style={styles.emptySubText}>Tap the + button to create your first diary!</Text>
          <Text style={styles.emptySubText}>AI will analyze your emotions 🤖</Text>
        </View>
      ) : (
        <FlatList
          data={diaries}
          renderItem={renderDiaryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Add New Diary Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={openNewModal}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal} disabled={isAnalyzing}>
              <Text style={[styles.cancelButton, isAnalyzing && styles.disabled]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {currentDiary ? 'Edit Diary' : 'New Diary'}
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
              <Text style={styles.analyzingText}>Analyzing emotions... 🤖</Text>
            </View>
          )}

          <ScrollView style={styles.modalContent}>
            <TextInput
              style={styles.titleInput}
              placeholder="Enter title"
              value={title}
              onChangeText={setTitle}
              editable={!isAnalyzing}
            />
            <TextInput
              style={styles.contentInput}
              placeholder="How was your day? AI will analyze your emotions!"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              editable={!isAnalyzing}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Styles
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
  // fontFamily: '원하는 커스텀 폰트', // 필요시 설정
},
diaryCountContainer: {
  backgroundColor: '#6366f1',
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 4,
},
diaryCountText: {
  color: 'white',
  fontWeight: '600',
  fontSize: 14,
},

  headerSubtitle: {
    fontSize: 12,
    color: '#8B3DFF',  
    textAlign: 'center',
    opacity: 0.9,
    marginTop: 4,
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
  listContainer: {
    padding: 16,
  },
  diaryItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    gap: 6,
  },
  emotionEmoji: {
    fontSize: 20,
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
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButton: {
    backgroundColor: '#6366f1',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
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
    gap: 8,
  },
  analyzingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
    minHeight: 300,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
});