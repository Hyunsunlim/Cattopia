import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './auth';

const BASE_URL = 'https://lucidnote-api-production-cbe8.up.railway.app';
const CACHE_KEY = 'diaries';
const SYNCED_KEY = 'notes_synced';

// ── helpers ──────────────────────────────────────────────────────────────────

function serverToLocal(note) {
  return {
    id: String(note.id),          // keep string id for compatibility
    _serverId: note.id,
    content: note.content,
    title: note.title ?? '',
    tag: note.tag ?? null,
    emotion: note.emotion ?? null,
    emoji: note.emoji ?? null,
    timestamp: note.timestamp,
    word_count: note.word_count ?? null,
    structure: note.structure ?? null,
    thinking_type: note.thinking_type ?? null,
    language_lens: note.language_lens ?? null,
  };
}

function localToServer(entry) {
  return {
    content: entry.content,
    title: entry.title || null,
    tag: entry.tag || null,
    emotion: entry.emotion || null,
    emoji: entry.emoji || null,
    timestamp: entry.timestamp,
    word_count: entry.word_count ?? null,
    structure: entry.structure ?? null,
    thinking_type: entry.thinking_type ?? null,
    language_lens: entry.language_lens ?? null,
  };
}

// ── sync local → server on first login ───────────────────────────────────────

export async function migrateLocalNotesIfNeeded() {
  try {
    const already = await AsyncStorage.getItem(SYNCED_KEY);
    if (already === 'true') return;

    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(SYNCED_KEY, 'true');
      return;
    }
    const local = JSON.parse(raw);
    if (!local.length) {
      await AsyncStorage.setItem(SYNCED_KEY, 'true');
      return;
    }

    const body = local.map(localToServer);
    const res = await authFetch(`${BASE_URL}/notes/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await AsyncStorage.setItem(SYNCED_KEY, 'true');
    }
  } catch (e) {
    console.warn('migrateLocalNotesIfNeeded:', e);
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function fetchNotes() {
  const res = await authFetch(`${BASE_URL}/notes`);
  if (!res.ok) throw new Error('Failed to fetch notes');
  const data = await res.json();
  const local = data.map(serverToLocal);
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(local));

  // 백그라운드로 AI 분석 안 된 노트 재분석
  const unanalyzed = local.filter(n => !n.thinking_type && n.content && n._serverId);
  if (unanalyzed.length > 0) {
    setTimeout(() => {
      unanalyzed.slice(0, 5).forEach(n => analyzeNote(n._serverId, n.content));
    }, 2000);
  }

  return local;
}

export async function getCachedNotes() {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function createNote(entry) {
  const res = await authFetch(`${BASE_URL}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(localToServer(entry)),
  });
  if (!res.ok) throw new Error('Failed to create note');
  const created = await res.json();
  const local = serverToLocal(created);

  // update cache
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  const all = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify([local, ...all]));
  return local;
}

export async function updateNote(serverId, patch) {
  const res = await authFetch(`${BASE_URL}/notes/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update note');
  const updated = serverToLocal(await res.json());

  const raw = await AsyncStorage.getItem(CACHE_KEY);
  const all = raw ? JSON.parse(raw) : [];
  const next = all.map(n => (n._serverId === serverId ? { ...n, ...updated } : n));
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
  return updated;
}

export async function analyzeNote(serverId, content) {
  try {
    const res = await authFetch(`${BASE_URL}/analyze-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    });
    if (!res.ok) return;
    const result = await res.json();

    if (!result.is_diary) {
      // 짧은 텍스트는 감정만 별도로 분석
      const eRes = await authFetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content }),
      });
      if (eRes.ok) {
        const eResult = await eRes.json();
        if (eResult.emotion) await updateNote(serverId, { emotion: eResult.emotion });
      }
      return;
    }

    await updateNote(serverId, {
      emotion: result.emotion ?? undefined,
      structure: result.structure ?? undefined,
      thinking_type: result.thinking_type ?? undefined,
      language_lens: result.language_lens ?? undefined,
    });
  } catch (e) {
    console.warn('analyzeNote error:', e);
  }
}

export async function deleteNote(serverId) {
  const res = await authFetch(`${BASE_URL}/notes/${serverId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete note');

  const raw = await AsyncStorage.getItem(CACHE_KEY);
  const all = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(all.filter(n => n._serverId !== serverId)));
}
