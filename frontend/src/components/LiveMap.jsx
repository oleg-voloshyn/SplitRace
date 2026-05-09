import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'

function Follow({ point }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng], { animate: true, duration: 0.5 })
  }, [point])
  return null
}

export default function LiveMap({ points }) {
  const last   = points[points.length - 1]
  const first  = points[0]
  const center = [last.lat, last.lng]
  const line   = points.map(p => [p.lat, p.lng])

  return (
    <MapContainer
      center={center}
      zoom={16}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
      zoomControl={false}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Follow point={last} />

      {/* track */}
      <Polyline positions={line} color="#e53935" weight={4} opacity={0.9} />

      {/* start dot */}
      <CircleMarker center={[first.lat, first.lng]} radius={6} pathOptions={{ color: '#fff', fillColor: '#4caf50', fillOpacity: 1, weight: 2 }} />

      {/* current position */}
      <CircleMarker center={[last.lat, last.lng]} radius={8} pathOptions={{ color: '#fff', fillColor: '#2196f3', fillOpacity: 1, weight: 3 }}>
        <CircleMarker center={[last.lat, last.lng]} radius={16} pathOptions={{ color: '#2196f3', fillColor: '#2196f3', fillOpacity: 0.2, weight: 0 }} />
      </CircleMarker>
    </MapContainer>
  )
}
