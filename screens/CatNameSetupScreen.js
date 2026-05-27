import { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Platform, Animated, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

const C = {
  primary: '#755844',
  primaryContainer: '#ffd8be',
  background: '#fbf9f8',
  surface: '#ffffff',
  surfaceContainer: '#f0eded',
  onSurface: '#1b1c1c',
  outline: '#81756d',
  outlineVariant: '#d3c4bb',
};

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const SUGGESTIONS = ['Choco', 'Mochi', 'Biscuit', 'Luna', 'Nabi', 'Coco', 'Milo', 'Hazel'];

export default function CatNameSetupScreen({ onComplete }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDone = () => {
    const trimmed = name.trim();
    if (!trimmed) { shake(); return; }
    onComplete(trimmed);
  };

  return (
    <SafeAreaView style={S.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={S.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Cat illustration */}
          <View style={S.catWrap}>
            <View style={S.catGlow} />
            <View style={S.catCircle}>
              <Text style={S.catEmoji}>🐱</Text>
            </View>
          </View>

          <Text style={S.title}>{t('meow.catSetup.title')}</Text>
          <Text style={S.sub}>{t('meow.catSetup.sub')}</Text>

          {/* Input */}
          <Animated.View style={[S.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
            <TextInput
              style={S.input}
              value={name}
              onChangeText={setName}
              placeholder={t('meow.catSetup.placeholder')}
              placeholderTextColor={C.outlineVariant}
              autoFocus
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleDone}
              autoCorrect={false}
            />
          </Animated.View>

          {/* Suggestions */}
          <View style={S.suggestions}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[S.chip, name === s && S.chipSelected]}
                onPress={() => setName(s)}
                activeOpacity={0.75}
              >
                <Text style={[S.chipText, name === s && S.chipTextSelected]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[S.btn, !name.trim() && { opacity: 0.4 }]}
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text style={S.btnText}>
              {name.trim()
                ? t('meow.catSetup.btnFilled', { name: name.trim() })
                : t('meow.catSetup.btnEmpty')}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  inner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 16,
  },

  // Cat
  catWrap: { alignItems: 'center', justifyContent: 'center', width: 140, height: 140, marginBottom: 8 },
  catGlow: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,216,190,0.5)',
  },
  catCircle: {
    width: 116, height: 116, borderRadius: 58,
    backgroundColor: C.surface,
    borderWidth: 2.5, borderColor: C.surfaceContainer,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 6,
  },
  catEmoji: { fontSize: 56 },

  title: {
    fontFamily: SERIF,
    fontSize: 26, fontWeight: '700',
    color: C.onSurface, textAlign: 'center',
  },
  sub: {
    fontSize: 14, color: C.outline,
    textAlign: 'center', marginTop: -8,
  },

  // Input
  inputWrap: { width: '100%' },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1.5, borderColor: C.outlineVariant,
    borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 18, fontWeight: '600',
    color: C.onSurface, textAlign: 'center',
    fontFamily: SERIF,
  },

  // Suggestions
  suggestions: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 8,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 99, borderWidth: 1.5,
    borderColor: C.outlineVariant,
    backgroundColor: C.surface,
  },
  chipSelected: {
    borderColor: C.primary,
    backgroundColor: 'rgba(117,88,68,0.08)',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: C.outline },
  chipTextSelected: { color: C.primary },

  // Button
  btn: {
    width: '100%',
    backgroundColor: C.primary,
    paddingVertical: 17, borderRadius: 99,
    alignItems: 'center', marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: SERIF },
});
