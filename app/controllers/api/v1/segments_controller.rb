module Api
  module V1
    class SegmentsController < BaseController
      MAX_SEGMENT_POINTS = 100
      ROUTE_REQUIRED_ERROR = 'Route must include at least two valid points'.freeze
      INVALID_COORDINATES_ERROR = 'Route contains invalid coordinates'.freeze

      def index
        segments = params[:mine] == '1' ? current_user.created_segments : Segment.active
        segments = segments.order(:name)
        render json: paginated(segments) { |s| segment_json(s) }
      end

      def show
        segment = Segment.find(params[:id])
        render json: segment_json(segment, detailed: true)
      end

      def create
        segment = current_user.created_segments.build(segment_params)
        assign_geometry(segment)

        if segment.errors.empty? && segment.save
          render json: segment_json(segment, detailed: true), status: :created
        else
          render json: { errors: segment.errors.full_messages }, status: :unprocessable_content
        end
      end

      private

      def segment_params
        params.permit(:name, :description, :city, :country, :is_active)
      end

      def assign_geometry(segment)
        points = segment_points
        if points.size < 2
          segment.errors.add(:base, ROUTE_REQUIRED_ERROR)
          return
        end

        factory = RGeo::Geographic.spherical_factory(srid: 4326)
        geo_points = points.map { |point| factory.point(point[:lng], point[:lat]) }
        segment.start_point = geo_points.first
        segment.end_point = geo_points.last
        segment.polyline = factory.multi_line_string([factory.line_string(geo_points)])
        segment.distance_meters = haversine_total(points)
      rescue ArgumentError => e
        segment.errors.add(:base, e.message)
      end

      def segment_points
        raw_points = params[:points].presence
        if raw_points.respond_to?(:map)
          return parsed_route_points(raw_points)
        end

        [
          normalize_legacy_point(params[:start_lat], params[:start_lng]),
          normalize_legacy_point(params[:end_lat], params[:end_lng])
        ].compact
      end

      def parsed_route_points(raw_points)
        raise ArgumentError, "Route cannot contain more than #{MAX_SEGMENT_POINTS} points" if raw_points.size > MAX_SEGMENT_POINTS

        raw_points.map { |point| normalize_point!(point) }
      end

      def normalize_point!(point)
        lat = parse_coordinate(point_value(point, :lat))
        lng = parse_coordinate(point_value(point, :lng))
        raise ArgumentError, INVALID_COORDINATES_ERROR unless valid_coordinate?(lat, lng)

        { lat:, lng: }
      end

      def point_value(point, key)
        return nil unless point.respond_to?(:[])

        point[key] || point[key.to_s]
      rescue TypeError
        nil
      end

      def normalize_legacy_point(lat_value, lng_value)
        lat = parse_coordinate(lat_value)
        lng = parse_coordinate(lng_value)
        return nil unless valid_coordinate?(lat, lng)

        { lat:, lng: }
      end

      def parse_coordinate(value)
        Float(value, exception: false)
      end

      def valid_coordinate?(lat, lng)
        lat&.finite? && lng&.finite? && lat.between?(-90, 90) && lng.between?(-180, 180)
      end

      def haversine_total(points)
        points.each_cons(2).sum { |a, b| haversine(a[:lat], a[:lng], b[:lat], b[:lng]) }.round(2)
      end

      def haversine(lat1, lng1, lat2, lng2)
        rad = Math::PI / 180
        dlat = (lat2 - lat1) * rad
        dlng = (lng2 - lng1) * rad
        a = (Math.sin(dlat / 2)**2) +
            (Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (Math.sin(dlng / 2)**2))
        6_371_000 * 2 * Math.asin(Math.sqrt(a))
      end

      def segment_json(segment, detailed: false)
        data = {
          id: segment.id,
          name: segment.name,
          description: segment.description_html,
          distance_meters: segment.distance_meters,
          elevation_gain: segment.elevation_gain,
          city: segment.city,
          country: segment.country,
          created_by_id: segment.created_by_id
        }

        if detailed
          data[:start_point] = point_coords(segment.start_point)
          data[:end_point]   = point_coords(segment.end_point)
          data[:polyline]    = polyline_coords(segment.polyline)
          data[:best_effort] = best_effort_json(segment.best_effort_for(current_user))
        end

        data
      end

      def point_coords(point)
        return nil unless point

        { lat: point.lat, lng: point.lon }
      end

      def polyline_coords(line)
        return [] unless line

        lines = line.respond_to?(:geometries) ? line.geometries : [line]
        lines.flat_map { |geometry| geometry.points.map { |pt| { lat: pt.lat, lng: pt.lon } } }
      rescue => e
        Rails.logger.warn "[segments#polyline_coords] #{e.class}: #{e.message}"
        []
      end

      def best_effort_json(effort)
        return nil unless effort

        {
          elapsed_time_seconds: effort.elapsed_time_seconds,
          formatted_time: effort.formatted_time,
          pace_per_km: effort.pace_per_km,
          started_at: effort.started_at
        }
      end
    end
  end
end
