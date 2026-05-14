require "test_helper"

class RichTextDescriptionSanitizerTest < ActiveSupport::TestCase
  test "keeps safe rich text and removes executable html" do
    html = <<~HTML
      <div><strong>Safe</strong> <em>text</em></div>
      <script>alert("xss")</script>
      <img src=x onerror=alert(1)>
      <a href="javascript:alert(1)" onclick="alert(2)">bad link</a>
      <iframe src="https://evil.example"></iframe>
    HTML

    sanitized = RichTextDescriptionSanitizer.sanitize(html)

    assert_includes sanitized, "<strong>Safe</strong>"
    assert_includes sanitized, "<em>text</em>"
    assert_includes sanitized, ">bad link</a>"
    refute_includes sanitized, "<script"
    refute_includes sanitized, "alert(\"xss\")"
    refute_includes sanitized, "<img"
    refute_includes sanitized, "<iframe"
    refute_includes sanitized, "javascript:"
    refute_includes sanitized, "onclick"
  end
end
