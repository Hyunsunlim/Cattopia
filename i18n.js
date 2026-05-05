import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import zhTW from './locales/zh-TW.json';

const LANGUAGE_KEY = 'app_language';

const getDeviceLanguage = () => {
  const locale = Localization.getLocales()[0]?.languageTag ?? 'en';
  if (locale.startsWith('ko')) return 'ko';
  if (locale.startsWith('ja')) return 'ja';
  if (locale.startsWith('zh')) return 'zh-TW';
  return 'en';
};

export const initI18n = async () => {
  const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
  const lng = savedLang ?? getDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      ja: { translation: ja },
      'zh-TW': { translation: zhTW },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
};

export const changeLanguage = async (lang) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-TW', label: '繁體中文' },
];

export default i18n;
