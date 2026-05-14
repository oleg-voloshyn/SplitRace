class RichTextDescriptionSanitizer
  ALLOWED_TAGS = %w[
    a b blockquote br code div em h1 h2 h3 h4 i li ol p pre s strong u ul
  ].freeze

  ALLOWED_ATTRIBUTES = %w[href title].freeze

  DANGEROUS_ELEMENTS = %w[
    embed iframe math object script style svg
  ].freeze

  SANITIZER = Rails::HTML5::SafeListSanitizer.new

  def self.sanitize(html)
    return nil if html.nil?

    fragment = html_fragment(html.to_s)
    fragment.css(DANGEROUS_ELEMENTS.join(',')).remove

    sanitizer.sanitize(
      fragment.to_html,
      tags: ALLOWED_TAGS,
      attributes: ALLOWED_ATTRIBUTES
    ).presence
  end

  def self.sanitizer
    SANITIZER
  end

  def self.html_fragment(html)
    if defined?(Nokogiri::HTML5)
      Nokogiri::HTML5.fragment(html)
    else
      Nokogiri::HTML.fragment(html)
    end
  end
end
