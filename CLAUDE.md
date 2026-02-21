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