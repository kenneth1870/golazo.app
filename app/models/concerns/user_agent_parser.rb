# Shared User-Agent parsing for any model that stores a `user_agent` string.
# Used by Device (analytics) and PushSubscription (push device list).
module UserAgentParser
  extend ActiveSupport::Concern

  def browser
    ua = user_agent.to_s
    return "Unknown" if ua.blank?
    case ua
    when /Edg\//         then "Edge"
    when /CriOS|Chrome/  then "Chrome"
    when /FxiOS|Firefox/ then "Firefox"
    when /Safari/        then "Safari"
    else "Other"
    end
  end

  def os
    case user_agent.to_s
    when /iPhone|iPad|iPod/    then "iOS"
    when /Android/            then "Android"
    when /Windows/            then "Windows"
    when /Mac OS X|Macintosh/ then "macOS"
    when /Linux/              then "Linux"
    else "Unknown"
    end
  end

  # "Chrome on Android", "Safari on iOS", etc.
  def device_label
    "#{browser} · #{os}"
  end
end
