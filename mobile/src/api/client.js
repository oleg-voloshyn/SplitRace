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
  googleLogin: (idToken) => request('/auth/google', { method: 'POST', body: JSON.stringify({ id_token: idToken }) }),
  appleLogin: (identityToken, firstName, lastName) =>
    request('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identity_token: identityToken, first_name: firstName, last_name: lastName })
    }),
  register: (params) => request('/auth/register', { method: 'POST', body: JSON.stringify(params) }),
  me: () => request('/me'),
  updateMe: (params) => request('/me', { method: 'PATCH', body: JSON.stringify(params) }),
  notifications: () => request('/notifications'),
  readAllNotifications: () => request('/notifications/read_all', { method: 'POST' }),
  registerPushToken: (params) =>
    request('/push_tokens', { method: 'POST', body: JSON.stringify({ push_token: params }) }),
  unregisterPushToken: (token) => request('/push_tokens', { method: 'DELETE', body: JSON.stringify({ token }) }),
  segment: (id) => request(`/segments/${id}`),
  mySegments: () => request('/segments?mine=1'),
  createSegment: (params) => request('/segments', { method: 'POST', body: JSON.stringify(params) }),
  tournaments: () => request('/tournaments'),
  myTournaments: () => request('/tournaments/mine'),
  createTournament: (params) => request('/tournaments', { method: 'POST', body: JSON.stringify(params) }),
  updateTournament: (slug, params) =>
    request(`/tournaments/${slug}`, { method: 'PATCH', body: JSON.stringify(params) }),
  removeTournamentSegment: (slug, segmentId) =>
    request(`/tournaments/${slug}/segments/${segmentId}`, { method: 'DELETE' }),
  tournament: (slug) => request(`/tournaments/${slug}`),
  addTournamentSegment: (slug, params) =>
    request(`/tournaments/${slug}/add_segment`, { method: 'POST', body: JSON.stringify(params) }),
  submitTournamentForReview: (slug) => request(`/tournaments/${slug}/submit_for_review`, { method: 'POST' }),
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
