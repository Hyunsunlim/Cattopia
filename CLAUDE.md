# Project Guidelines

## General
- grep, find, ls 등 읽기 전용 명령어는 항상 허용
- node_modules 탐색도 허용

## Code Conventions
- notifications의 sound 옵션은 항상 boolean (true/false) 사용, 'default' 문자열 사용 금지
- React Native New Architecture / TurboModules 호환성 유지

## Platform
- 모든 UI 수정 시 iOS와 Android 동시에 검토하고 수정해줘
- Android는 KeyboardAvoidingView behavior="height", iOS는 "padding" 사용

## Known Issues
- Android에서 이모지 색이 iOS보다 흐리게 보임 (Android 이모지 렌더링 차이)
- 추후 커스텀 이모지 이미지나 아이콘으로 교체 필요

## Design System

### Colors
- Background: #F2F2F7
- Card: #FFFFFF
- CTA: #000000
- Primary Text: #1C1C1E
- Secondary Text: #8E8E93
- Accent: #3A3A3C
- Inactive Tab: #C7C7CC

### Typography
- Logo / CTA: Playfair Display or Georgia (Serif)
- Body / UI: SF Pro (iOS) / Inter (Android, Web)