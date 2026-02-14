import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { emotionToColor } from '../utils/emotionAnalysis';
import { analyzeLanguagePatterns } from '../utils/languageAnalysis';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { LineChart, StackedBarChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function InsightScreen() {
  const [diaries, setDiaries] = useState([]);
  const [emotionStats, setEmotionStats] = useState({});
  const [activeTab, setActiveTab] = useState('emotion');
  const [langData, setLangData] = useState({
    topWords: [],
    topPhrases: [],
    styleScores: [],
    summary: '',
    noteCount: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadDiaries();
    }, [])
  );

  const loadDiaries = async () => {
    try {
      const savedDiaries = await AsyncStorage.getItem('diaries');
      if (savedDiaries !== null) {
        const parsedDiaries = JSON.parse(savedDiaries);
        setDiaries(parsedDiaries);
        calculateEmotionStats(parsedDiaries);
        setLangData(analyzeLanguagePatterns(parsedDiaries));
      }
    } catch (error) {
      console.error('Failed to load diaries:', error);
    }
  };

  const calculateEmotionStats = (diaryList) => {
    const stats = {};
    diaryList.forEach(diary => {
      const emotion = diary.emotion || 'neutral';
      stats[emotion] = (stats[emotion] || 0) + 1;
    });
    setEmotionStats(stats);
  };

  const getTotalDiaries = () => diaries.length;

  const getMostCommonEmotion = () => {
    if (Object.keys(emotionStats).length === 0) return { emotion: 'neutral', count: 0, emoji: '😐' };
    const sorted = Object.entries(emotionStats).sort((a, b) => b[1] - a[1]);
    const [emotion, count] = sorted[0];
    const emojiMap = {
      joy: '😊', sadness: '😢', anger: '😠', fear: '😨',
      surprise: '😮', disgust: '🤢', neutral: '😐', uncertain: '🤔',
    };
    return { emotion, count, emoji: emojiMap[emotion] || '😐' };
  };

  const getEmotionPercentage = (emotion) => {
    const total = getTotalDiaries();
    if (total === 0) return 0;
    return ((emotionStats[emotion] || 0) / total * 100).toFixed(1);
  };

  const emotionToScore = (emotion) => {
    const map = { joy: 1, surprise: 0.5, neutral: 0, uncertain: -0.2, fear: -0.6, sadness: -0.8, disgust: -0.9, anger: -1 };
    return map[emotion] ?? 0;
  };

  const getChartData = () => {
    if (diaries.length < 2) return null;

    const sorted = [...diaries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const firstDate = new Date(sorted[0].timestamp);
    const now = new Date();
    const daysDiff = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24));
    const isMonthly = daysDiff >= 90;

    if (isMonthly) {
      const monthMap = {};
      sorted.forEach(d => {
        const date = new Date(d.timestamp);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) monthMap[key] = [];
        monthMap[key].push(emotionToScore(d.emotion));
      });
      const keys = Object.keys(monthMap).sort();
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return {
        labels: keys.map(k => monthNames[parseInt(k.split('-')[1]) - 1]),
        datasets: [{ data: keys.map(k => monthMap[k].reduce((a, b) => a + b, 0) / monthMap[k].length) }],
        isMonthly: true,
      };
    } else {
      const dayMap = {};
      sorted.forEach(d => {
        const date = new Date(d.timestamp);
        const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        if (!dayMap[key]) dayMap[key] = [];
        dayMap[key].push(emotionToScore(d.emotion));
      });
      const keys = Object.keys(dayMap);
      return {
        labels: keys,
        datasets: [{ data: keys.map(k => dayMap[k].reduce((a, b) => a + b, 0) / dayMap[k].length) }],
        isMonthly: false,
      };
    }
  };

  const mostCommon = getMostCommonEmotion();
  const chartData = getChartData();

  // ======= EMOTION TAB =======
  const renderEmotionTab = () => (
    <>
      <View style={styles.statsContainer}>
        <View style={styles.statCardWrapper}>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={32} color="#6366f1" />
            <Text style={styles.statValue}>{getTotalDiaries()}</Text>
            <Text style={styles.statLabel}>Total Notes</Text>
          </View>
        </View>
        <View style={styles.statCardWrapperRight}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{mostCommon.emoji}</Text>
            <Text style={styles.statValue}>{mostCommon.count}</Text>
            <Text style={styles.statLabel}>Most Common</Text>
            <Text style={styles.statEmotion}>{mostCommon.emotion}</Text>
          </View>
        </View>
      </View>

      {/* Sentiment Timeline Chart */}
      <View style={styles.section}>
        <View style={styles.cardHeader}>
          <Ionicons name="trending-up-outline" size={20} color="#6366f1" />
          <Text style={styles.sectionTitle}>Sentiment Trend</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          {chartData ? (chartData.isMonthly ? 'Monthly average' : 'Daily average') + ' mood score' : 'Mood score over time'}
        </Text>
        <View style={styles.card}>
          {chartData ? (
            <LineChart
              data={{
                labels: chartData.labels.length > 7
                  ? chartData.labels.filter((_, i) => i % Math.ceil(chartData.labels.length / 7) === 0)
                  : chartData.labels,
                datasets: chartData.datasets,
              }}
              width={screenWidth - 72}
              height={180}
              yAxisSuffix=""
              fromZero={false}
              segments={4}
              formatYLabel={(v) => parseFloat(v).toFixed(1)}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                labelColor: () => '#999',
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#6366f1',
                },
                propsForBackgroundLines: {
                  strokeDasharray: '4,4',
                  stroke: '#f0f0f0',
                },
                style: { borderRadius: 12 },
              }}
              bezier
              style={{ borderRadius: 12, marginLeft: -8 }}
            />
          ) : (
            <View style={styles.emptyChart}>
              <Ionicons name="analytics-outline" size={32} color="#ddd" />
              <Text style={styles.emptyChartText}>Write 2+ notes to see trends</Text>
            </View>
          )}
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Positive</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#999' }]} />
              <Text style={styles.legendText}>Neutral</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Negative</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Compact Emotion Distribution */}
      <View style={styles.section}>
        <View style={styles.cardHeader}>
          <Ionicons name="pie-chart-outline" size={20} color="#6366f1" />
          <Text style={styles.sectionTitle}>Emotion Distribution</Text>
        </View>
        <View style={styles.card}>
          {Object.keys(emotionStats).length > 0 ? (
            Object.entries(emotionStats)
              .sort((a, b) => b[1] - a[1])
              .map(([emotion, count]) => {
                const emojiMap = {
                  joy: '😊', sadness: '😢', anger: '😠', fear: '😨',
                  surprise: '😮', disgust: '🤢', neutral: '😐', uncertain: '🤔',
                };
                const percentage = getEmotionPercentage(emotion);
                return (
                  <View key={emotion} style={styles.emotionRow}>
                    <Text style={styles.emotionEmoji}>{emojiMap[emotion]}</Text>
                    <Text style={styles.emotionName}>{emotion}</Text>
                    <View style={styles.barContainer}>
                      <View
                        style={[styles.barFill, {
                          width: `${percentage}%`,
                          backgroundColor: emotionToColor(emotion),
                        }]}
                      />
                    </View>
                    <Text style={styles.emotionPercent}>{percentage}%</Text>
                  </View>
                );
              })
          ) : (
            <View style={styles.emptyChart}>
              <Ionicons name="pie-chart-outline" size={32} color="#ddd" />
              <Text style={styles.emptyChartText}>No emotion data yet</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Entries</Text>
        {diaries.length > 0 ? (
          diaries.slice(0, 5).map((diary) => (
            <View key={diary.id} style={styles.recentCard}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentDate}>{diary.date}</Text>
                <Text style={styles.recentEmoji}>{diary.emoji}</Text>
              </View>
              <Text style={styles.recentTitle}>{diary.title}</Text>
              <Text style={styles.recentContent} numberOfLines={2}>{diary.content}</Text>
            </View>
          ))
        ) : (
          <View style={styles.card}>
            <View style={styles.emptyChart}>
              <Ionicons name="document-text-outline" size={32} color="#ddd" />
              <Text style={styles.emptyChartText}>No entries yet</Text>
            </View>
          </View>
        )}
      </View>
    </>
  );

  // ======= LANGUAGE TAB =======
  const hasData = langData.noteCount > 0;
  const styleMax = hasData && langData.styleScores.length > 0
    ? Math.max(...langData.styleScores.map(s => s.score), 1)
    : 1;

  const getAvgWordCount = () => {
    if (diaries.length === 0) return 0;
    const total = diaries.reduce((sum, d) => sum + (d.content || '').split(/\s+/).filter(Boolean).length, 0);
    return Math.round(total / diaries.length);
  };

  const getMaturityLevel = (avg) => {
    if (avg >= 150) return { label: 'High', color: '#10b981' };
    if (avg >= 50) return { label: 'Medium', color: '#f59e0b' };
    return { label: 'Low', color: '#ef4444' };
  };

  const getWordCountChartData = () => {
    if (diaries.length < 2) return null;
    const sorted = [...diaries]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-30);
    const wordCounts = sorted.map(d => (d.content || '').split(/\s+/).filter(Boolean).length);
    const labels = sorted.map(d => {
      const date = new Date(d.timestamp);
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    });
    const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    return { labels, wordCounts, avg };
  };

  const getVocabDensityData = () => {
    if (diaries.length < 2) return null;
    const sorted = [...diaries]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-20);

    // Group by date
    const dayMap = {};
    sorted.forEach(d => {
      const date = new Date(d.timestamp);
      const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      if (!dayMap[key]) dayMap[key] = { words: [], uniqueWords: [] };
      const words = (d.content || '').split(/\s+/).filter(Boolean);
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      dayMap[key].words.push(words.length);
      dayMap[key].uniqueWords.push(uniqueWords.size);
    });

    const keys = Object.keys(dayMap);
    const displayLabels = keys.length > 7
      ? keys.map((k, i) => i % Math.ceil(keys.length / 7) === 0 ? k : '')
      : keys;

    const richness = keys.map(k => {
      const avg = dayMap[k].uniqueWords.reduce((a, b) => a + b, 0) / dayMap[k].uniqueWords.length;
      return Math.round(avg);
    });
    const wordCounts = keys.map(k => {
      const avg = dayMap[k].words.reduce((a, b) => a + b, 0) / dayMap[k].words.length;
      return Math.round(avg);
    });

    return {
      labels: displayLabels,
      data: wordCounts.map((wc, i) => [richness[i], wc - richness[i] > 0 ? wc - richness[i] : 0]),
      barColors: ['#8b5cf6', '#c4b5fd'],
    };
  };

  const avgWordCount = getAvgWordCount();
  const maturity = getMaturityLevel(avgWordCount);
  const wordCountChart = getWordCountChartData();
  const vocabData = getVocabDensityData();

  const renderLanguageTab = () => (
    <>
          {/* KPI Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCardWrapper}>
              <View style={styles.statCard}>
                <Ionicons name="book-outline" size={32} color="#6366f1" />
                <Text style={styles.statValue}>{getTotalDiaries()}</Text>
                <Text style={styles.statLabel}>Total Notes</Text>
              </View>
            </View>
            <View style={styles.statCardWrapperRight}>
              <View style={styles.statCard}>
                <Ionicons name="trending-up-outline" size={32} color={maturity.color} />
                <Text style={[styles.statValue, { color: maturity.color }]}>{maturity.label}</Text>
                <Text style={styles.statLabel}>Expression</Text>
                <Text style={styles.statEmotion}>{avgWordCount} words/note</Text>
              </View>
            </View>
          </View>

          {/* Expression Growth */}
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-up-outline" size={20} color="#6366f1" />
              <Text style={styles.sectionTitle}>Expression Growth</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              {wordCountChart ? `Words per note (last ${wordCountChart.wordCounts.length} entries)` : 'Words per note over time'}
            </Text>
            <View style={styles.card}>
              {wordCountChart ? (
                <LineChart
                  data={{
                    labels: wordCountChart.labels.length > 7
                      ? wordCountChart.labels.filter((_, i) => i % Math.ceil(wordCountChart.labels.length / 7) === 0)
                      : wordCountChart.labels,
                    datasets: [
                      { data: wordCountChart.wordCounts },
                    ],
                  }}
                  width={screenWidth - 72}
                  height={180}
                  yAxisSuffix=""
                  fromZero
                  segments={4}
                  chartConfig={{
                    backgroundColor: '#fff',
                    backgroundGradientFrom: '#fff',
                    backgroundGradientTo: '#fff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                    labelColor: () => '#999',
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#6366f1',
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: '4,4',
                      stroke: '#f0f0f0',
                    },
                  }}
                  bezier
                  style={{ borderRadius: 12, marginLeft: -8 }}
                />
              ) : (
                <View style={styles.emptyChart}>
                  <Ionicons name="trending-up-outline" size={32} color="#ddd" />
                  <Text style={styles.emptyChartText}>Write 2+ notes to see trends</Text>
                </View>
              )}
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#6366f1' }]} />
                  <Text style={styles.legendText}>Complexity</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Vocabulary & Writing Density */}
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Ionicons name="library-outline" size={20} color="#8b5cf6" />
              <Text style={styles.sectionTitle}>Vocabulary & Writing Density</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Unique words (vocabulary) and total words (density)
            </Text>
            <View style={styles.card}>
              {vocabData ? (
                <StackedBarChart
                  data={{
                    labels: vocabData.labels,
                    legend: ['Vocabulary', 'Density'],
                    data: vocabData.data,
                    barColors: vocabData.barColors,
                  }}
                  width={screenWidth - 72}
                  height={200}
                  chartConfig={{
                    backgroundColor: '#fff',
                    backgroundGradientFrom: '#fff',
                    backgroundGradientTo: '#fff',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                    labelColor: () => '#999',
                    propsForBackgroundLines: {
                      strokeDasharray: '4,4',
                      stroke: '#f0f0f0',
                    },
                    barPercentage: 0.6,
                  }}
                  style={{ borderRadius: 12, marginLeft: -8 }}
                  hideLegend={true}
                />
              ) : (
                <View style={styles.emptyChart}>
                  <Ionicons name="library-outline" size={32} color="#ddd" />
                  <Text style={styles.emptyChartText}>Write 2+ notes to see density</Text>
                </View>
              )}
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                  <Text style={styles.legendText}>Vocabulary (unique)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#c4b5fd' }]} />
                  <Text style={styles.legendText}>Density (total)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Top 3 Words */}
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Ionicons name="text-outline" size={20} color="#6366f1" />
              <Text style={styles.sectionTitle}>Top 3 Words</Text>
            </View>
            <View style={styles.card}>
              {langData.topWords.length > 0 ? (
                langData.topWords.map(({ word, count }, i) => (
                  <View key={word} style={styles.rankRow}>
                    <Text style={styles.rankNum}>{i + 1}</Text>
                    <Text style={styles.rankWord}>{word}</Text>
                    <View style={styles.rankBarOuter}>
                      <View
                        style={[
                          styles.rankBarInner,
                          {
                            width: `${(count / langData.topWords[0].count) * 100}%`,
                            backgroundColor: '#6366f1',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.rankCount}>{count}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Not enough words yet</Text>
              )}
            </View>
          </View>

          {/* Top 3 Phrases */}
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbubbles-outline" size={20} color="#8b5cf6" />
              <Text style={styles.sectionTitle}>Top 3 Phrases</Text>
            </View>
            <View style={styles.card}>
              {langData.topPhrases.length > 0 ? (
                langData.topPhrases.map(({ word, count }, i) => (
                  <View key={word} style={styles.rankRow}>
                    <Text style={styles.rankNum}>{i + 1}</Text>
                    <Text style={[styles.rankWord, { flex: 1.5 }]} numberOfLines={1}>
                      {word}
                    </Text>
                    <View style={styles.rankBarOuter}>
                      <View
                        style={[
                          styles.rankBarInner,
                          {
                            width: `${(count / langData.topPhrases[0].count) * 100}%`,
                            backgroundColor: '#8b5cf6',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.rankCount}>{count}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Not enough phrases yet</Text>
              )}
            </View>
          </View>

          {/* 5 Expression Styles */}
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Ionicons name="prism-outline" size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Expression Styles</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Your writing tendencies from the past 7 days
            </Text>
            <View style={styles.card}>
              {langData.styleScores.map((style) => (
                <View key={style.key} style={styles.styleRow}>
                  <View style={styles.styleLabelRow}>
                    <Text style={styles.styleEmoji}>{style.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.styleName}>{style.label}</Text>
                      <Text style={styles.styleDesc}>{style.description}</Text>
                    </View>
                    <Text style={styles.styleScore}>{style.score}</Text>
                  </View>
                  <View style={styles.styleBarOuter}>
                    <View
                      style={[
                        styles.styleBarInner,
                        {
                          width: `${styleMax > 0 ? (style.score / styleMax) * 100 : 0}%`,
                          backgroundColor: style.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles-outline" size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Your Style Summary</Text>
            </View>
            <View style={styles.card}>
              {langData.summary ? (
                <Text style={styles.summaryText}>{langData.summary}</Text>
              ) : (
                <View style={styles.emptyChart}>
                  <Ionicons name="sparkles-outline" size={32} color="#ddd" />
                  <Text style={styles.emptyChartText}>No summary yet</Text>
                </View>
              )}
            </View>
          </View>
    </>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'white' }}>
        <View style={styles.headerBar}>
        {Platform.OS === 'android' ? (
          <Text style={[styles.headerTitle, { color: '#6366f1' }]}>
            Insights
          </Text>
        ) : (
          <MaskedView
            maskElement={
              <Text style={[styles.headerTitle, { backgroundColor: 'transparent' }]}>
                Insights
              </Text>
            }
          >
            <LinearGradient
              colors={['#5A6CFF', '#8B3DFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.headerTitle, { opacity: 0 }]}>
                Insights
              </Text>
            </LinearGradient>
          </MaskedView>
        )}
        <Text style={styles.diaryCountText}>{diaries.length} notes</Text>
        </View>
      </SafeAreaView>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {activeTab === 'emotion'
              ? 'Your emotional journey'
              : 'Discover your unique writing style'}
          </Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'emotion' && styles.tabActive]}
            onPress={() => setActiveTab('emotion')}
          >
            <Text style={[styles.tabText, activeTab === 'emotion' && styles.tabTextActive]}>
              Emotions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'language' && styles.tabActive]}
            onPress={() => setActiveTab('language')}
          >
            <Text style={[styles.tabText, activeTab === 'language' && styles.tabTextActive]}>
              Language
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'emotion' ? renderEmotionTab() : renderLanguageTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f5f5',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'white',
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#6366f1',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statCardWrapper: {
    width: (screenWidth - 52) / 2,
  },
  statCardWrapperRight: {
    width: (screenWidth - 52) / 2,
    marginLeft: 12,
  },
  statCard: {
    height: 140,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statEmoji: { fontSize: 32 },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  statEmotion: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  // Card
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  noDataText: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Rank rows (Top 3 words / phrases)
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankNum: {
    width: 22,
    fontSize: 15,
    fontWeight: '700',
    color: '#bbb',
  },
  rankWord: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  rankBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  rankBarInner: {
    height: '100%',
    borderRadius: 4,
  },
  rankCount: {
    width: 30,
    fontSize: 13,
    color: '#888',
    textAlign: 'right',
    fontWeight: '600',
  },
  // Style pattern rows
  styleRow: {
    marginBottom: 14,
  },
  styleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  styleEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  styleName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  styleDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  styleScore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    marginLeft: 8,
  },
  styleBarOuter: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  styleBarInner: {
    height: '100%',
    borderRadius: 3,
  },
  // Chart
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#999',
  },
  // Compact Emotion Distribution
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  emotionEmoji: { fontSize: 18, marginRight: 8 },
  emotionName: {
    width: 72,
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  barContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  emotionPercent: {
    width: 40,
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    fontWeight: '500',
  },
  // Summary
  summaryText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  // Empty
  emptyLang: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyLangTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyLangSub: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyChartText: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  // Recent entries
  recentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentDate: { fontSize: 12, color: '#999' },
  recentEmoji: { fontSize: 20 },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recentContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
