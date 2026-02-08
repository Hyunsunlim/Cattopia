
// const API_URL =
//   "http://192.168.219.105:8000/analyze";



const API_URL = "https://satirically-prebendal-lakendra.ngrok-free.dev/analyze";

export async function analyzeEmotion(text) {
  const response = await fetch(API_URL, {
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
  return data.emotion; // 👈 App.js가 기대하는 값
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
