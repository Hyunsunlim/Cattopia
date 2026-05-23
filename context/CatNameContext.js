import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateProfile } from '../services/auth';

const CatNameContext = createContext({ catName: 'Choco', setCatName: () => {} });

export function CatNameProvider({ children }) {
  const [catName, setCatNameState] = useState('Choco');

  useEffect(() => {
    AsyncStorage.getItem('settings').then(async raw => {
      if (!raw) return;
      const settings = JSON.parse(raw);
      if (settings.catName) {
        setCatNameState(settings.catName);
        // 서버에 cat_name 없으면 동기화
        updateProfile({ catName: settings.catName }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const setCatName = async (name) => {
    setCatNameState(name);
    const raw = await AsyncStorage.getItem('settings');
    const settings = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem('settings', JSON.stringify({ ...settings, catName: name }));
    updateProfile({ catName: name }).catch(() => {});
  };

  return (
    <CatNameContext.Provider value={{ catName, setCatName }}>
      {children}
    </CatNameContext.Provider>
  );
}

export function useCatName() {
  return useContext(CatNameContext);
}
