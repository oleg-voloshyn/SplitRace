import * as SecureStore from 'expo-secure-store';
import { api, tokenStore, WEB_URL } from '../../api/client';

const BASE = `${WEB_URL}/api/v1`;

function mockFetch(data, { ok = true, status = 200 } = {}) {
  global.fetch.mockResolvedValueOnce({
    ok,
    status,
    text: async () => JSON.stringify(data),
  });
}

function mockFetchEmpty(ok = true) {
  global.fetch.mockResolvedValueOnce({
    ok,
    status: ok ? 204 : 422,
    text: async () => '',
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
  SecureStore.getItemAsync.mockResolvedValue(null);
});

describe('request — headers', () => {
  it('sends Content-Type: application/json', async () => {
    mockFetch({ token: 'abc', user: {} });
    await api.login('a@b.com', 'pass');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('includes Authorization header when token exists', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('my-token');
    mockFetch([]);
    await api.tournaments();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      })
    );
  });

  it('omits Authorization header when no token', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    mockFetch([]);
    await api.tournaments();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });
});

describe('request — error handling', () => {
  it('throws response data on non-ok response', async () => {
    mockFetch({ errors: ['Invalid credentials'] }, { ok: false, status: 401 });
    await expect(api.login('a@b.com', 'wrong')).rejects.toEqual({
      errors: ['Invalid credentials'],
    });
  });

  it('handles empty body on success', async () => {
    mockFetchEmpty(true);
    const result = await api.readAllNotifications();
    expect(result).toEqual({});
  });
});

describe('api.login', () => {
  it('POSTs to /auth/login with email and password', async () => {
    mockFetch({ token: 'tok', user: { id: 1 } });
    const result = await api.login('user@example.com', 'secret');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/login`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual({ token: 'tok', user: { id: 1 } });
  });
});

describe('api.register', () => {
  it('POSTs to /auth/register', async () => {
    mockFetch({ token: 'tok', user: { id: 2 } });
    await api.register({ email: 'new@x.com', password: 'pw' });
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/auth/register`,
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api.me', () => {
  it('GETs /me', async () => {
    mockFetch({ id: 1, email: 'a@b.com' });
    const user = await api.me();
    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/me`, expect.any(Object));
    expect(user.id).toBe(1);
  });
});

describe('api.updateMe', () => {
  it('PATCHes /me', async () => {
    mockFetch({ id: 1 });
    await api.updateMe({ city: 'Kyiv' });
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/me`,
      expect.objectContaining({ method: 'PATCH' })
    );
  });
});

describe('api.tournaments', () => {
  it('GETs /tournaments', async () => {
    mockFetch([]);
    await api.tournaments();
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/tournaments`,
      expect.any(Object)
    );
  });
});

describe('api.createSegment', () => {
  it('POSTs segment params as JSON', async () => {
    mockFetch({ id: 10 });
    const params = { name: 'Hill', points: [] };
    await api.createSegment(params);
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual(params);
  });
});

describe('api.saveActivity', () => {
  it('POSTs to /activities', async () => {
    mockFetch({ id: 5, distance_meters: 3000 });
    const params = { distance_meters: 3000, elapsed_time_seconds: 900 };
    const result = await api.saveActivity(params);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/activities`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.id).toBe(5);
  });
});

describe('api.joinTournament', () => {
  it('POSTs to /tournaments/:slug/join', async () => {
    mockFetch({ ok: true });
    await api.joinTournament('my-race');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/tournaments/my-race/join`,
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('tokenStore', () => {
  it('set calls SecureStore.setItemAsync', async () => {
    await tokenStore.set('abc123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'abc123');
  });

  it('delete calls SecureStore.deleteItemAsync', async () => {
    await tokenStore.delete();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });
});
