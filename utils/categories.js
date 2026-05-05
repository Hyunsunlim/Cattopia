import AsyncStorage from '@react-native-async-storage/async-storage';

export const CATEGORY_COLORS = ['#22c55e', '#92400e', '#14b8a6', '#a855f7', '#ec4899'];

export const loadCategories = async () => {
  try {
    const saved = await AsyncStorage.getItem('categories');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to load categories:', error);
    return null;
  }
};

export const saveCategories = async (cats) => {
  try {
    await AsyncStorage.setItem('categories', JSON.stringify(cats));
  } catch (error) {
    console.error('Failed to save categories:', error);
  }
};

export const createCategory = async (name, emoji) => {
  const existing = (await loadCategories()) || [];
  const colorIndex = existing.length % CATEGORY_COLORS.length;
  const newCategory = {
    id: Date.now().toString(),
    name,
    emoji,
    color: CATEGORY_COLORS[colorIndex],
    createdAt: new Date().toISOString(),
  };
  const updated = [...existing, newCategory];
  await saveCategories(updated);
  return { category: newCategory, categories: updated };
};

export const migrateIfNeeded = async () => {
  try {
    const existing = await loadCategories();
    if (existing !== null) return; // already migrated

    // Create default 'diary' category
    const defaultCategory = {
      id: 'diary',
      name: 'diary',
      emoji: '📔',
      color: CATEGORY_COLORS[0],
      createdAt: new Date().toISOString(),
    };
    await saveCategories([defaultCategory]);

    // Migrate existing diaries
    const savedDiaries = await AsyncStorage.getItem('diaries');
    if (savedDiaries) {
      const diaries = JSON.parse(savedDiaries);
      const migrated = diaries.map(d =>
        d.categoryId ? d : { ...d, categoryId: 'diary' }
      );
      await AsyncStorage.setItem('diaries', JSON.stringify(migrated));
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
};
