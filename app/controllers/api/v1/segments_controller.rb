module Api
  module V1
    class SegmentsController < BaseController
      def index
        segments = Segment.active.order(:name)
        render json: segments.map { |s| segment_json(s) }
      end

      def show
        segment = Segment.find(params[:id])
        render json: segment_json(segment, detailed: true)
      end

      private

      def segment_json(segment, detailed: false)
        data = {
          id: segment.id,
          name: segment.name,
          description: segment.description_html,
          distance_meters: segment.distance_meters,
          elevation_gain: segment.elevation_gain,
          city: segment.city,
          country: segment.country
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
