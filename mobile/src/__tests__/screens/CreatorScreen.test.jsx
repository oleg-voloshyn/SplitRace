import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import CreatorScreen from '../../screens/CreatorScreen';

jest.mock('../../api/client', () => ({
  api: {
    mySegments: jest.fn().mockResolvedValue([]),
    myTournaments: jest.fn().mockResolvedValue([]),
    createSegment: jest.fn(),
    createTournament: jest.fn(),
    addTournamentSegment: jest.fn(),
    submitTournamentForReview: jest.fn(),
  },
}));

jest.mock('../../utils/geoUtils', () => ({
  reverseGeocode: jest.fn().mockResolvedValue({ city: 'Kyiv', country: 'UA' }),
  routeDistance: jest.fn().mockReturnValue(0),
  formatDistance: jest.fn().mockReturnValue('-'),
}));

const mockT = (key, opts) => {
  const map = {
    'creator.newSegment': 'New segment',
    'creator.segmentName': 'Segment name',
    'creator.createSegment': 'Create segment',
    'creator.newTournament': 'New tournament',
    'creator.tournamentName': 'Tournament name',
    'creator.createTournament': 'Create tournament',
    'creator.myTournaments': 'My tournaments',
    'creator.mapHint': 'Tap the map to draw the segment route',
    'creator.routePoints': `${opts?.count ?? 0} route points`,
    'creator.distance': 'Distance',
    'creator.undoPoint': 'Undo',
    'creator.clearRoute': 'Clear',
    'creator.routeRequired': 'Draw a route — at least 2 points required',
    'creator.segmentCreated': 'Segment created',
    'creator.failed': 'Something went wrong',
    'creator.city': 'City',
    'creator.country': 'Country',
    'creator.totalSegments': 'Total',
    'creator.ratedSegments': 'Rated',
    'creator.noSegments': 'No segments',
    'creator.addSegment': 'Add segment',
    'creator.submitReview': 'Submit',
    'common.error': 'Error',
  };
  return map[key] ?? key;
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock('../../components/SegmentMapPicker', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return ({ onPointsChange, hint, undoLabel, clearLabel }) =>
    React.createElement(View, { testID: 'segment-map' },
      React.createElement(Text, null, hint),
      React.createElement(TouchableOpacity, {
        testID: 'add-point-btn',
        onPress: () => onPointsChange([
          { lat: 50.45, lng: 30.52 },
          { lat: 50.46, lng: 30.53 },
        ]),
      }, React.createElement(Text, null, 'Add Points')),
    );
});

describe('CreatorScreen', () => {
  it('renders segment name label', async () => {
    render(<CreatorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Segment name')).toBeTruthy();
    });
  });

  it('renders map hint', async () => {
    render(<CreatorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Tap the map to draw the segment route')).toBeTruthy();
    });
  });

  it('renders the map picker', async () => {
    render(<CreatorScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('segment-map')).toBeTruthy();
    });
  });

  it('shows error when creating segment without route', async () => {
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<CreatorScreen />);
    await waitFor(() => screen.getByText('Create segment'));

    fireEvent.press(screen.getByText('Create segment'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Draw a route — at least 2 points required'
      );
    });
  });

  it('calls createSegment API when route has 2+ points', async () => {
    const { api } = require('../../api/client');
    api.createSegment.mockResolvedValueOnce({ id: 1 });

    render(<CreatorScreen />);
    await waitFor(() => screen.getByTestId('add-point-btn'));

    fireEvent.press(screen.getByTestId('add-point-btn'));

    // Find the TextInput after label (no placeholder — CreatorInput uses a label Text)
    const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
    const nameInput = inputs[0];
    fireEvent.changeText(nameInput, 'Test Hill');
    fireEvent.press(screen.getByText('Create segment'));

    await waitFor(() => {
      expect(api.createSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Hill',
          points: expect.arrayContaining([expect.objectContaining({ lat: 50.45 })]),
        })
      );
    });
  });

  it('renders My tournaments section', async () => {
    render(<CreatorScreen />);
    await waitFor(() => {
      expect(screen.getByText('My tournaments')).toBeTruthy();
    });
  });

  it('renders tournament list when tournaments exist', async () => {
    const { api } = require('../../api/client');
    api.myTournaments.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Spring Race',
        status: 'draft',
        slug: 'spring-race',
        total_segments_count: 2,
        segments: [],
      },
    ]);
    api.mySegments.mockResolvedValueOnce([]);

    render(<CreatorScreen />);
    await waitFor(() => {
      expect(screen.getByText('Spring Race')).toBeTruthy();
    });
  });
});
