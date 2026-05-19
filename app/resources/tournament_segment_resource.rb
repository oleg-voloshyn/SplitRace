class TournamentSegmentResource
  include Alba::Resource

  # views: :preview, :full, :full_owned

  attribute :segment do |ts|
    preview = (params[:view] == :preview)
    s = ts.segment
    base = {
      id: s.id,
      name: s.name,
      start_point: GeoFormatter.point(s.start_point),
      end_point: GeoFormatter.point(s.end_point),
      polyline: GeoFormatter.polyline(s.polyline)
    }
    next base if preview

    base.merge(
      description: s.description_html,
      city: s.city,
      country: s.country,
      distance_meters: s.distance_meters
    )
  end

  attribute :order_number, if: proc { params[:view] != :preview } do |ts|
    params[:view] == :full_owned ? ts.order_number : nil
  end

  attribute :is_rated, if: proc { params[:view] != :preview } do |ts|
    params[:view] == :full_owned ? ts.is_rated : nil
  end
end
