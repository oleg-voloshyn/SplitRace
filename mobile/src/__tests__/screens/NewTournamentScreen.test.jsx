import {
  buildTournamentSegmentSubmitOrder,
  firstAvailableRatedOrder,
  hasCompleteRatedOrder
} from '../../screens/NewTournamentScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() })
}));

jest.mock('../../api/client', () => ({
  api: {
    mySegments: jest.fn(),
    createTournament: jest.fn(),
    addTournamentSegment: jest.fn()
  }
}));

jest.mock('../../components/SearchableListModal', () => {
  return () => null;
});

jest.mock('../../components/SegmentPreviewModal', () => {
  return () => null;
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));

describe('NewTournamentScreen rated segment order', () => {
  it('submits rated segments first in the selected rated order', () => {
    const selectedSegments = {
      10: { rated: true, order: 0, ratedOrder: 2 },
      20: { rated: false, order: 1 },
      30: { rated: true, order: 2, ratedOrder: 1 },
      40: { rated: false, order: 3 }
    };

    expect(buildTournamentSegmentSubmitOrder(selectedSegments).map(([id]) => id)).toEqual(['30', '10', '20', '40']);
  });

  it('requires every rated position to be selected exactly once', () => {
    expect(
      hasCompleteRatedOrder(
        {
          10: { rated: true, ratedOrder: 2 },
          20: { rated: true, ratedOrder: 1 },
          30: { rated: false }
        },
        2
      )
    ).toBe(true);

    expect(
      hasCompleteRatedOrder(
        {
          10: { rated: true, ratedOrder: 2 },
          20: { rated: true, ratedOrder: 2 }
        },
        2
      )
    ).toBe(false);

    expect(
      hasCompleteRatedOrder(
        {
          10: { rated: true, ratedOrder: 1 },
          20: { rated: true, ratedOrder: 3 }
        },
        3
      )
    ).toBe(false);
  });

  it('assigns the first free rated position when marking a segment rated', () => {
    expect(
      firstAvailableRatedOrder(
        {
          10: { rated: true, ratedOrder: 1 },
          20: { rated: true, ratedOrder: 3 },
          30: { rated: false }
        },
        3
      )
    ).toBe(2);
  });
});
