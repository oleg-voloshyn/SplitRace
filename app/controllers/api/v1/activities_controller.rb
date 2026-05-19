module Api
  module V1
    class ActivitiesController < BaseController
      def index
        activities = current_user.activities
                                 .includes(segment_efforts: :segment)
                                 .order(started_at: :desc)
        render json: paginated(activities, limit: 20) { |a| ActivityResource.new(a).serializable_hash }
      end

      def create
        gps_pts = parse_gps_points(params[:gps_points])

        activity = current_user.activities.build(activity_params)
        activity.gps_points = gps_pts if gps_pts.present?
        if gps_pts.present?
          safety_report = ActivityGpsSafetyAnalyzer.call(activity:, points: gps_pts)
          activity.suspicious = safety_report.suspicious
          activity.suspicious_reasons = safety_report.reasons
          activity.gps_quality = safety_report.metrics
          activity.gps_track = build_gps_track(Activity.gps_points_for_matching(gps_pts))
        end

        if activity.save
          begin
            score_changed_tournament_ids = SegmentMatcher.new(activity).call
            activity.user.tournaments.where(status: 'active', id: score_changed_tournament_ids).find_each do |t|
              TournamentScore.recalculate_all(t)
            end
          rescue => e
            Rails.logger.error "[SegmentMatcher] #{e.class}: #{e.message}"
          end
          render json: ActivityResource.new(activity.reload).serializable_hash, status: :created
        else
          render json: { errors: activity.errors.full_messages }, status: :unprocessable_content
        end
      rescue => e
        Rails.logger.error "[ActivitiesController#create] #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        render json: { errors: [e.message] }, status: :internal_server_error
      end

      private

      def activity_params
        params.permit(:started_at, :finished_at, :distance_meters, :elapsed_time_seconds, :source)
      end

      # Convert ActionController::Parameters array → plain Ruby hashes so JSONB serializes correctly
      def parse_gps_points(raw)
        return [] if raw.blank?

        raw.map do |pt|
          { 'lat' => pt[:lat].to_f, 'lng' => pt[:lng].to_f, 'ts' => pt[:ts].to_i, 'accuracy' => pt[:accuracy].to_f }
        end
      rescue
        []
      end

      def build_gps_track(points)
        return nil if points.blank?

        coords = points.map { |pt| [pt['lng'].to_f, pt['lat'].to_f] }
        factory = RGeo::Geographic.spherical_factory(srid: 4326)
        factory.line_string(coords.map { |lng, lat| factory.point(lng, lat) })
      rescue
        nil
      end
    end
  end
end
