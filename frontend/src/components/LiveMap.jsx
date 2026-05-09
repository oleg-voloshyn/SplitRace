import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'

// Leaflet doesn't handle 100% height in flex containers reliably — force a resize after mount
function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(t)
  }, [])
  return null
}

function Follow({ point }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng], { animate: true, duration: 0.5 })
  }, [point?.lat, point?.lng])
  return null
}

export default function LiveMap({ points }) {
  const last  = points[points.length - 1]
  const first = points[0]
  const line  = points.map(p => [p.lat, p.lng])

  return (
    <MapContainer
      center={[last.lat, last.lng]}
      zoom={16}
      style={{ position: 'absolute', inset: 0 }}
      scrollWheelZoom={false}
      zoomControl={false}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapResizer />
      <Follow point={last} />

      <Polyline positions={line} color="#e53935" weight={4} opacity={0.9} />

      <CircleMarker
        center={[first.lat, first.lng]}
        radius={6}
        pathOptions={{ color: '#fff', fillColor: '#4caf50', fillOpacity: 1, weight: 2 }}
      />
      <CircleMarker
        center={[last.lat, last.lng]}
        radius={9}
        pathOptions={{ color: '#fff', fillColor: '#2196f3', fillOpacity: 1, weight: 3 }}
      />
    </MapContainer>
  )
}
