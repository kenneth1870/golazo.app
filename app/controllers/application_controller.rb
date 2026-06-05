class ApplicationController < ActionController::Base
  def spa
    @meta = PageMeta.for(request.path)
    render "application/spa", layout: false
  end
end
