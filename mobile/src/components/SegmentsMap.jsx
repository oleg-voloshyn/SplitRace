import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const SEGMENT_COLORS = ['#e53935', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#5d4037'];

function SegmentsMap({ segments = [], style }) {
  const html = useMemo(() => buildHtml(segments), [segments]);

  if (segments.length === 0) return null;

  return (
    <View style={[s.wrap, style]}>
      <WebView
        source={{ html }}
        style={s.web}
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
      order: ts.order_number ?? i + 1,
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
    .seg-label { background:transparent; border:none; box-shadow:none; }
    .seg-label-inner {
      background: rgba(26,26,46,0.82);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([50.45, 30.52], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const segments = ${segsJson};
    const allLatLngs = [];

    segments.forEach(function(seg) {
      const line = (seg.polyline || []).map(function(p) { return [p.lat, p.lng]; });
      if (line.length >= 2) {
        L.polyline(line, { color: seg.color, weight: 4, opacity: 0.9 }).addTo(map)
          .bindPopup(seg.name);
        line.forEach(function(p) { allLatLngs.push(p); });

        var mid = line[Math.floor(line.length / 2)];
        var icon = L.divIcon({
          className: 'seg-label',
          html: '<div class="seg-label-inner">' + seg.order + '. ' + seg.name + '</div>',
          iconAnchor: [0, 0]
        });
        L.marker(mid, { icon: icon }).addTo(map);
      }

      if (seg.start) {
        L.circleMarker([seg.start.lat, seg.start.lng],
          { radius: 6, color: seg.color, fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(map)
          .bindPopup('Start: ' + seg.name);
        allLatLngs.push([seg.start.lat, seg.start.lng]);
      }
      if (seg.end) {
        L.circleMarker([seg.end.lat, seg.end.lng],
          { radius: 6, color: seg.color, fillColor: seg.color, fillOpacity: 1, weight: 2 }).addTo(map)
          .bindPopup('Finish: ' + seg.name);
        allLatLngs.push([seg.end.lat, seg.end.lng]);
      }
    });

    if (allLatLngs.length > 1) {
      map.fitBounds(allLatLngs, { padding: [28, 28] });
    } else if (allLatLngs.length === 1) {
      map.setView(allLatLngs[0], 15);
    }
  </script>
</body>
</html>`;
}

const s = StyleSheet.create({
  wrap: { height: 260, backgroundColor: '#1a1a2e' },
  web: { flex: 1, backgroundColor: 'transparent' }
});

export default SegmentsMap;
