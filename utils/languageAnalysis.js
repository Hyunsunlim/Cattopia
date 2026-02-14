// Korean stopwords to exclude from word frequency
const STOPWORDS = new Set([
  '그', '이', '저', '것', '수', '등', '때', '중', '더', '안', '잘', '또',
  '좀', '및', '를', '을', '에', '의', '가', '은', '는', '와', '과', '도',
  '로', '으로', '에서', '부터', '까지', '이나', '나', '다', '고', '하고',
  '해서', '했다', '한다', '하다', '있다', '없다', '되다', '않다',
  '그리고', '하지만', '그래서', '그런데', '그러나', '그래도',
]);

// 5 expression style patterns (neutral/positive framing)
const STYLE_PATTERNS = [
  {
    key: 'thoughtful',
    label: 'Thoughtful',
    emoji: '🪞',
    color: '#f59e0b',
    keywords: [
      '아닌가', '아닌데', '모르겠지만', '틀릴 수도', '확실하진 않지만',
      '말해도 될지', '이상하겠지만', '별거 아닌데', '괜히', '쓸데없이',
      '그냥 넘어가', '말 안 해야', '입 다물', '참아야', '말하면 안',
      '내가 뭐라고', '감히', '주제넘', '조심해야', '눈치',
    ],
    description: 'You think carefully before expressing yourself',
  },
  {
    key: 'humble',
    label: 'Humble',
    emoji: '🌱',
    color: '#10b981',
    keywords: [
      '나는 못', '나는 안 돼', '내가 부족', '내 탓', '내가 잘못',
      '역시 나는', '한심', '멍청', '바보', '쓸모없',
      '가치 없', '무능', '최악', '형편없', '못난',
      '왜 이렇게 못', '나만 못', '다 내 잘못', '나는 항상', '역시 안 돼',
    ],
    description: 'You hold yourself to a modest standard',
  },
  {
    key: 'composed',
    label: 'Composed',
    emoji: '🧊',
    color: '#64748b',
    keywords: [
      '괜찮아', '아무렇지', '상관없어', '별거 아니야', '신경 안 써',
      '그냥 그래', '뭐 어때', '대수롭지', '감정이 없', '느낌이 없',
      '무감각', '상관없', '어차피', '아무 생각', '그냥 넘기',
      '잊어버리자', '생각하지 말자', '몰라 그냥', '됐어', '넘어가자',
    ],
    description: 'You stay steady and measured in expression',
  },
  {
    key: 'goalDriven',
    label: 'Goal-Driven',
    emoji: '🎯',
    color: '#8b5cf6',
    keywords: [
      '완벽하게', '실수하면 안', '100%', '부족해', '더 잘해야',
      '아직 부족', '만족 못', '충분하지 않', '왜 완벽하지', '더 노력',
      '최고가 아니면', '실패', '안 되면', '제대로 못', '꼼꼼하게',
      '빈틈없이', '허용할 수 없', '다시 해야', '마음에 안 들', '아쉬워',
    ],
    description: 'You set high standards and strive to improve',
  },
  {
    key: 'empathetic',
    label: 'Empathetic',
    emoji: '💛',
    color: '#3b82f6',
    keywords: [
      '다른 사람이', '남들은', '눈치 보', '싫어하면', '미움받',
      '기대에', '실망시키', '인정받', '남들 생각', '비교',
      '뒤처지', '평가', '시선이', '어떻게 보', '남한테',
      '다들 그런데 나만', '사람들이 뭐라', '욕먹', '피해 주', '맞춰야',
    ],
    description: 'You are attuned to how others feel',
  },
];

/**
 * Extract meaningful Korean words (2+ chars, not stopwords)
 */
function extractWords(text) {
  const tokens = text.replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Extract phrases (2-3 word ngrams)
 */
function extractPhrases(text) {
  const tokens = text.replace(/[^\uAC00-\uD7A3\s]/g, ' ').split(/\s+/).filter(Boolean);
  const phrases = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].length >= 1 && tokens[i + 1].length >= 1) {
      phrases.push(tokens[i] + ' ' + tokens[i + 1]);
    }
    if (i < tokens.length - 2 && tokens[i + 2].length >= 1) {
      phrases.push(tokens[i] + ' ' + tokens[i + 1] + ' ' + tokens[i + 2]);
    }
  }
  return phrases;
}

/**
 * Count frequency of items in array, return sorted top N
 */
function topN(arr, n) {
  const freq = {};
  arr.forEach(item => { freq[item] = (freq[item] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Calculate style pattern scores from text
 */
function calcStyleScores(text) {
  const textLength = text.length;
  if (textLength === 0) return STYLE_PATTERNS.map(p => ({ ...p, score: 0 }));

  return STYLE_PATTERNS.map(pattern => {
    let matchCount = 0;
    for (const keyword of pattern.keywords) {
      const regex = new RegExp(keyword, 'g');
      const matches = text.match(regex);
      if (matches) matchCount += matches.length;
    }
    const raw = (matchCount / textLength) * 1000;
    return { ...pattern, score: Math.min(100, Math.round(raw)) };
  });
}

/**
 * Analyze all language patterns from notes (last 7 days)
 */
export function analyzeLanguagePatterns(notes) {
  const empty = {
    topWords: [],
    topPhrases: [],
    styleScores: STYLE_PATTERNS.map(p => ({ ...p, score: 0 })),
    summary: '',
    noteCount: 0,
  };

  if (!notes || notes.length === 0) return empty;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentNotes = notes.filter(note => {
    const noteDate = new Date(note.timestamp);
    return noteDate >= sevenDaysAgo;
  });

  if (recentNotes.length === 0) return empty;

  const allText = recentNotes.map(n => n.content).join('\n');

  // 1. Top words (3)
  const words = extractWords(allText);
  const topWords = topN(words, 3);

  // 2. Top phrases (3)
  const phrases = extractPhrases(allText);
  const topPhrases = topN(phrases, 3);

  // 3. Style pattern scores
  const styleScores = calcStyleScores(allText);

  // 4. Summary
  const summary = generateSummary({ topWords, topPhrases, styleScores, noteCount: recentNotes.length });

  return {
    topWords,
    topPhrases,
    styleScores,
    summary,
    noteCount: recentNotes.length,
  };
}

/**
 * Generate a short natural-language summary of writing style
 */
function generateSummary({ topWords, topPhrases, styleScores, noteCount }) {
  const parts = [];

  parts.push(`Based on ${noteCount} note${noteCount > 1 ? 's' : ''} from this week:`);

  if (topWords.length > 0) {
    const top = topWords.slice(0, 3).map(w => `"${w.word}"`).join(', ');
    parts.push(`Your most-used words are ${top}.`);
  }

  const dominant = [...styleScores].sort((a, b) => b.score - a.score)[0];
  if (dominant && dominant.score > 0) {
    parts.push(`Your strongest expression style is "${dominant.label}" \u2014 ${dominant.description.toLowerCase()}.`);
  }

  if (parts.length <= 1) {
    parts.push('Keep writing to discover more about your unique style!');
  }

  return parts.join(' ');
}
