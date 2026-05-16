import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CreatorScreen from '../../screens/CreatorScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate })
}));

const mockT = (key) => {
  const map = {
    'creator.hubIntro': 'What would you like to create?',
    'creator.segments': 'Segments',
    'creator.newSegment': 'New segment',
    'creator.newSegmentSubtitle': 'Draw a route on the map',
    'creator.createSegment': 'Create segment',
    'creator.newTournament': 'New tournament',
    'creator.newTournamentSubtitle': 'Combine segments into a tournament',
    'creator.createTournament': 'Create tournament',
    'nav.tournaments': 'Tournaments'
  };
  return map[key] ?? key;
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}));

beforeEach(() => {
  mockNavigate.mockReset();
});

describe('CreatorScreen — hub', () => {
  it('shows intro prompt', () => {
    render(<CreatorScreen />);
    expect(screen.getByText('What would you like to create?')).toBeTruthy();
  });

  it('renders the New segment card', () => {
    render(<CreatorScreen />);
    expect(screen.getByText('New segment')).toBeTruthy();
    expect(screen.getByText('Draw a route on the map')).toBeTruthy();
  });

  it('renders the New tournament card', () => {
    render(<CreatorScreen />);
    expect(screen.getByText('New tournament')).toBeTruthy();
    expect(screen.getByText('Combine segments into a tournament')).toBeTruthy();
  });

  it('navigates to NewSegment when segment card is pressed', () => {
    render(<CreatorScreen />);
    fireEvent.press(screen.getByText('New segment'));
    expect(mockNavigate).toHaveBeenCalledWith('NewSegment');
  });

  it('navigates to NewTournament when tournament card is pressed', () => {
    render(<CreatorScreen />);
    fireEvent.press(screen.getByText('New tournament'));
    expect(mockNavigate).toHaveBeenCalledWith('NewTournament');
  });
});
