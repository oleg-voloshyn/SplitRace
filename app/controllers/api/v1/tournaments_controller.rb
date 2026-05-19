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
        render json: tournaments.map { |t| tournament_json(t, preview: true) }
      end

      def show
        render json: tournament_json(@tournament, detailed: true, owned: tournament_owner?(@tournament))
      end

      def mine
        tournaments = current_user.created_tournaments.order(created_at: :desc)
        render json: tournaments.map { |t| tournament_json(t, owned: true) }
      end

      def create
        tournament = Tournament.new(tournament_params.merge(created_by: current_user))
        if tournament.save
          render json: tournament_json(tournament), status: :created
        else
          render json: { errors: tournament.errors.full_messages }, status: :unprocessable_content
        end
      end

      def update
        unless %w[draft rejected].include?(@tournament.status)
          return render json: { error: 'Tournament can only be edited while in draft or rejected status' },
                        status: :unprocessable_content
        end

        if @tournament.update(tournament_params)
          render json: tournament_json(@tournament, detailed: true, owned: true)
        else
          render json: { errors: @tournament.errors.full_messages }, status: :unprocessable_content
        end
      end

      def destroy
        unless @tournament.status == 'draft'
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

        render json: tournament_json(@tournament.reload, detailed: true, owned: true)
      rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique => e
        render json: { errors: [e.message] }, status: :unprocessable_content
      end

      def remove_segment
        @tournament.tournament_segments.find_by!(segment_id: params[:segment_id]).destroy
        normalize_segment_order!
        render json: tournament_json(@tournament.reload, detailed: true, owned: true)
      end

      def submit_for_review
        return render json: { error: 'Tournament is not ready for review' }, status: :unprocessable_content unless @tournament.ready_for_review?

        @tournament.submit_for_review!
        render json: tournament_json(@tournament, owned: true)
      end

      def join
        if current_user.club?
          return render json: { error: 'Running clubs cannot participate in tournaments' }, status: :forbidden
        end

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

        render json: scores.map.with_index(1) { |s, i| score_json(s, i, @tournament) }
      end

      def feed
        render json: tournament_events_json(@tournament)
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

      def tournament_json(tournament, detailed: false, owned: false, preview: false)
        data = base_tournament_json(tournament)

        if detailed || owned
          data[:segments] = tournament_segments_json(tournament, owned:)
          data[:feed] = tournament_events_json(tournament)
        elsif preview
          data[:segments_preview] = tournament_segments_json(tournament, owned: false, preview: true)
        end

        data
      end

      def base_tournament_json(tournament)
        can_participate = !current_user.club?
        {
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
          review_note: tournament.review_note,
          submitted_for_review_at: tournament.submitted_for_review_at,
          created_by: creator_json(tournament.created_by),
          is_owner: tournament.created_by_id == current_user.id,
          is_participating: can_participate && tournament.participating?(current_user),
          can_participate:
        }
      end

      def creator_json(user)
        {
          id: user.id,
          display_name: user.display_name,
          account_type: user.account_type
        }
      end

      def tournament_segments_json(tournament, owned:, preview: false)
        segments = tournament.tournament_segments.includes(:segment)
        segments = if owned || preview
                     segments.order(:order_number)
                   else
                     segments.joins(:segment).order('segments.name ASC')
                   end

        segments.map { |ts| tournament_segment_json(ts, owned:, preview:) }
      end

      def tournament_segment_json(tournament_segment, owned:, preview:)
        data = {
          segment: segment_json(tournament_segment.segment, preview:)
        }
        data[:order_number] = owned ? tournament_segment.order_number : nil unless preview
        data[:is_rated] = owned ? tournament_segment.is_rated : nil unless preview
        data
      end

      def segment_json(segment, preview:)
        data = {
          id: segment.id,
          name: segment.name,
          start_point: segment.start_point ? { lat: segment.start_point.lat, lng: segment.start_point.lon } : nil,
          end_point: segment.end_point ? { lat: segment.end_point.lat, lng: segment.end_point.lon } : nil,
          polyline: polyline_to_coords(segment.polyline)
        }
        return data if preview

        data.merge(
          description: segment.description_html,
          city: segment.city,
          country: segment.country,
          distance_meters: segment.distance_meters
        )
      end

      def tournament_events_json(tournament)
        tournament.tournament_events
                  .includes(:actor, :segment)
                  .order(created_at: :desc)
                  .limit(50)
                  .map { |event| tournament_event_json(event) }
      end

      def tournament_event_json(event)
        text = localized_event_text(event)
        {
          id: event.id,
          event_type: event.event_type,
          title: text[:title] || event.title,
          body: text[:body] || event.body,
          created_at: event.created_at,
          actor: {
            id: event.actor.id,
            display_name: event.actor.display_name,
            avatar_url: event.actor.profile_avatar_url
          },
          segment: event.segment && {
            id: event.segment.id,
            name: event.segment.name
          }
        }
      end

      def localized_event_text(event)
        return {} unless event.event_type == 'segment_unlocked' && event.metadata.present?

        TournamentEventPublisher.localize_segment_unlocked(event.metadata, I18n.locale)
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

      def score_json(score, rank, tournament)
        rated_segments = tournament.tournament_segments.where(is_rated: true).order(:order_number)
        rated_segment_ids = rated_segments.pluck(:segment_id)
        best_efforts = SegmentEffort
                       .where(user: score.user, segment_id: rated_segment_ids)
                       .order(:segment_id, :elapsed_time_seconds)
                       .to_a
                       .uniq(&:segment_id)
        completed_segment_ids = best_efforts.to_set(&:segment_id)
        next_required = rated_segments.find { |ts| completed_segment_ids.exclude?(ts.segment_id) }
        first_openers = TournamentScore.first_opener_by_segment(tournament, rated_segment_ids)
        last_unlock_at = tournament.tournament_events
                                   .where(actor: score.user, event_type: 'segment_unlocked')
                                   .maximum(:created_at)

        {
          rank:,
          overall_rank: score.rank,
          gender_rank: score.gender_rank,
          user: {
            id: score.user.id,
            full_name: score.user.full_name,
            avatar_url: score.user.profile_avatar_url,
            gender: score.user.gender
          },
          total_time_seconds: best_efforts.sum(&:elapsed_time_seconds),
          completed_segments: score.completed_segments_count,
          rated_segments_count: rated_segment_ids.size,
          next_required_position: next_required&.order_number,
          first_opener_bonus_count: completed_segment_ids.count { |segment_id| first_openers[segment_id] == score.user_id },
          last_unlock_at:,
          rank_delta: nil,
          score: score.score
        }
      end
    end
  end
end
