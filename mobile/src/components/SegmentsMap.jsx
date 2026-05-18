import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const SEGMENT_COLORS = ['#e53935', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#5d4037'];

function SegmentsMap({ segments = [], style }) {
  const html = useMemo(() => buildHtml(segments), [segments]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <View className="h-[260px] bg-brand-navy" style={style}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

function buildHtml(segments) {
  const segsJson = JSON.stringify(
    segments.map((ts, i) => ({
      name: ts.segment?.name ?? '',
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      polyline: ts.segment?.polyline ?? [],
      start: ts.segment?.start_point ?? null,
      end: ts.segment?.end_point ?? null
    }))
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html,body,#map { margin:0; padding:0; height:100%; width:100%; background:#1a1a2e; }
    .leaflet-control-zoom a { color: #1a1a2e !important; font-weight: 700; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      zoomSnap: 0.25
    }).setView([50.45, 30.52], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const segments = ${segsJson};
    const allLatLngs = [];
    let fittedBounds = null;

    function fitTournamentSegments() {
      map.invalidateSize(false);
      if (fittedBounds) {
        map.fitBounds(fittedBounds, { padding: [42, 42], maxZoom: 13 });
      } else if (allLatLngs.length === 1) {
        map.setView(allLatLngs[0], 13);
      }
    }

    segments.forEach(function(seg) {
      const line = (seg.polyline || []).map(function(p) { return [p.lat, p.lng]; });
      if (line.length >= 2) {
        L.polyline(line, { color: seg.color, weight: 4, opacity: 0.9 }).addTo(map)
          .bindPopup(seg.name);
        line.forEach(function(p) { allLatLngs.push(p); });
      }

      if (seg.start) {
        L.circleMarker([seg.start.lat, seg.start.lng],
          { radius: 6, color: seg.color, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(map)
          .bindPopup(seg.name);
        allLatLngs.push([seg.start.lat, seg.start.lng]);
      }
      if (seg.end) {
        L.circleMarker([seg.end.lat, seg.end.lng],
          { radius: 6, color: seg.color, fillColor: seg.color, fillOpacity: 1, weight: 2 }).addTo(map)
          .bindPopup(seg.name);
        allLatLngs.push([seg.end.lat, seg.end.lng]);
      }
    });

    if (allLatLngs.length > 1) {
      fittedBounds = L.latLngBounds(allLatLngs);
      fitTournamentSegments();
      setTimeout(fitTournamentSegments, 120);
      setTimeout(fitTournamentSegments, 420);
    } else if (allLatLngs.length === 1) {
      fitTournamentSegments();
      setTimeout(fitTournamentSegments, 120);
    }
  </script>
</body>
</html>`;
}

export default SegmentsMap;
