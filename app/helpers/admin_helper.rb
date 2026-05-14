module AdminHelper
  def rich_text_description_editor(form, attribute = :description)
    input_id = "#{form.object_name}_#{attribute}".tr('][', '_').delete_suffix('_')

    safe_join([
                form.hidden_field(attribute, id: input_id),
                content_tag('trix-editor', '', input: input_id, class: 'trix-content sr-rich-text-editor')
              ])
  end

  def rich_text_description_html(record)
    sanitize(
      record.description_html,
      tags: RichTextDescriptionSanitizer::ALLOWED_TAGS,
      attributes: RichTextDescriptionSanitizer::ALLOWED_ATTRIBUTES
    )
  end

  def admin_sort_link(label, sort_key)
    active = @sort == sort_key.to_s
    next_direction = active && @direction == 'asc' ? 'desc' : 'asc'
    icon = active ? (@direction == 'asc' ? ' ↑' : ' ↓') : ''
    query = request.query_parameters.except('page').merge('sort' => sort_key, 'direction' => next_direction)

    link_to "#{label}#{icon}", query, class: 'text-decoration-none text-reset'
  end

  def admin_pagination
    return if @total_pages.to_i <= 1

    render partial: 'admin/shared/pagination'
  end

  def segment_waypoints_json(segment)
    return '[]' unless segment.polyline

    line = segment.polyline.respond_to?(:geometry_n) ? segment.polyline.geometry_n(0) : segment.polyline
    points = line.respond_to?(:points) ? line.points : (0...line.num_points).map { |i| line.point_n(i) }

    points.map { |pt| { lat: point_lat(pt), lng: point_lng(pt) } }.to_json
  rescue
    '[]'
  end

  def point_lat(point)
    point.respond_to?(:lat) ? point.lat : point.latitude
  end

  def point_lng(point)
    point.respond_to?(:lon) ? point.lon : point.longitude
  end

  def format_seconds(secs)
    return '—' if secs.blank? || secs.to_i <= 0

    s = secs.to_i
    h = s / 3600
    m = (s % 3600) / 60
    sec = s % 60
    if h.positive?
      format('%<hours>d:%<minutes>02d:%<seconds>02d', hours: h, minutes: m, seconds: sec)
    else
      format('%<minutes>d:%<seconds>02d', minutes: m, seconds: sec)
    end
  end

  def format_pace(secs, meters)
    return '—' if secs.blank? || meters.blank? || meters.to_f <= 0 || secs.to_i <= 0

    secs_per_km = secs.to_f / meters * 1000
    m = (secs_per_km / 60).floor
    s = (secs_per_km % 60).round
    format('%<minutes>d:%<seconds>02d /km', minutes: m, seconds: s)
  end
end
