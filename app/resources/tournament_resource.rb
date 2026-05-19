class TournamentResource
  include Alba::Resource

  # views: nil/:base (default), :preview, :detailed, :owned

  attributes :id, :name, :slug, :status, :starts_at, :ends_at,
             :total_segments_count, :rated_segments_count,
             :city, :country, :review_note, :submitted_for_review_at

  attribute :description, &:description_html

  attribute :participants_count do |t|
    t.tournament_participants.count
  end

  one :created_by, resource: CreatorResource

  attribute :is_owner do |t|
    t.created_by_id == params[:current_user].id
  end

  attribute :can_participate do
    !params[:current_user].club?
  end

  attribute :is_participating do |t|
    !params[:current_user].club? && t.participating?(params[:current_user])
  end

  attribute :segments_preview, if: proc { params[:view] == :preview } do |t|
    ts = t.tournament_segments.includes(:segment).order(:order_number).to_a
    TournamentSegmentResource.new(ts, params: { view: :preview }).serializable_hash
  end

  attribute :segments, if: proc { %i[detailed owned].include?(params[:view]) } do |t|
    owned    = (params[:view] == :owned)
    relation = t.tournament_segments.includes(:segment)
    relation = owned ? relation.order(:order_number) : relation.joins(:segment).order('segments.name ASC')
    view     = owned ? :full_owned : :full
    TournamentSegmentResource.new(relation.to_a, params: { view: }).serializable_hash
  end

  attribute :feed, if: proc { %i[detailed owned].include?(params[:view]) } do |t|
    events = t.tournament_events.includes(:actor, :segment).order(created_at: :desc).limit(50).to_a
    TournamentEventResource.new(events).serializable_hash
  end
end
