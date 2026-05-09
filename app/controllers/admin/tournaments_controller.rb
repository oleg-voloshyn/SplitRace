class Admin::TournamentsController < Admin::BaseController
  before_action :set_tournament, only: %i[show edit update destroy activate complete add_segment remove_segment]

  def index
    @tournaments = Tournament.includes(:created_by).order(created_at: :desc)
  end

  def show
    @tournament_segments = @tournament.tournament_segments.includes(:segment).order(:order_number)
    @available_segments  = Segment.active.where.not(id: @tournament.segment_ids).order(:name)
  end

  def new
    @tournament = Tournament.new(total_segments_count: 10, rated_segments_count: 5)
  end

  def create
    @tournament = Tournament.new(tournament_params.merge(created_by: @current_admin, scoring_type: "golden_fever"))
    if @tournament.save
      redirect_to admin_tournament_path(@tournament), notice: "Tournament created."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @tournament.update(tournament_params)
      redirect_to admin_tournament_path(@tournament), notice: "Updated."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @tournament.destroy
    redirect_to admin_tournaments_path, notice: "Deleted."
  end

  def activate
    actual_total  = @tournament.tournament_segments.count
    actual_rated  = @tournament.tournament_segments.where(is_rated: true).count

    if actual_total != @tournament.total_segments_count
      return redirect_to admin_tournament_path(@tournament),
        alert: "Cannot activate: need #{@tournament.total_segments_count} total segments, have #{actual_total}."
    end

    if actual_rated != @tournament.rated_segments_count
      return redirect_to admin_tournament_path(@tournament),
        alert: "Cannot activate: need #{@tournament.rated_segments_count} rated segments, have #{actual_rated}."
    end

    @tournament.activate!
    redirect_to admin_tournament_path(@tournament), notice: "Tournament is now active."
  rescue => e
    redirect_to admin_tournament_path(@tournament), alert: e.message
  end

  def complete
    @tournament.complete!
    redirect_to admin_tournament_path(@tournament), notice: "Tournament completed and scores finalized."
  rescue => e
    redirect_to admin_tournament_path(@tournament), alert: e.message
  end

  def add_segment
    segment  = Segment.find(params[:segment_id])
    is_rated = params[:is_rated] != "0"

    actual_total = @tournament.tournament_segments.count
    actual_rated = @tournament.tournament_segments.where(is_rated: true).count

    if actual_total >= @tournament.total_segments_count
      return redirect_to admin_tournament_path(@tournament),
        alert: "Cannot add more segments: tournament declared #{@tournament.total_segments_count} total."
    end

    if is_rated && actual_rated >= @tournament.rated_segments_count
      return redirect_to admin_tournament_path(@tournament),
        alert: "Cannot add more rated segments: tournament declared #{@tournament.rated_segments_count} rated."
    end

    order = actual_total + 1
    @tournament.tournament_segments.create!(segment: segment, order_number: order, is_rated: is_rated)
    redirect_to admin_tournament_path(@tournament), notice: "#{segment.name} added."
  rescue ActiveRecord::RecordNotUnique
    redirect_to admin_tournament_path(@tournament), alert: "Segment already in tournament."
  rescue => e
    redirect_to admin_tournament_path(@tournament), alert: e.message
  end

  def remove_segment
    ts = @tournament.tournament_segments.find_by!(segment_id: params[:segment_id])
    ts.destroy
    redirect_to admin_tournament_path(@tournament), notice: "Segment removed."
  end

  private

  def set_tournament
    @tournament = Tournament.find_by!(slug: params[:id])
  end

  def tournament_params
    params.require(:tournament).permit(
      :name, :description,
      :total_segments_count, :rated_segments_count,
      :starts_at, :ends_at, :city, :country, :max_participants
    )
  end
end
