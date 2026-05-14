import * as SecureStore from 'expo-secure-store';

const WEB_URL = 'https://splitrace.onrender.com';
const BASE_URL = `${WEB_URL}/api/v1`;

async function getToken() {
  return SecureStore.getItemAsync('auth_token');
}

async function request(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw data;
  }
  return data;
}

const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (params) => request('/auth/register', { method: 'POST', body: JSON.stringify(params) }),
  me: () => request('/me'),
  updateMe: (params) => request('/me', { method: 'PATCH', body: JSON.stringify({ user: params }) }),
  tournaments: () => request('/tournaments'),
  tournament: (slug) => request(`/tournaments/${slug}`),
  joinTournament: (slug) => request(`/tournaments/${slug}/join`, { method: 'POST' }),
  leaderboard: (slug) => request(`/tournaments/${slug}/leaderboard`),
  activities: () => request('/activities'),
  saveActivity: (params) => request('/activities', { method: 'POST', body: JSON.stringify(params) }),
  reportCheating: (params) => request('/cheating_reports', { method: 'POST', body: JSON.stringify(params) })
};

const tokenStore = {
  set: (t) => SecureStore.setItemAsync('auth_token', t),
  delete: () => SecureStore.deleteItemAsync('auth_token')
};

export { api, tokenStore, WEB_URL };
