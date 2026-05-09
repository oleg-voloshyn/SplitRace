module Api
  module V1
    class ActivitiesController < BaseController
      def index
        activities = current_user.activities.order(started_at: :desc).limit(20)
        render json: activities.map { |a| activity_json(a) }
      end

      def create
        activity = current_user.activities.build(activity_params)
        activity.gps_track = build_gps_track(params[:gps_points]) if params[:gps_points].present?

        if activity.save
          SegmentMatcher.new(activity).call
          activity.user.tournaments.where(status: "active").each do |t|
            TournamentScore.recalculate_all(t)
          end
          render json: activity_json(activity), status: :created
        else
          render json: { errors: activity.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def activity_params
        params.permit(:started_at, :finished_at, :distance_meters, :elapsed_time_seconds, :source).tap do |p|
          p[:gps_points] = params[:gps_points] if params[:gps_points].present?
        end
      end

      def build_gps_track(points)
        return nil if points.blank?
        coords = points.map { |pt| [pt[:lng].to_f, pt[:lat].to_f] }
        factory = RGeo::Geographic.spherical_factory(srid: 4326)
        factory.line_string(coords.map { |lng, lat| factory.point(lng, lat) })
      rescue StandardError
        nil
      end

      def activity_json(activity)
        {
          id:                    activity.id,
          started_at:            activity.started_at,
          finished_at:           activity.finished_at,
          distance_meters:       activity.distance_meters,
          elapsed_time_seconds:  activity.elapsed_time_seconds,
          source:                activity.source,
          segment_efforts_count: activity.segment_efforts.count
        }
      end
    end
  end
end
