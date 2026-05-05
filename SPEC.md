# BetterDiary — Product & Technical Specification

> 작성일: 2026-03-22
> 버전: v0.1 (초기 스펙)

---

## 1. 프로젝트 개요

**BetterDiary**는 AI 감정 분석과 글쓰기 피드백을 제공하는 일기/메모 앱입니다.
사용자가 일상을 기록하면 감정을 자동으로 분석하고, 글쓰기 패턴(인과 언어, 주체성 언어)을 시각화해 정서적 성장을 돕습니다.

- **플랫폼:** iOS / Android (React Native + Expo)
- **API 서버:** `https://lucidnote-api-production-cbe8.up.railway.app`
- **데이터 저장:** 기기 로컬 (AsyncStorage), 인증은 서버 JWT

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | React Native 0.81.5 + Expo ~54.0.33 |
| 네비게이션 | React Navigation 7 (Native Stack + Bottom Tabs) |
| 로컬 저장소 | AsyncStorage |
| 차트 | react-native-gifted-charts |
| 알림 | expo-notifications |
| 인증 | JWT (Bearer Token) + Google Sign-In (준비 중) |
| 웹 지원 | react-native-web |

---

## 3. 아키텍처 — 네비게이션 구조

```
App.js (루트)
├── 인증 미완료 → LoginScreen / SignupScreen
├── 개인정보 온보딩 Modal (최초 1회)
└── 인증 완료 → HomeStack
    ├── MainTabs (하단 탭)
    │   ├── [좌] HomeTabStack
    │   │   ├── LandingScreen        — 카테고리 선택 / 진입
    │   │   ├── CategoryListScreen   — 카테고리 관리 (CRUD)
    │   │   ├── HomeScreen           — 일기 목록 / 작성 / 수정
    │   │   └── InsightDetailScreen  — 감정·트렌드 상세
    │   ├── [중앙] 새 일기 작성 (+) 버튼
    │   └── [우] InsightScreen       — 분석 대시보드
    ├── SettingsScreen
    ├── RemindersScreen
    ├── MessagesScreen
    ├── ProfileScreen
    └── DataPrivacyScreen
```

---

## 4. 화면 목록

### 인증
| 화면 | 기능 |
|------|------|
| LoginScreen | 이메일/사용자명 + 비밀번호 로그인, Google 로그인(준비 중) |
| SignupScreen | 사용자명 + 이메일 + 비밀번호 회원가입 |

### 핵심 기능
| 화면 | 기능 |
|------|------|
| LandingScreen | 카테고리 선택, 빠른 일기 진입 |
| CategoryListScreen | 카테고리 CRUD, 이모지·색상 설정, 메모 수 표시 |
| HomeScreen | 일기 목록/작성/수정/삭제, 감정 분석, 태그, AI 피드백 |
| InsightScreen | 감정 분포 차트, 무드 캘린더, 글쓰기 언어 분석, 태그 분석 |
| InsightDetailScreen | 일별 감정 상세, 확장 뷰 |

### 설정
| 화면 | 기능 |
|------|------|
| SettingsScreen | 설정 메뉴 허브 |
| RemindersScreen | 다중 시간 알림 스케줄 설정 |
| MessagesScreen | 자동/커스텀 알림 메시지 선택 |
| ProfileScreen | 이름 편집, 앱 시작일 |
| DataPrivacyScreen | AI 분석 on/off 토글, 개인정보처리방침 |

---

## 5. 기능 명세

### 5-1. 인증
- 이메일 또는 사용자명으로 로그인
- JWT 토큰 AsyncStorage 저장 (`auth_token`)
- `authFetch()` 유틸리티로 모든 API 요청에 Bearer 토큰 자동 첨부
- 로그아웃 시 토큰 제거 및 로그인 화면으로 이동

### 5-2. 일기/노트
- 제목 + 본문 자유 텍스트 작성
- 생성/수정/삭제 (CRUD)
- 카테고리 소속 (기본: "diary")
- 태그 다중 부착, 기존 태그 자동 제안
- 작성 시 자동 감정 분석 → 이모지 표시
- AI 글쓰기 피드백 (인과 언어, 주체성 언어 분석)
- KeyboardAvoidingView: iOS `padding`, Android `height`

### 5-3. 감정 분석
- **AI 분석:** `/analyze` API 호출 (AI 분석 ON 시)
- **로컬 폴백:** 키워드 기반 분석 (영어 + 한국어 지원)
- **감정 종류:** joy, sadness, anger, fear, surprise, disgust, neutral
- **이모지 매핑:** 각 감정 → 이모지
- **색상 매핑:** 각 감정 → 고유 색상 (차트 시각화용)

### 5-4. 카테고리
- 이름 + 이모지 + 색상(5가지 팔레트)으로 구성
- 생성·수정·삭제 (삭제 시 하위 노트 cascade 삭제)
- 검색 필터
- 신규 설치 시 "diary" 기본 카테고리 자동 생성
- 기존 비카테고리 노트 자동 마이그레이션

**카테고리 색상 팔레트:**
`#22c55e` · `#92400e` · `#14b8a6` · `#a855f7` · `#ec4899`

### 5-5. 인사이트 & 분석

InsightScreen은 **Emotion / Language / Activity** 3개 탭으로 구성. 공통 시간 range: `1W / 1M / 6M / ALL`.

---

#### Emotion 탭

| 섹션 | 내용 |
|------|------|
| **KPI 카드 3종** | 이번 주 평균 무드(emoji + label) / 가장 많이 나온 감정 / 지난주 대비 변화 |
| **Weekly Mood Trend** | 이번 주 Mon–Sun 일별 무드 평균 line chart (데이터 없는 날은 숨김) |
| **Mood Trend** | range 선택형 line chart (1W 일별 / 1M 5주 / 6M 월별 / ALL 주별) |
| **Weekly Comparison** | 오늘 vs 정확히 7일 전 지배적 감정 비교 |
| **Daily Patterns** | 시간대별(Morning 5–12 / Afternoon 12–17 / Evening 17–21 / Night 21–5) 지배적 감정 |
| **Emotion Distribution** | 전체 감정 비율 bar |
| **Mood Calendar** | 월별 캘린더 뷰 — 날짜별 평균 감정 이모지 표시, 월 이동 가능 |

**감정 스코어 매핑 (`emotionToScore`):**

| 감정 | 점수 |
|------|------|
| joy | 1 |
| surprise | 0.5 |
| neutral | 0 |
| uncertain | -0.2 |
| fear | -0.6 |
| sadness | -0.8 |
| disgust | -0.9 |
| anger | -1 |

**무드 레이블 (`scoreToMoodLabel`):** >0.5 → Great / >0.1 → Good / >-0.1 → Okay / >-0.5 → Low / else → Very Low

**지난주 대비 계산:**
```
wellness = round((score + 1) / 2 * 100)   // -1~1 → 0~100
pptDiff = thisWeekWellness - lastWeekWellness
> +3 → Improving / < -3 → Declining / else → Stable
```

---

#### Language 탭

| 섹션 | 데이터 출처 | 내용 |
|------|------------|------|
| **KPI 카드** | `content` 클라이언트 분석 | 총 단어 수 / 평균 단어 수 / 고유 단어 수 / Layer Reach(T·I 도달 날 비율) / 인과문 비율 / 주체문 비율 |
| **Thinking Type Distribution** | `diary.thinking_type` (서버 AI) | causal_reasoning / interpretation / event_listing 평균값 bar + trend line |
| **Language Lens** | `diary.language_lens` (서버 AI) | closed / open / rigid / passive 평균값 radar chart + trend line |
| **Structure Score** | `diary.structure` (서버 AI) | Observation / Thought / Insight 포함 비율 → 종합 점수 /100 |
| **Layer Depth** | `diary.structure` | range 선택형 stacked bar (O/T/I 레이어 도달 여부 per 날/주/월) |
| **Vocabulary Density** | `content` | range 선택형 stacked bar (unique vs repeated 단어) |
| **Expression Growth** | `content` | range 선택형 — 이전 기간 대비 새 단어 수 bar, 최신 버킷 신조어 15개 표시 |
| **Words I Use Often** | `content` | 전체 일기 빈도 상위 15개 word cloud |
| **Frequent Words → Synonyms** | `content` + 정적 THESAURUS | 빈도 상위 3개 단어에 대해 유의어 최대 4개 제안 |
| **Word Patterns — Today** | `content` (오늘) | 오늘 일기에서 THINKING_KW / LENS_KW 키워드 추출·표시 |

**Structure Score 계산:**
```
score = round((totalObs + totalThought + totalInsight) / (n × 3) × 100)
```

**Layer Reach:**
```
= (T 또는 I layer가 있는 날 수 / 전체 작성 날 수) × 100
```

**인과문 비율 (`getCausalRatio`):**
```
= 인과 마커 포함 문장 수 / 전체 문장 수 × 100
마커: 때문에, 해서, 그래서, because, therefore 등
```

**주체문 비율 (`getSubjectRatio`):**
```
= 주체 마커 문장 / (주체 + 수동 마커 문장) × 100
주체: 내가, 나는, I  / 수동: 됐다, 된 것 같, 인 듯 등
```

**Thinking Type 클라이언트 키워드 패턴 (`THINKING_KW`):**
- `causal_reasoning`: `~때문에`, `그래서`, `because`, `therefore` 등 인과 접속어
- `interpretation`: `~것 같`, `느껴`, `I think`, `it seems` 등
- `event_listing`: `~했고`, `그리고`, `then`, `after that` 등

**Language Lens 클라이언트 키워드 패턴 (`LENS_KW`):**
- `closed`: `어차피`, `당연히`, `obviously`, `definitely` 등 단정적 표현
- `rigid`: `항상`, `매번`, `always`, `every time` 등 절대화 표현
- `passive`: `~게 됐`, `어쩔 수 없`, `ended up` 등 수동적 표현
- `open`: `혹시`, `어쩌면`, `maybe`, `what if` 등 가능성 탐색

**`analyzeLanguagePatterns` (utils/languageAnalysis.js) — 최근 7일 일기 대상:**
- `topWords`: 한글 2글자 이상, 불용어 제외 상위 3개
- `topPhrases`: bigram/trigram 상위 3개
- `styleScores`: 5가지 표현 스타일 점수 (`min(100, round(matchCount/textLen × 1000))`)

| 스타일 | 이모지 | 색상 |
|--------|--------|------|
| Thoughtful | 🪞 | `#f59e0b` |
| Humble | 🌱 | `#10b981` |
| Composed | 🧊 | `#64748b` |
| Goal-Driven | 🎯 | `#8b5cf6` |
| Empathetic | 💛 | `#3b82f6` |

---

#### Activity 탭

| 섹션 | 내용 |
|------|------|
| **Note Activity** | range 선택형 line chart — 기간별 일기 작성 횟수 |
| **Monthly Calendar** | 월별 캘린더 — 날짜별 태그 색상 인디케이터 (최대 3개 + 오버플로), 날짜 탭 시 당일 일기 목록 모달 |
| **Tag Legend** | 태그별 색상 범례 |

**Note Activity 단위:**

| range | 그래프 단위 |
|-------|------------|
| `1W` | 일별 (7일) |
| `1M` | 주별 5주 |
| `6M` | 월별 6개월 |
| `ALL` | 주별 (첫 일기~현재) |

**태그 색상:** 최대 5가지 팔레트에서 인덱스 순 할당, 태그 없음(`null`)은 회색(`#C7C7CC`)

### 5-6. 알림 시스템
**알림 카테고리:**
| 카테고리 | 버튼 | 동작 |
|---------|------|------|
| mood-check | 😊 Good / 😔 Not great / 😤 Stressed / 😴 Tired | 빠른 기분 기록 |
| note-prompt | Now / In 5 min / In 1 hour | 일기 작성 유도 |
| write-reminder | (없음) | 이어쓰기 알림 |

**스케줄 모드:**
- **주간 자동 프롬프트:** 요일별 다른 NVC 기반 메시지
- **일간 커스텀 메시지:** 다중 시간 지원, 동일 메시지 반복

**Android 알림 채널:** `daily-reminder`, `quick-actions`

**알림 응답 처리 (App.js):**
- 버튼 탭 → 기분 엔트리 자동 생성 → AsyncStorage 저장
- "Now" 탭 → 편집 화면 포그라운드 이동
- 후속 알림 자동 스케줄

### 5-7. 개인정보 & 온보딩
- 최초 실행 시 3단계 개인정보 온보딩 Modal
- AI 분석 사용 여부 공개 및 선택
- 개인정보처리방침 열람
- AI 토글 변경 시 경고 다이얼로그
- 전체 데이터 삭제 기능 (이중 확인)

---

## 6. API 명세

**Base URL:** `https://lucidnote-api-production-cbe8.up.railway.app`

| 메서드 | 엔드포인트 | 설명 | 인증 |
|--------|-----------|------|------|
| POST | `/auth/signup` | 회원가입 | 없음 |
| POST | `/auth/login` | 로그인 | 없음 |
| POST | `/auth/google` | Google OAuth | 없음 |
| GET | `/auth/me` | 현재 사용자 정보 | Bearer |
| POST | `/analyze` | 감정 분석 | Bearer |

**감정 분석 요청/응답:**
```json
// Request
{ "text": "오늘 정말 행복한 하루였다." }

// Response
{ "emotion": "joy" }
```

---

## 7. 로컬 데이터 구조

### AsyncStorage Keys
| 키 | 내용 |
|----|------|
| `auth_token` | JWT 토큰 |
| `settings` | 알림·AI 설정 객체 |
| `diaries` | 일기 배열 |
| `categories` | 카테고리 배열 |
| `notificationIds` | 예약된 알림 ID 목록 |
| `useAIAnalysis` | AI 분석 사용 여부 (boolean) |
| `hasSeenPrivacyOnboarding` | 온보딩 완료 여부 |

### 일기 데이터 구조
```json
{
  "id": "1711234567890",
  "title": "오늘의 일기",
  "content": "오늘은 정말 좋은 날이었다...",
  "emotion": "joy",
  "tags": ["일상", "행복"],
  "categoryId": "1711234000000",
  "createdAt": "2026-03-22T09:00:00.000Z",
  "updatedAt": "2026-03-22T09:05:00.000Z"
}
```

### 카테고리 데이터 구조
```json
{
  "id": "1711234567890",
  "name": "일상",
  "emoji": "📔",
  "color": "#22c55e",
  "createdAt": "2026-03-22T09:00:00.000Z"
}
```

---

## 8. 디자인 시스템

### 색상
| 용도 | Hex |
|------|-----|
| Background | `#F2F2F7` |
| Card | `#FFFFFF` |
| CTA | `#000000` |
| Primary Text | `#1C1C1E` |
| Secondary Text | `#8E8E93` |
| Accent | `#3A3A3C` |
| Inactive Tab | `#C7C7CC` |

### 타이포그래피
| 용도 | iOS | Android |
|------|-----|---------|
| 로고 / CTA | Georgia (Serif) | serif |
| 본문 / UI | SF Pro | Inter / System |

### 컴포넌트 기준
- 카드 모서리: 8–14px
- 그림자: iOS shadow 속성, Android elevation
- 플랫폼 키보드: iOS `padding`, Android `height`

---

## 9. 파일 구조

```
/BetterDiary
├── App.js                        # 루트, 인증 흐름, 알림 핸들러
├── app.json                      # Expo 설정
├── package.json
├── navigation/
│   ├── HomeStack.js              # 루트 네비게이터
│   ├── TabNavigator.js           # 하단 탭
│   └── HomeTabStack.js           # 홈 내부 스택
├── screens/
│   ├── LoginScreen.js
│   ├── SignupScreen.js
│   ├── LandingScreen.js
│   ├── CategoryListScreen.js
│   ├── HomeScreen.js
│   ├── InsightScreen.js
│   ├── RemindersScreen.js
│   ├── MessagesScreen.js
│   ├── SettingsScreen.js
│   ├── ProfileScreen.js
│   └── DataPrivacyScreen.js
├── services/
│   └── auth.js                   # 인증 & API 호출
├── utils/
│   ├── emotionAnalysis.js        # 감정 분석 (AI + 로컬)
│   ├── notifications.js          # 알림 스케줄링
│   └── categories.js             # 카테고리 CRUD
├── components/
│   └── PrivacyOnboardingModal.js
└── constants/
    └── privacyPolicy.js
```

---

## 10. 알려진 이슈 & 제한사항

| 항목 | 내용 |
|------|------|
| Android 이모지 색상 | iOS보다 흐리게 렌더링됨 (플랫폼 차이). 향후 커스텀 이미지로 교체 예정 |
| Google 로그인 | 프레임워크 준비 완료, 실제 활성화는 추가 설정 필요 |
| 알림 | 물리 기기에서만 동작 (시뮬레이터 미지원) |
| Android 알림 | API 29 이상에서 채널 완전 지원 |
| New Architecture | 현재 비활성화 (호환성), 향후 TurboModules 전환 예정 |

---

## 11. 향후 과제 (Backlog)

- [ ] 서버 사이드 일기 동기화 (현재 로컬 전용)
- [ ] Google 로그인 활성화
- [ ] 커스텀 이모지 이미지 교체 (Android 렌더링 개선)
- [ ] New Architecture / TurboModules 마이그레이션
- [ ] 다국어 지원 확장 (현재 영어·한국어 감정 키워드)
- [ ] 일기 검색 기능
- [ ] 데이터 내보내기 (PDF / CSV)
- [ ] 위젯 지원

---

*이 문서는 2026-03-22 기준 구현된 기능을 기반으로 작성되었습니다.*
