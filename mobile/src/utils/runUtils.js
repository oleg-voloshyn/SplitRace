function fmtTime(secs) {
  if (!secs && secs !== 0) {
    return '--:--';
  }
  const h = Math.floor(secs / 3600),
    m = Math.floor((secs % 3600) / 60),
    s = secs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtDist(meters) {
  return `${((meters || 0) / 1000).toFixed(2)} km`;
}

function fmtPace(secs, meters) {
  if (!secs || !meters) {
    return '--:--';
  }
  return fmtTime(Math.round(secs / (meters / 1000)));
}

function haversine(a, b) {
  const R = 6371000,
    rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const x = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

function calcDistance(pts) {
  if (pts.length < 2) {
    return 0;
  }
  return pts.slice(1).reduce((total, pt, i) => total + haversine(pts[i], pt), 0);
}

function buildShareText(activity, t) {
  const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
  const segments = activity.segment_efforts || [];
  const segmentLines = segments.length
    ? segments.map((e) => `• ${e.segment?.name} — ${e.formatted_time}`).join('\n')
    : t('run.noSegmentsCompleted');

  return [
    t('run.shareTitle'),
    `${t('run.distance')}: ${fmtDist(activity.distance_meters)}`,
    `${t('run.time')}: ${fmtTime(activity.elapsed_time_seconds)}`,
    `${t('run.pace')}: ${fmtPace(activity.elapsed_time_seconds, activity.distance_meters)} /km`,
    `${t('run.segmentsCompleted', { count: segmentCount })}`,
    segmentLines,
    'SplitRace'
  ].join('\n');
}

export { buildShareText, calcDistance, fmtDist, fmtPace, fmtTime, haversine };
