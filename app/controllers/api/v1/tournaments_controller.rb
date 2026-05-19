module Api
  module V1
    class TournamentsController < BaseController
      before_action :set_tournament, only: %i[
        show update destroy join leave leaderboard activate complete submit_for_review add_segment remove_segment
        feed
      ]
      before_action :require_moderator!, only: %i[activate complete]
      before_action :require_tournament_owner!, only: %i[update destroy submit_for_review add_segment remove_segment]

      def index
        tournaments = Tournament.visible
                                .includes(tournament_segments: :segment)
                                .order(starts_at: :desc)
        render json: paginated(tournaments) { |t| serialize_tournament(t, view: :preview) }
      end

      def show
        render json: serialize_tournament(@tournament, view: tournament_owner?(@tournament) ? :owned : :detailed)
      end

      def mine
        tournaments = current_user.created_tournaments.order(created_at: :desc)
        render json: paginated(tournaments) { |t| serialize_tournament(t, view: :owned) }
      end

      def create
        tournament = Tournament.new(tournament_params.merge(created_by: current_user))
        if tournament.save
          render json: serialize_tournament(tournament), status: :created
        else
          render json: { errors: tournament.errors.full_messages }, status: :unprocessable_content
        end
      end

      def update
        unless @tournament.editable?
          return render json: { error: 'Tournament can only be edited while in draft or rejected status' },
                        status: :unprocessable_content
        end

        if @tournament.update(tournament_params)
          render json: serialize_tournament(@tournament, view: :owned)
        else
          render json: { errors: @tournament.errors.full_messages }, status: :unprocessable_content
        end
      end

      def destroy
        unless @tournament.draft?
          return render json: { error: 'Only draft tournaments can be deleted' },
                        status: :unprocessable_content
        end

        @tournament.destroy
        head :no_content
      end

      def add_segment
        segment = current_user.created_segments.active.find(params[:segment_id])
        position = requested_segment_position
        is_rated = params[:is_rated] != '0'

        if @tournament.tournament_segments.count >= @tournament.total_segments_count
          return render json: { error: 'No segment slots left' }, status: :unprocessable_content
        end

        if is_rated && @tournament.tournament_segments.where(is_rated: true).count >= @tournament.rated_segments_count
          return render json: { error: 'No rated segment slots left' }, status: :unprocessable_content
        end

        TournamentSegment.transaction do
          @tournament.tournament_segments
                     .where(order_number: position..)
                     .order(order_number: :desc)
                     .each { |ts| ts.update!(order_number: ts.order_number + 1) }

          @tournament.tournament_segments.create!(segment:, order_number: position, is_rated:)
        end

        render json: serialize_tournament(@tournament.reload, view: :owned)
      rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
        render json: { errors: [e.message] }, status: :unprocessable_content
      end

      def remove_segment
        @tournament.tournament_segments.find_by!(segment_id: params[:segment_id]).destroy
        normalize_segment_order!
        render json: serialize_tournament(@tournament.reload, view: :owned)
      end

      def submit_for_review
        @tournament.submit_for_review!
        render json: serialize_tournament(@tournament, view: :owned)
      rescue AASM::InvalidTransition
        render json: { error: 'Tournament is not ready for review' }, status: :unprocessable_content
      end

      def join
        if current_user.club?
          return render json: { error: 'Running clubs cannot participate in tournaments' }, status: :forbidden
        end

        return render json: { error: 'Already joined' }, status: :unprocessable_content if @tournament.participating?(current_user)
        return render json: { error: 'Tournament is not active' }, status: :unprocessable_content unless @tournament.active?

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

        pagy, records = pagy(scores)
        rated_segments    = @tournament.tournament_segments.where(is_rated: true).order(:order_number).to_a
        rated_segment_ids = rated_segments.map(&:segment_id)
        first_openers     = TournamentScore.first_opener_by_segment(@tournament, rated_segment_ids)
        participants_by_user_id = @tournament.tournament_participants.index_by(&:user_id)

        items = records.map.with_index(1) do |score, i|
          ScoreResource.new(score, params: {
                              rank: pagy.offset + i,
                              tournament: @tournament,
                              rated_segments:,
                              rated_segment_ids:,
                              first_openers:,
                              participants_by_user_id:
                            }).serializable_hash
        end

        render json: { items:, pagy: pagy_meta(pagy) }
      end

      def feed
        events = @tournament.tournament_events.includes(:actor, :segment).order(created_at: :desc).limit(50)
        render json: TournamentEventResource.new(events.to_a).serializable_hash
      end

      def activate
        @tournament.activate!
        render json: serialize_tournament(@tournament)
      rescue AASM::InvalidTransition => e
        render json: { error: e.message }, status: :unprocessable_content
      end

      def complete
        @tournament.complete!
        render json: serialize_tournament(@tournament)
      rescue AASM::InvalidTransition => e
        render json: { error: e.message }, status: :unprocessable_content
      end

      private

      def serialize_tournament(tournament, view: nil)
        TournamentResource.new(tournament, params: { view:, current_user: }).serializable_hash
      end

      def set_tournament
        @tournament = Tournament.friendly.find(params[:id])
      end

      def require_tournament_owner!
        render json: { error: 'Forbidden' }, status: :forbidden unless tournament_owner?(@tournament)
      end

      def tournament_owner?(tournament)
        tournament.created_by_id == current_user.id
      end

      def tournament_params
        params.permit(:name, :description, :starts_at, :ends_at,
                      :total_segments_count, :rated_segments_count, :max_participants,
                      :city, :country)
      end

      def requested_segment_position
        actual_total = @tournament.tournament_segments.count
        position = params[:order_number].to_i
        position = actual_total + 1 if position <= 0
        position.clamp(1, actual_total + 1)
      end

      def normalize_segment_order!
        @tournament.tournament_segments.order(:order_number, :id).each.with_index(1) do |ts, position|
          ts.update!(order_number: position) unless ts.order_number == position
        end
      end
    end
  end
end
