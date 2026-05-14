module SanitizesRichTextDescription
  extend ActiveSupport::Concern

  included do
    before_validation :sanitize_description
  end

  def description_html
    RichTextDescriptionSanitizer.sanitize(description)
  end

  private

  def sanitize_description
    self.description = description_html
  end
end
