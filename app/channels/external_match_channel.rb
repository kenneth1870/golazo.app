class ExternalMatchChannel < ApplicationCable::Channel
  def subscribed
    stream_from "external_match_#{params[:fixture_id]}"
  end

  def unsubscribed
    stop_all_streams
  end
end
