class ApplicationController < ActionController::Base
  def spa
    render "application/spa", layout: false
  end
end
