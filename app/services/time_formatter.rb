module TimeFormatter
  module_function

  # Formats a duration in seconds as HH:MM:SS (or MM:SS if under an hour).
  def hms(seconds)
    secs = seconds.to_i
    hours   = secs / 3600
    minutes = (secs % 3600) / 60
    seconds = secs % 60
    return format('%<h>02d:%<m>02d:%<s>02d', h: hours, m: minutes, s: seconds) if hours.positive?

    format('%<m>02d:%<s>02d', m: minutes, s: seconds)
  end
end
