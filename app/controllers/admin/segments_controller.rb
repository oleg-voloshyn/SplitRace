module Admin
  class SegmentsController < Admin::BaseController
    before_action :set_segment, only: %i[edit update destroy]

    def index
      @sort = params[:sort].presence_in(%w[name distance city active created_at]) || 'created_at'
      @direction = sort_direction
      @query = params[:q].to_s.strip

      scope = Segment.includes(:created_by)
      if @query.present?
        pattern = "%#{ActiveRecord::Base.sanitize_sql_like(@query)}%"
        scope = scope.where(
          'segments.name ILIKE :q OR segments.city ILIKE :q OR segments.country ILIKE :q OR segments.description ILIKE :q',
          q: pattern
        )
      end

      scope = scope.order(segment_sort_order)
      @segments = paginate(scope)
    end

    def new
      @segment = Segment.new(is_active: true)
    end

    def edit; end

    def create
      @segment = Segment.new(segment_attrs.merge(created_by: @current_admin))
      if @segment.save
        redirect_to admin_segments_path, notice: "Segment \"#{@segment.name}\" created."
      else
        render :new, status: :unprocessable_content
      end
    end

    def update
      if @segment.update(segment_attrs)
        redirect_to admin_segments_path, notice: 'Segment updated.'
      else
        render :edit, status: :unprocessable_content
      end
    end

    def destroy
      @segment.destroy
      redirect_to admin_segments_path, notice: 'Deleted.'
    end

    private

    def set_segment
      @segment = Segment.find(params[:id])
    end

    def segment_sort_order
      column = case @sort
               when 'name' then 'segments.name'
               when 'distance' then 'segments.distance_meters'
               when 'city' then 'segments.city'
               when 'active' then 'segments.is_active'
               else 'segments.created_at'
               end

      Arel.sql("#{column} #{@direction}, segments.id desc")
    end

    def segment_attrs
      p = params.require(:segment).permit(:name, :description, :city, :country, :is_active, :waypoints_json)
      geo = build_geometry(p.delete(:waypoints_json))
      p.merge(geo)
    end

    def build_geometry(json)
      return {} if json.blank?

      pts = JSON.parse(json)
      return {} if pts.length < 2

      factory = RGeo::Geographic.spherical_factory(srid: 4326)
      rgeo_pts = pts.map { |p| factory.point(p['lng'].to_f, p['lat'].to_f) }

      {
        start_point: rgeo_pts.first,
        end_point: rgeo_pts.last,
        polyline: factory.multi_line_string([factory.line_string(rgeo_pts)]),
        distance_meters: haversine_total(pts)
      }
    rescue JSON::ParserError
      {}
    end

    def haversine_total(pts)
      pts.each_cons(2).sum { |a, b| haversine(a['lat'], a['lng'], b['lat'], b['lng']) }
    end

    def haversine(lat1, lng1, lat2, lng2)
      r   = 6_371_000
      rad = Math::PI / 180
      dlat = (lat2 - lat1) * rad
      dlng = (lng2 - lng1) * rad
      x = (Math.sin(dlat / 2)**2) + (Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (Math.sin(dlng / 2)**2))
      r * 2 * Math.asin(Math.sqrt(x))
    end
  end
end
