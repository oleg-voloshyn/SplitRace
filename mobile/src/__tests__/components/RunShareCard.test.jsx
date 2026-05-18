import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RunShareCard } from '../../components/RunShareCard';

const mockT = (key, opts) => {
  const map = {
    'run.shareTagline': 'Біжи • Змагайся • Прогресуй',
    'run.shareKicker': 'Моя пробіжка SplitRace',
    'run.segmentUnlocked': 'Сегмент відкрито',
    'run.runComplete': 'Пробіжку завершено',
    'run.distance': 'Дистанція',
    'run.time': 'Час',
    'run.pace': 'Темп/км',
    'run.shareNoSegments': 'Сегменти не пройдені',
    'run.shareSegmentsCompleted':
      opts?.count === 1 ? `${opts.count} сегмент пройдено` : `${opts?.count ?? 0} сегменти пройдено`,
    'run.shareMore': `+${opts?.count ?? 0} ще...`,
    'run.shareFooterDate': `Час пробіжки — ${opts?.date}`
  };
  return map[key] ?? key;
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'uk' } })
}));

const baseActivity = {
  distance_meters: 5230,
  elapsed_time_seconds: 1500,
  segment_efforts: [],
  segment_efforts_count: 0
};

describe('RunShareCard', () => {
  it('renders distance correctly', () => {
    render(<RunShareCard activity={baseActivity} />);
    expect(screen.getByText('5.23 km')).toBeTruthy();
  });

  it('renders time correctly', () => {
    render(<RunShareCard activity={baseActivity} />);
    expect(screen.getByText('25:00')).toBeTruthy();
  });

  it('renders pace correctly', () => {
    // 1500s / 5.23km ≈ 4:47/km
    render(<RunShareCard activity={baseActivity} />);
    expect(screen.getByText('04:47')).toBeTruthy();
  });

  it('renders SPLITRACE branding', () => {
    render(<RunShareCard activity={baseActivity} />);
    expect(screen.getByText('SPLITRACE')).toBeTruthy();
  });

  it('renders splitrace.app footer', () => {
    render(<RunShareCard activity={baseActivity} />);
    expect(screen.getByText('splitrace.app')).toBeTruthy();
  });

  it('shows segment count when segments present', () => {
    const activity = {
      ...baseActivity,
      segment_efforts_count: 2,
      segment_efforts: [
        { id: 1, segment: { name: 'Park Hill' }, formatted_time: '2:30' },
        { id: 2, segment: { name: 'Bridge Loop' }, formatted_time: '5:12' }
      ]
    };
    render(<RunShareCard activity={activity} />);
    expect(screen.getByText('2 сегменти пройдено')).toBeTruthy();
  });

  it('renders segment names and times', () => {
    const activity = {
      ...baseActivity,
      segment_efforts_count: 1,
      segment_efforts: [{ id: 1, segment: { name: 'Park Hill' }, formatted_time: '2:30' }]
    };
    render(<RunShareCard activity={activity} />);
    expect(screen.getByText('Park Hill')).toBeTruthy();
    expect(screen.getByText('2:30')).toBeTruthy();
  });

  it('shows no-segment message when empty', () => {
    render(<RunShareCard activity={baseActivity} />);
    expect(screen.getByText('Сегменти не пройдені')).toBeTruthy();
  });

  it('limits square format displayed segments to 3', () => {
    const activity = {
      ...baseActivity,
      segment_efforts_count: 5,
      segment_efforts: Array.from({ length: 5 }, (_, i) => ({
        id: i,
        segment: { name: `Segment ${i + 1}` },
        formatted_time: '1:00'
      }))
    };
    render(<RunShareCard activity={activity} format="square" />);
    expect(screen.getByText('Segment 1')).toBeTruthy();
    expect(screen.getByText('Segment 3')).toBeTruthy();
    expect(screen.queryByText('Segment 4')).toBeNull();
    expect(screen.getByText('+2 ще...')).toBeTruthy();
  });
});
