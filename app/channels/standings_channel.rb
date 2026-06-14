class StandingsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "standings_updates"
  end

  def unsubscribed
    stop_all_streams
  end
end
