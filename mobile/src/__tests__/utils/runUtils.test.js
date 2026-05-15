import {
  buildShareText,
  calcDistance,
  fmtDist,
  fmtPace,
  fmtTime,
  haversine,
} from '../../utils/runUtils';

describe('fmtTime', () => {
  it('formats seconds under a minute', () => {
    expect(fmtTime(45)).toBe('00:45');
  });

  it('formats whole minutes', () => {
    expect(fmtTime(60)).toBe('01:00');
  });

  it('formats minutes and seconds', () => {
    expect(fmtTime(90)).toBe('01:30');
  });

  it('formats hours', () => {
    expect(fmtTime(3661)).toBe('1:01:01');
  });

  it('formats exactly one hour', () => {
    expect(fmtTime(3600)).toBe('1:00:00');
  });

  it('pads single-digit seconds', () => {
    expect(fmtTime(65)).toBe('01:05');
  });

  it('returns --:-- for null', () => {
    expect(fmtTime(null)).toBe('--:--');
  });

  it('returns --:-- for undefined', () => {
    expect(fmtTime(undefined)).toBe('--:--');
  });

  it('formats zero as 00:00', () => {
    expect(fmtTime(0)).toBe('00:00');
  });
});

describe('fmtDist', () => {
  it('converts meters to km with 2 decimals', () => {
    expect(fmtDist(5000)).toBe('5.00 km');
  });

  it('handles sub-km distances', () => {
    expect(fmtDist(500)).toBe('0.50 km');
  });

  it('handles zero', () => {
    expect(fmtDist(0)).toBe('0.00 km');
  });

  it('handles null gracefully', () => {
    expect(fmtDist(null)).toBe('0.00 km');
  });

  it('handles odd distances', () => {
    expect(fmtDist(1234)).toBe('1.23 km');
  });
});

describe('fmtPace', () => {
  it('calculates pace per km', () => {
    // 5km in 25min = 5:00/km
    expect(fmtPace(1500, 5000)).toBe('05:00');
  });

  it('returns --:-- when secs is 0', () => {
    expect(fmtPace(0, 5000)).toBe('--:--');
  });

  it('returns --:-- when meters is 0', () => {
    expect(fmtPace(1500, 0)).toBe('--:--');
  });

  it('returns --:-- when both are null', () => {
    expect(fmtPace(null, null)).toBe('--:--');
  });

  it('calculates slow pace correctly', () => {
    // 1km in 10min = 10:00/km
    expect(fmtPace(600, 1000)).toBe('10:00');
  });
});

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    const pt = { lat: 50.45, lng: 30.52 };
    expect(haversine(pt, pt)).toBeCloseTo(0);
  });

  it('calculates ~111km per degree of latitude', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 1, lng: 0 };
    expect(haversine(a, b)).toBeCloseTo(111195, -2);
  });

  it('is symmetric', () => {
    const a = { lat: 50.45, lng: 30.52 };
    const b = { lat: 50.46, lng: 30.53 };
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a));
  });
});

describe('calcDistance', () => {
  it('returns 0 for empty array', () => {
    expect(calcDistance([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(calcDistance([{ lat: 50.45, lng: 30.52 }])).toBe(0);
  });

  it('sums distances between consecutive points', () => {
    const a = { lat: 50.45, lng: 30.52 };
    const b = { lat: 50.46, lng: 30.52 };
    const c = { lat: 50.47, lng: 30.52 };
    const ab = haversine(a, b);
    const bc = haversine(b, c);
    expect(calcDistance([a, b, c])).toBeCloseTo(ab + bc);
  });

  it('gives positive distance for two different points', () => {
    const pts = [{ lat: 50.45, lng: 30.52 }, { lat: 50.46, lng: 30.53 }];
    expect(calcDistance(pts)).toBeGreaterThan(0);
  });
});

describe('buildShareText', () => {
  const t = (key, opts) => {
    const map = {
      'run.shareTitle': 'My SplitRace run',
      'run.distance': 'Distance',
      'run.time': 'Time',
      'run.pace': 'Pace',
      'run.noSegmentsCompleted': 'No segments completed.',
    };
    if (key === 'run.segmentsCompleted') return `${opts.count} segments completed`;
    return map[key] || key;
  };

  it('includes distance, time and pace', () => {
    const activity = {
      distance_meters: 5000,
      elapsed_time_seconds: 1500,
      segment_efforts: [],
    };
    const text = buildShareText(activity, t);
    expect(text).toContain('5.00 km');
    expect(text).toContain('25:00');
    expect(text).toContain('SplitRace');
  });

  it('includes segment efforts when present', () => {
    const activity = {
      distance_meters: 3000,
      elapsed_time_seconds: 900,
      segment_efforts: [
        { id: 1, segment: { name: 'Park Hill' }, formatted_time: '2:30' },
      ],
    };
    const text = buildShareText(activity, t);
    expect(text).toContain('Park Hill');
    expect(text).toContain('2:30');
  });

  it('shows no-segments message when empty', () => {
    const activity = {
      distance_meters: 2000,
      elapsed_time_seconds: 600,
      segment_efforts: [],
    };
    const text = buildShareText(activity, t);
    expect(text).toContain('No segments completed.');
  });
});
