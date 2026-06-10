class ExternalMatchChannel < ApplicationCable::Channel
  def subscribed
    # Reject subscriptions with a non-integer fixture_id to prevent channel
    # namespace pollution and probing for internal broadcast channels.
    fixture_id = params[:fixture_id].to_s
    return reject unless fixture_id.match?(/\A\d+\z/)

    stream_from "external_match_#{fixture_id}"
  end

  def unsubscribed
    stop_all_streams
  end
end
