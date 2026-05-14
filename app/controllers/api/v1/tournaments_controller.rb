module Api
  module V1
    class TournamentsController < BaseController
      before_action :set_tournament, only: %i[show join leave leaderboard activate complete]
      before_action :require_moderator!, only: %i[create activate complete]

      def index
        tournaments = Tournament.visible.order(starts_at: :desc)
        render json: tournaments.map { |t| tournament_json(t) }
      end

      def show
        render json: tournament_json(@tournament, detailed: true)
      end

      def create
        tournament = Tournament.new(tournament_params.merge(created_by: current_user))
        if tournament.save
          render json: tournament_json(tournament), status: :created
        else
          render json: { errors: tournament.errors.full_messages }, status: :unprocessable_content
        end
      end

      def join
        return render json: { error: 'Already joined' }, status: :unprocessable_content if @tournament.participating?(current_user)
        return render json: { error: 'Tournament is not active' }, status: :unprocessable_content unless @tournament.status == 'active'

        @tournament.tournament_participants.create!(user: current_user)
        render json: { joined: true }
      end

      def leave
        participant = @tournament.participant_for(current_user)
        return render json: { error: 'Not participating' }, status: :unprocessable_content unless participant

        participant.destroy
        render json: { left: true }
      end

      def leaderboard
        gender = params[:gender].presence
        scores = @tournament.tournament_scores
                            .includes(:user)
                            .where('score > 0')
                            .order(score: :desc)

        scores = scores.joins(:user).where(users: { gender: }) if gender

        render json: scores.map.with_index(1) { |s, i| score_json(s, i) }
      end

      def activate
        @tournament.activate!
        render json: tournament_json(@tournament)
      end

      def complete
        @tournament.complete!
        render json: tournament_json(@tournament)
      end

      private

      def set_tournament
        @tournament = begin
          Tournament.find_by!(slug: params[:id])
        rescue
          Tournament.find(params[:id])
        end
      end

      def tournament_params
        params.permit(:name, :description, :starts_at, :ends_at,
                      :total_segments_count, :rated_segments_count, :max_participants,
                      :city, :country)
      end

      def tournament_json(tournament, detailed: false)
        data = {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          description: tournament.description_html,
          status: tournament.status,
          starts_at: tournament.starts_at,
          ends_at: tournament.ends_at,
          total_segments_count: tournament.total_segments_count,
          rated_segments_count: tournament.rated_segments_count,
          participants_count: tournament.tournament_participants.count,
          city: tournament.city,
          country: tournament.country,
          is_participating: tournament.participating?(current_user)
        }

        if detailed
          data[:segments] = tournament.tournament_segments.includes(:segment).order(:order_number).map do |ts|
            {
              order_number: ts.order_number,
              # is_rated intentionally hidden from players — it's part of the Golden Fever mechanic
              segment: {
                id: ts.segment.id,
                name: ts.segment.name,
                description: ts.segment.description_html,
                distance_meters: ts.segment.distance_meters,
                start_point: ts.segment.start_point ? { lat: ts.segment.start_point.lat, lng: ts.segment.start_point.lon } : nil,
                end_point: ts.segment.end_point ? { lat: ts.segment.end_point.lat, lng: ts.segment.end_point.lon } : nil,
                polyline: polyline_to_coords(ts.segment.polyline)
              }
            }
          end
        end

        data
      end

      def polyline_to_coords(polyline)
        return nil unless polyline

        # Polyline is stored as MultiLineString — flatten all line strings into a single array of points
        lines = polyline.respond_to?(:geometries) ? polyline.geometries : [polyline]
        lines.flat_map { |line| line.points.map { |p| { lat: p.lat, lng: p.lon } } }
      rescue => e
        Rails.logger.warn "[polyline_to_coords] #{e.class}: #{e.message}"
        nil
      end

      def score_json(score, rank)
        {
          rank:,
          user: { id: score.user.id, full_name: score.user.full_name, avatar_url: score.user.profile_avatar_url },
          total_time_seconds: score.total_time_seconds,
          completed_segments: score.completed_segments_count,
          score: score.score
        }
      end
    end
  end
end
