module Api
  module V1
    class ActivitiesController < BaseController
      def index
        activities = current_user.activities
                                 .includes(segment_efforts: :segment)
                                 .order(started_at: :desc)
                                 .limit(20)
        render json: activities.map { |a| activity_json(a) }
      end

      def create
        gps_pts = parse_gps_points(params[:gps_points])

        activity = current_user.activities.build(activity_params)
        activity.gps_points = gps_pts if gps_pts.present?
        activity.gps_track  = build_gps_track(gps_pts) if gps_pts.present?

        if activity.save
          begin
            SegmentMatcher.new(activity).call
            activity.user.tournaments.where(status: 'active').find_each do |t|
              TournamentScore.recalculate_all(t)
            end
          rescue => e
            Rails.logger.error "[SegmentMatcher] #{e.class}: #{e.message}"
          end
          render json: activity_json(activity.reload), status: :created
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

      def activity_json(activity)
        passed_segments = passed_segments_for(activity)
        {
          id: activity.id,
          started_at: activity.started_at,
          finished_at: activity.finished_at,
          distance_meters: activity.distance_meters,
          elapsed_time_seconds: activity.elapsed_time_seconds,
          source: activity.source,
          segment_efforts_count: activity.segment_efforts.count,
          segment_efforts: activity.segment_efforts.includes(:segment).order(:started_at).map { |effort| segment_effort_json(effort) },
          passed_segments:,
          pending_rated_unlocks: pending_rated_unlocks_for(activity),
          new_personal_bests: new_personal_bests_for(activity),
          gps_points: activity.gps_points || []
        }
      end

      def new_personal_bests_for(activity)
        activity.segment_efforts.includes(:segment).filter_map do |effort|
          previous_best = SegmentEffort
                          .where(user_id: activity.user_id, segment_id: effort.segment_id)
                          .where.not(activity_id: activity.id)
                          .minimum(:elapsed_time_seconds)
          next nil unless previous_best
          next nil unless effort.elapsed_time_seconds < previous_best

          {
            segment_id: effort.segment_id,
            segment_name: effort.segment.name,
            elapsed_time_seconds: effort.elapsed_time_seconds,
            formatted_time: effort.formatted_time,
            previous_best_seconds: previous_best,
            previous_best_formatted: format_seconds(previous_best)
          }
        end
      end

      def format_seconds(secs)
        hours   = secs / 3600
        minutes = (secs % 3600) / 60
        seconds = secs % 60
        return format('%<h>02d:%<m>02d:%<s>02d', h: hours, m: minutes, s: seconds) if hours.positive?

        format('%<m>02d:%<s>02d', m: minutes, s: seconds)
      end

      def passed_segments_for(activity)
        ids = activity.passed_segment_ids.presence || []
        return [] if ids.empty?

        Segment.where(id: ids).pluck(:id, :name).map { |id, name| { id:, name: } }
      end

      def pending_rated_unlocks_for(activity)
        user = activity.user
        user.tournaments.where(status: 'active').filter_map do |tournament|
          rated = tournament.tournament_segments.where(is_rated: true).order(:order_number)
          next nil if rated.empty?

          rated_segment_ids = rated.pluck(:segment_id)
          unlocked_in_activity = TournamentEvent
                                 .joins(:segment_effort)
                                 .where(tournament:, actor: user)
                                 .where(segment_efforts: { activity_id: activity.id })
                                 .exists?
          next nil if unlocked_in_activity

          completed = SegmentEffort.where(user:, segment_id: rated_segment_ids).pluck(:segment_id).to_set
          next_required = rated.find { |ts| completed.exclude?(ts.segment_id) }
          next nil unless next_required

          { tournament_name: tournament.name, position: next_required.order_number }
        end
      end

      def segment_effort_json(effort)
        {
          id: effort.id,
          elapsed_time_seconds: effort.elapsed_time_seconds,
          formatted_time: effort.formatted_time,
          pace_per_km: effort.pace_per_km,
          segment: {
            id: effort.segment.id,
            name: effort.segment.name,
            distance_meters: effort.segment.distance_meters,
            city: effort.segment.city,
            country: effort.segment.country
          }
        }
      end
    end
  end
end
