class PwaController < ApplicationController
  skip_before_action :verify_authenticity_token
  skip_before_action :authenticate_user!, raise: false

  def service_worker
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["X-Content-Type-Options"] = "nosniff"
    render "pwa/service_worker", layout: false, content_type: "application/javascript"
  end
end
