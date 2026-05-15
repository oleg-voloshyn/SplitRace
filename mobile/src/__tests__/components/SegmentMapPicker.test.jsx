import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SegmentMapPicker from '../../components/SegmentMapPicker';

const noop = jest.fn();

describe('SegmentMapPicker', () => {
  it('renders the map (WebView)', () => {
    render(
      <SegmentMapPicker
        points={[]}
        onPointsChange={noop}
        hint="Tap to add points"
        undoLabel="Undo"
        clearLabel="Clear"
      />
    );
    expect(screen.getByTestId('webview')).toBeTruthy();
  });

  it('renders hint text', () => {
    render(
      <SegmentMapPicker
        points={[]}
        onPointsChange={noop}
        hint="Tap to add route points"
        undoLabel="Undo"
        clearLabel="Clear"
      />
    );
    expect(screen.getByText('Tap to add route points')).toBeTruthy();
  });

  it('renders undo and clear buttons', () => {
    render(
      <SegmentMapPicker
        points={[]}
        onPointsChange={noop}
        hint=""
        undoLabel="↩ Undo"
        clearLabel="✕ Clear"
      />
    );
    expect(screen.getByText('↩ Undo')).toBeTruthy();
    expect(screen.getByText('✕ Clear')).toBeTruthy();
  });

  it('disables buttons when no points', () => {
    render(
      <SegmentMapPicker
        points={[]}
        onPointsChange={noop}
        hint=""
        undoLabel="Undo"
        clearLabel="Clear"
      />
    );
    const undoBtn = screen.getByText('Undo').parent.parent;
    expect(undoBtn.props.accessibilityState?.disabled ?? undoBtn.props.disabled).toBeTruthy();
  });

  it('enables buttons when points exist', () => {
    render(
      <SegmentMapPicker
        points={[{ lat: 50.45, lng: 30.52 }]}
        onPointsChange={noop}
        hint=""
        undoLabel="Undo"
        clearLabel="Clear"
      />
    );
    const undoBtn = screen.getByText('Undo').parent.parent;
    expect(undoBtn.props.accessibilityState?.disabled ?? undoBtn.props.disabled).toBeFalsy();
  });
});
