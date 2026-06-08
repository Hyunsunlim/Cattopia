import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch, getToken } from './auth';

const BASE_URL = 'https://lucidnote-api-production-cbe8.up.railway.app';
const FRIENDS_CACHE_KEY = 'friends_cache';

export async function createInvite() {
  const res = await authFetch(`${BASE_URL}/friends/invite`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create invite');
  return res.json(); // { invite_code, invite_link }
}

export async function acceptInvite(code) {
  const res = await authFetch(`${BASE_URL}/friends/accept/${code}`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to accept invite');
  }
  return res.json(); // FriendItem
}

function mapFriend(f) {
  return {
    ...f,
    catName: f.cat_name ?? null,
    wroteToday: f.wrote_today ?? false,
    todayEmotion: f.today_emotion ?? null,
    lastEmotion: f.last_emotion ?? null,
    todayWordCount: f.today_word_count ?? 0,
    noteCount: f.note_count ?? 0,
  };
}

export async function getCachedFriends() {
  const raw = await AsyncStorage.getItem(FRIENDS_CACHE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function fetchFriends() {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await authFetch(`${BASE_URL}/friends`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to fetch friends (HTTP ${res.status})`);
  }
  const data = await res.json();
  const mapped = data.map(mapFriend);
  await AsyncStorage.setItem(FRIENDS_CACHE_KEY, JSON.stringify(mapped));
  return mapped;
}

export async function removeFriend(friendshipId) {
  const res = await authFetch(`${BASE_URL}/friends/${friendshipId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove friend');
}
