ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    workers = ENV.key?("PARALLEL_WORKERS") ? ENV["PARALLEL_WORKERS"].to_i : :number_of_processors
    parallelize(workers: workers)

    fixtures :all
  end
end

class ActionDispatch::IntegrationTest
  def json_response
    JSON.parse(response.body, symbolize_names: true)
  end
end
