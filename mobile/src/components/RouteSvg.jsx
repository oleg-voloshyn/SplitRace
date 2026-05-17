import { Circle, Polyline, Svg } from 'react-native-svg';

const SEGMENT_COLORS = ['#e53935', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#5d4037'];

/**
 * Lightweight SVG silhouette of a route. Renders one or more polylines on
 * a normalized viewBox — no map tiles, no WebView. Used inside share cards.
 *
 * `polylines` is an array of arrays: [[{lat, lng}, ...], ...].
 * Pass a single segment as `[points]`.
 */
function RouteSvg({ polylines = [], width, height, strokeWidth = 4, showEndpoints = true }) {
  const flat = polylines.flat();
  if (flat.length < 2) {
    return null;
  }

  const lats = flat.map((p) => p.lat);
  const lngs = flat.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Use a fixed viewBox so consumers can size the Svg however they like.
  const vbWidth = 100;
  const vbHeight = 100;
  const padding = 6;
  const spanLat = Math.max(maxLat - minLat, 0.0001);
  const spanLng = Math.max(maxLng - minLng, 0.0001);

  // Fit while preserving aspect ratio — letterbox inside the viewBox.
  const scaleX = (vbWidth - padding * 2) / spanLng;
  const scaleY = (vbHeight - padding * 2) / spanLat;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (vbWidth - spanLng * scale) / 2;
  const offsetY = (vbHeight - spanLat * scale) / 2;

  // SVG y grows downward; latitude grows northward — flip.
  function projectPoint(p) {
    const x = offsetX + (p.lng - minLng) * scale;
    const y = offsetY + (maxLat - p.lat) * scale;
    return { x, y };
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${vbWidth} ${vbHeight}`}>
      {polylines.map((line, lineIndex) => {
        if (line.length < 2) {
          return null;
        }
        const color = SEGMENT_COLORS[lineIndex % SEGMENT_COLORS.length];
        const points = line.map((p) => {
          const { x, y } = projectPoint(p);
          return `${x},${y}`;
        });
        const startPt = projectPoint(line[0]);
        const endPt = projectPoint(line[line.length - 1]);
        return (
          <Svg key={lineIndex}>
            <Polyline
              points={points.join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {showEndpoints && (
              <>
                <Circle
                  cx={startPt.x}
                  cy={startPt.y}
                  r={strokeWidth * 0.8}
                  fill="#fff"
                  stroke={color}
                  strokeWidth={1.2}
                />
                <Circle cx={endPt.x} cy={endPt.y} r={strokeWidth * 0.8} fill={color} />
              </>
            )}
          </Svg>
        );
      })}
    </Svg>
  );
}

export default RouteSvg;
