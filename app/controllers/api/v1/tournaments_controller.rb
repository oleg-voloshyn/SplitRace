module Api
  module V1
    class TournamentsController < BaseController
      before_action :set_tournament, only: %i[show join leave leaderboard activate complete]
      before_action :require_moderator!, only: %i[create update activate complete]

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
          render json: { errors: tournament.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def join
        return render json: { error: "Already joined" }, status: :unprocessable_entity if @tournament.participating?(current_user)
        return render json: { error: "Tournament is not active" }, status: :unprocessable_entity unless @tournament.status == "active"

        @tournament.tournament_participants.create!(user: current_user)
        render json: { joined: true }
      end

      def leave
        participant = @tournament.participant_for(current_user)
        return render json: { error: "Not participating" }, status: :unprocessable_entity unless participant

        participant.destroy
        render json: { left: true }
      end

      def leaderboard
        gender = params[:gender].presence
        scores = @tournament.tournament_scores
          .includes(:user)
          .where.not(total_time_seconds: nil)
          .order(:total_time_seconds)

        scores = scores.joins(:user).where(users: { gender: gender }) if gender

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
        @tournament = Tournament.find_by!(slug: params[:id]) rescue Tournament.find(params[:id])
      end

      def tournament_params
        params.permit(:name, :description, :scoring_type, :starts_at, :ends_at,
                      :total_segments_count, :rated_segments_count, :max_participants,
                      :city, :country)
      end

      def tournament_json(tournament, detailed: false)
        data = {
          id:                     tournament.id,
          name:                   tournament.name,
          slug:                   tournament.slug,
          description:            tournament.description,
          status:                 tournament.status,
          scoring_type:           tournament.scoring_type,
          starts_at:              tournament.starts_at,
          ends_at:                tournament.ends_at,
          total_segments_count:   tournament.total_segments_count,
          rated_segments_count:   tournament.rated_segments_count,
          participants_count:     tournament.tournament_participants.count,
          city:                   tournament.city,
          country:                tournament.country,
          is_participating:       tournament.participating?(current_user)
        }

        if detailed
          data[:segments] = tournament.tournament_segments.includes(:segment).order(:order_number).map do |ts|
            {
              order_number: ts.order_number,
              is_rated:     ts.is_rated,
              segment: {
                id:              ts.segment.id,
                name:            ts.segment.name,
                distance_meters: ts.segment.distance_meters
              }
            }
          end
        end

        data
      end

      def score_json(score, rank)
        {
          rank:                    rank,
          user:                    { id: score.user.id, full_name: score.user.full_name, avatar_url: score.user.avatar_url },
          total_time_seconds:      score.total_time_seconds,
          completed_segments:      score.completed_segments_count,
          score:                   score.score
        }
      end
    end
  end
end
