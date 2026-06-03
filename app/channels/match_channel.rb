class MatchChannel < ApplicationCable::Channel
  def subscribed
    match = Match.find_by(id: params[:match_id])
    if match
      stream_from "match_#{match.id}"
    else
      reject
    end
  end

  def unsubscribed
    stop_all_streams
  end
end
