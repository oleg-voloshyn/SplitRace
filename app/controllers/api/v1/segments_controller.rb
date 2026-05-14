module Api
  module V1
    class SegmentsController < BaseController
      def index
        segments = params[:mine] == '1' ? current_user.created_segments : Segment.active
        segments = segments.order(:name)
        render json: segments.map { |s| segment_json(s) }
      end

      def show
        segment = Segment.find(params[:id])
        render json: segment_json(segment, detailed: true)
      end

      def create
        segment = current_user.created_segments.build(segment_params)
        assign_geometry(segment)

        if segment.save
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
        return if points.size < 2

        factory = RGeo::Geographic.spherical_factory(srid: 4326)
        geo_points = points.map { |point| factory.point(point[:lng], point[:lat]) }
        segment.start_point = geo_points.first
        segment.end_point = geo_points.last
        segment.polyline = factory.multi_line_string([factory.line_string(geo_points)])
        segment.distance_meters = haversine_total(points)
      end

      def segment_points
        raw_points = params[:points].presence
        if raw_points.respond_to?(:map)
          return raw_points.map { |point| { lat: point[:lat].to_f, lng: point[:lng].to_f } }
        end

        [
          { lat: params[:start_lat].to_f, lng: params[:start_lng].to_f },
          { lat: params[:end_lat].to_f, lng: params[:end_lng].to_f }
        ].select { |point| point[:lat].nonzero? && point[:lng].nonzero? }
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
