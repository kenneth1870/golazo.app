class LiveScoresChannel < ApplicationCable::Channel
  # Single shared stream for all live score changes across every match.
  # List views (Today, Home) subscribe here so a goal pushes to them
  # instantly instead of relying on a 30s poll.
  def subscribed
    stream_from "live_scores"
  end

  def unsubscribed
    stop_all_streams
  end
end
