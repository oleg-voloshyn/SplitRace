import { formatDistance, reverseGeocode, routeDistance } from '../../utils/geoUtils';

describe('formatDistance', () => {
  it('formats meters to km string', () => {
    expect(formatDistance(5000)).toBe('5.00 km');
  });

  it('returns dash for 0', () => {
    expect(formatDistance(0)).toBe('-');
  });

  it('returns dash for null', () => {
    expect(formatDistance(null)).toBe('-');
  });

  it('formats sub-km correctly', () => {
    expect(formatDistance(750)).toBe('0.75 km');
  });
});

describe('routeDistance', () => {
  it('returns 0 for empty array', () => {
    expect(routeDistance([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(routeDistance([{ lat: 50, lng: 30 }])).toBe(0);
  });

  it('returns positive value for two distinct points', () => {
    const pts = [
      { lat: 50.45, lng: 30.52 },
      { lat: 50.46, lng: 30.53 }
    ];
    expect(routeDistance(pts)).toBeGreaterThan(0);
  });

  it('is additive across three points', () => {
    const a = { lat: 50.45, lng: 30.52 };
    const b = { lat: 50.46, lng: 30.52 };
    const c = { lat: 50.47, lng: 30.52 };
    const ab = routeDistance([a, b]);
    const bc = routeDistance([b, c]);
    expect(routeDistance([a, b, c])).toBeCloseTo(ab + bc);
  });
});

describe('reverseGeocode', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns city and country on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: { city: 'Kyiv', country_code: 'ua' }
      })
    });

    const result = await reverseGeocode(50.45, 30.52);
    expect(result).toEqual({ city: 'Kyiv', country: 'UA' });
  });

  it('returns empty object on non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    const result = await reverseGeocode(50.45, 30.52);
    expect(result).toEqual({});
  });

  it('returns empty object on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await reverseGeocode(50.45, 30.52);
    expect(result).toEqual({});
  });

  it('falls back to town when city is absent', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: { town: 'Brovary', country_code: 'ua' }
      })
    });
    const result = await reverseGeocode(50.5, 30.8);
    expect(result.city).toBe('Brovary');
  });

  it('calls nominatim with correct coordinates', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: {} })
    });
    await reverseGeocode(48.123, 24.456);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('lat=48.123'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('lon=24.456'));
  });
});
