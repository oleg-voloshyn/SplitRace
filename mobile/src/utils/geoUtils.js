export function haversine(a, b) {
  const R = 6371000,
    rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

export function routeDistance(points) {
  if (points.length < 2) return 0;
  return points
    .slice(1)
    .reduce((total, pt, i) => total + haversine(points[i], pt), 0);
}

export function formatDistance(meters) {
  return meters ? `${(meters / 1000).toFixed(2)} km` : '-';
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    const address = data?.address || {};
    return {
      city:
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        '',
      country:
        (address.country_code || '').toUpperCase() || address.country || '',
    };
  } catch {
    return {};
  }
}
