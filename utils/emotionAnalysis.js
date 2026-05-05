import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from '../services/auth';

const API_URL = "https://lucidnote-api-production-cbe8.up.railway.app/analyze";

export async function analyzeEmotion(text) {
  const useAI = await AsyncStorage.getItem('useAIAnalysis');
  if (useAI === 'true') {
    try {
      return await analyzeEmotionWithAI(text);
    } catch {
      return analyzeEmotionLocally(text);
    }
  }
  return analyzeEmotionLocally(text);
}

// Returns { emotion, failed } — failed=true if AI was attempted but fell back to local
export async function analyzeEmotionWithFallback(text) {
  const useAI = await AsyncStorage.getItem('useAIAnalysis');
  if (useAI === 'true') {
    try {
      const emotion = await analyzeEmotionWithAI(text);
      return { emotion, failed: false };
    } catch {
      return { emotion: analyzeEmotionLocally(text), failed: true };
    }
  }
  return { emotion: analyzeEmotionLocally(text), failed: false };
}

// AI-based analysis (existing logic)
async function analyzeEmotionWithAI(text) {
  const response = await authFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error("Emotion analysis failed");
  }

  const data = await response.json();
  return data.emotion;
}

// Local keyword-based analysis
function analyzeEmotionLocally(text) {
  const lowerText = text.toLowerCase();

  const keywords = {
    joy: ['happy', 'joy', 'excited', 'wonderful', 'great', 'amazing', 'love', 'perfect', 'best', 'awesome', 'glad', 'delighted', 'cheerful', 'fantastic',
      '기쁨', '행복', '좋아', '최고', '신나', '즐거', '기뻐', '좋았'],
    sadness: ['sad', 'unhappy', 'depressed', 'lonely', 'cry', 'tears', 'miss', 'hurt', 'grief', 'heartbroken', 'disappointed',
      '슬프', '우울', '외로', '눈물', '아프', '실망', '힘들'],
    anger: ['angry', 'mad', 'furious', 'hate', 'annoyed', 'irritated', 'frustrated', 'rage', 'outraged',
      '화나', '짜증', '분노', '열받', '싫어'],
    fear: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'fear', 'terrified', 'panic', 'dread',
      '무서', '걱정', '불안', '두려', '겁나'],
    surprise: ['surprised', 'shocked', 'unexpected', 'wow', 'unbelievable', 'astonished', 'amazed',
      '놀라', '깜짝', '충격', '헐', '대박'],
    disgust: ['disgusting', 'gross', 'awful', 'horrible', 'nasty', 'revolting', 'terrible',
      '역겹', '끔찍', '최악', '싫', '짜증'],
    neutral: ['okay', 'fine', 'normal', 'usual', 'regular', 'average', 'ordinary',
      '그냥', '평범', '보통', '괜찮'],
  };

  const scores = {};
  for (const [emotion, words] of Object.entries(keywords)) {
    scores[emotion] = words.filter(word => lowerText.includes(word)).length;
  }

  let maxEmotion = 'neutral';
  let maxScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion;
    }
  }

  return maxScore > 0 ? maxEmotion : 'neutral';
}

export function emotionToEmoji(emotion) {
  const map = {
    joy: "😊",
    sadness: "😢",
    anger: "😠",
    fear: "😨",
    surprise: "😮",
    disgust: "🤢",
    neutral: "😐",
    uncertain: "🤔",
  };

  return map[emotion] || "😐";
}

export function emotionToColor(emotion) {
  const map = {
    joy: "#facc15",
    sadness: "#60a5fa",
    anger: "#ef4444",
    fear: "#a855f7",
    surprise: "#f97316",
    disgust: "#22c55e",
    neutral: "#9ca3af",
    uncertain: "#6b7280",
  };

  return map[emotion] || "#9ca3af";
}
