import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Leaflet (OpenStreetMap) map via WebView — no Google Maps API key needed.
 * Pass `points: [{lat, lng}, ...]`. The map auto-fits the route and follows the latest point if `follow=true`.
 */
function LeafletMap({ points = [], follow = false, style }) {
  const webRef = useRef(null);

  // Build initial HTML once — never re-create the WebView while running
  const html = useMemo(() => buildHtml(points, follow), []);

  // Stream new points to the WebView via postMessage
  useEffect(() => {
    if (!webRef.current || points.length === 0) {
      return;
    }
    const js = `window.SR && window.SR.update(${JSON.stringify(points)}, ${follow ? 'true' : 'false'}); true;`;
    webRef.current.injectJavaScript(js);
  }, [points, follow]);

  return (
    <View className="flex-1 bg-brand-navy" style={style}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

function buildHtml(initialPoints, initialFollow) {
  const initJson = JSON.stringify(initialPoints || []);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#1a1a2e; }
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
      scrollWheelZoom: true
    }).setView([50.45, 30.52], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    let polyline = null, startMarker = null, endMarker = null;

    function render(points, follow) {
      if (!points || points.length === 0) return;
      const latlngs = points.map(p => [p.lat, p.lng]);
      if (polyline) map.removeLayer(polyline);
      polyline = L.polyline(latlngs, { color: '#e53935', weight: 4, opacity: 0.9 }).addTo(map);

      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.circleMarker(latlngs[0], { radius: 7, color: '#4caf50', fillColor: '#4caf50', fillOpacity: 1, weight: 2 }).addTo(map);

      if (endMarker) map.removeLayer(endMarker);
      const last = latlngs[latlngs.length - 1];
      endMarker = L.circleMarker(last, { radius: 7, color: '#e53935', fillColor: '#e53935', fillOpacity: 1, weight: 2 }).addTo(map);

      if (follow) {
        map.setView(last, Math.max(map.getZoom(), 16));
      } else if (latlngs.length > 1) {
        map.fitBounds(latlngs, { padding: [20, 20] });
      }
    }

    window.SR = { update: render };

    const initial = ${initJson};
    if (initial.length) render(initial, ${initialFollow ? 'true' : 'false'});
  </script>
</body>
</html>`;
}

export default LeafletMap;
