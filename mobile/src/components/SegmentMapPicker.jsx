import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_CENTER = [50.45, 30.52];

function SegmentMapPicker({ points = [], onPointsChange, initialCenter, hint, undoLabel, clearLabel }) {
  const webRef = useRef(null);
  const html = useMemo(() => buildHtml(DEFAULT_CENTER), []);

  useEffect(() => {
    if (!initialCenter || !webRef.current) {
      return;
    }
    const [lat, lng] = initialCenter;
    webRef.current.injectJavaScript(`window.SR && window.SR.recenter(${lat}, ${lng}); true;`);
  }, [initialCenter]);

  function handleMessage(event) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'points') {
        onPointsChange(msg.points);
      }
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  }

  function undo() {
    webRef.current?.injectJavaScript('window.SR && window.SR.undo(); true;');
  }

  function clear() {
    webRef.current?.injectJavaScript('window.SR && window.SR.clear(); true;');
  }

  const disabled = points.length === 0;

  return (
    <View style={s.wrap}>
      <WebView
        ref={webRef}
        source={{ html }}
        onMessage={handleMessage}
        style={s.map}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
      />
      <View style={s.footer}>
        <Text style={s.hint}>{hint}</Text>
        <View style={s.btns}>
          <TouchableOpacity style={[s.btn, disabled && s.btnDisabled]} onPress={undo} disabled={disabled}>
            <Text style={[s.btnText, disabled && s.btnTextDim]}>{undoLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, disabled && s.btnDisabled]} onPress={clear} disabled={disabled}>
            <Text style={[s.btnText, disabled && s.btnTextDim]}>{clearLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function buildHtml(center) {
  const [lat, lng] = center;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#e5e3df; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var points = [];
    var layers = [];
    var polyline = null;

    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${lat}, ${lng}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    function colorFor(i) {
      if (i === 0) return '#4caf50';
      if (i === points.length - 1) return '#e53935';
      return '#1976d2';
    }

    function redraw() {
      layers.forEach(function(l) { map.removeLayer(l); });
      layers = [];
      if (polyline) { map.removeLayer(polyline); polyline = null; }

      points.forEach(function(pt, i) {
        var color = i === 0 ? '#4caf50' : i === points.length - 1 ? '#e53935' : '#1976d2';
        var r = (i === 0 || i === points.length - 1) ? 9 : 5;
        var m = L.circleMarker([pt.lat, pt.lng], {
          radius: r, color: color, fillColor: color, fillOpacity: 0.95, weight: 2
        }).addTo(map);
        layers.push(m);
      });

      if (points.length > 1) {
        var latlngs = points.map(function(p) { return [p.lat, p.lng]; });
        polyline = L.polyline(latlngs, { color: '#e53935', weight: 4, opacity: 0.85 }).addTo(map);
      }

      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'points', points: points })
      );
    }

    map.on('click', function(e) {
      points.push({ lat: e.latlng.lat, lng: e.latlng.lng });
      redraw();
    });

    window.SR = {
      undo: function() { if (points.length > 0) { points.pop(); redraw(); } },
      clear: function() { points = []; redraw(); },
      recenter: function(lat, lng) { map.setView([lat, lng], 15); }
    };
  </script>
</body>
</html>`;
}

const s = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  map: { height: 260 },
  footer: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6
  },
  hint: { color: '#555', fontSize: 12, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center'
  },
  btnDisabled: { backgroundColor: '#ddd' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnTextDim: { color: '#aaa' }
});

export default SegmentMapPicker;
