import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://lucidnote-api-production-cbe8.up.railway.app';
const TOKEN_KEY = 'auth_token';
const TIMEOUT_MS = 15000; // 15초

function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch(err => {
      if (err.name === 'AbortError') throw new Error('request timed out');
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

export async function signup(email, password, username) {
  const response = await fetchWithTimeout(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
  });

  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    const msg = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
      : data.message || 'Signup failed';
    throw new Error(msg);
  }
  return data;
}

export async function login(identifier, password) {
  const body = identifier.includes('@')
    ? { email: identifier, password }
    : { username: identifier, password };
  const response = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    const msg = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
      : data.message || 'Login failed';
    throw new Error(msg);
  }
  return data;
}

export async function googleLogin(idToken) {
  const response = await fetchWithTimeout(`${BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });

  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    const msg = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
      : data.message || 'Google login failed';
    throw new Error(msg);
  }
  return data;
}

export async function getMe(token) {
  const response = await fetchWithTimeout(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    const msg = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
      : data.message || 'Failed to fetch user';
    throw new Error(msg);
  }
  return data;
}

export async function getToken() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (typeof token === 'string' && token.length > 0) {
    return token;
  }
  return null;
}

export async function saveToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Invalid token');
  }
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore removal errors
  }
}

export async function authFetch(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const token = await getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetchWithTimeout(url, { ...options, headers }, timeoutMs);
}

export async function updateProfile(data) {
  const res = await authFetch(`${BASE_URL}/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}
