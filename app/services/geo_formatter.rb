module GeoFormatter
  module_function

  def point(value)
    return nil unless value

    { lat: value.lat, lng: value.lon }
  end

  # Polyline is stored as MultiLineString — flatten all line strings into a
  # single array of { lat:, lng: } points. Returns nil if the input is missing
  # or unparseable so callers can decide on a default ([] vs nil).
  def polyline(value)
    return nil unless value

    lines = value.respond_to?(:geometries) ? value.geometries : [value]
    lines.flat_map { |line| line.points.map { |p| { lat: p.lat, lng: p.lon } } }
  rescue => e
    Rails.logger.warn "[GeoFormatter#polyline] #{e.class}: #{e.message}"
    nil
  end
end
