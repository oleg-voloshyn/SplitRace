const BASE = '/api/v1';

function getToken() {
  return localStorage.getItem('splitrace_token');
}

function setToken(token) {
  localStorage.setItem('splitrace_token', token);
}

function clearToken() {
  localStorage.removeItem('splitrace_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) {
    return null;
  }
  const text = await res.text();
  const data = text.trim() ? JSON.parse(text) : {};
  if (!res.ok) {
    throw { status: res.status, errors: data.errors || [data.error] || [`HTTP ${res.status}`] };
  }
  return data;
}

const api = {
  // Auth
  register: (params) => request('/auth/register', { method: 'POST', body: JSON.stringify(params) }),
  login: (params) => request('/auth/login', { method: 'POST', body: JSON.stringify(params) }),

  // User
  me: () => request('/me'),
  updateMe: (params) => request('/me', { method: 'PATCH', body: JSON.stringify(params) }),
  notifications: () => request('/notifications'),
  readNotification: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request('/notifications/read_all', { method: 'POST' }),

  // Segments
  segments: () => request('/segments'),
  segment: (id) => request(`/segments/${id}`),
  mySegments: () => request('/segments?mine=1'),
  createSegment: (params) => request('/segments', { method: 'POST', body: JSON.stringify(params) }),

  // Tournaments
  tournaments: () => request('/tournaments'),
  myTournaments: () => request('/tournaments/mine'),
  createTournament: (params) => request('/tournaments', { method: 'POST', body: JSON.stringify(params) }),
  tournament: (slug) => request(`/tournaments/${slug}`),
  tournamentFeed: (slug) => request(`/tournaments/${slug}/feed`),
  addTournamentSegment: (slug, params) =>
    request(`/tournaments/${slug}/add_segment`, { method: 'POST', body: JSON.stringify(params) }),
  submitTournamentForReview: (slug) => request(`/tournaments/${slug}/submit_for_review`, { method: 'POST' }),
  joinTournament: (slug) => request(`/tournaments/${slug}/join`, { method: 'POST' }),
  leaveTournament: (slug) => request(`/tournaments/${slug}/leave`, { method: 'DELETE' }),
  leaderboard: (slug, gender) => request(`/tournaments/${slug}/leaderboard${gender ? `?gender=${gender}` : ''}`),

  // Activities
  activities: () => request('/activities'),
  saveActivity: (params) => request('/activities', { method: 'POST', body: JSON.stringify(params) }),

  // Cheating reports
  reportCheating: (params) => request('/cheating_reports', { method: 'POST', body: JSON.stringify(params) })
};

export { api, clearToken, setToken };
