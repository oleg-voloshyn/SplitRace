import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

// Fix default marker icons (Leaflet + Vite issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length > 1) {
      map.fitBounds(positions, { padding: [30, 30] });
    }
  }, [map, positions]);
  return null;
}

function MapView({ segments = [], gpsTrack = null, height = '400px', className = '' }) {
  const allPositions = [...segments.flatMap((s) => s.polyline || []), ...(gpsTrack || [])];

  const center = allPositions.length > 0 ? [allPositions[0].lat, allPositions[0].lng] : [50.45, 30.52]; // Kyiv as default

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height, width: '100%', borderRadius: '8px' }}
      className={className}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {allPositions.length > 1 && <FitBounds positions={allPositions.map((p) => [p.lat, p.lng])} />}

      {segments.map((segment, i) => {
        const line = segment.polyline?.map((p) => [p.lat, p.lng]);
        if (!line || line.length < 2) {
          return null;
        }
        return (
          <Polyline key={segment.id || i} positions={line} color="#e53935" weight={4} opacity={0.85}>
            <Popup>{segment.name}</Popup>
          </Polyline>
        );
      })}

      {segments.map((segment, i) => {
        if (!segment.start_point) {
          return null;
        }
        return (
          <Marker
            key={`start-${segment.id || i}`}
            position={[segment.start_point.lat, segment.start_point.lng]}
            icon={startIcon}
          >
            <Popup>Start: {segment.name}</Popup>
          </Marker>
        );
      })}

      {segments.map((segment, i) => {
        if (!segment.end_point) {
          return null;
        }
        return (
          <Marker
            key={`end-${segment.id || i}`}
            position={[segment.end_point.lat, segment.end_point.lng]}
            icon={endIcon}
          >
            <Popup>Finish: {segment.name}</Popup>
          </Marker>
        );
      })}

      {gpsTrack && gpsTrack.length > 1 && (
        <Polyline positions={gpsTrack.map((p) => [p.lat, p.lng])} color="#1976d2" weight={3} opacity={0.75} />
      )}
    </MapContainer>
  );
}

export default MapView;
