require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module GolazoApp
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # mission_control-jobs 1.1 expects Sprockets (config.assets) and importmap,
    # neither of which this Vite-based app uses.
    #
    # load_defaults already ran above and correctly skipped Sprockets settings
    # because respond_to?(:assets) was false at that point. Now we add a
    # permissive singleton stub AFTER load_defaults so the engine's initializer
    # can call config.assets.paths << … without crashing.
    unless config.respond_to?(:assets)
      _stub = Object.new
      _stub.define_singleton_method(:method_missing) { |_m, *_a, &_b| self }
      _stub.define_singleton_method(:respond_to_missing?) { |*_| true }
      config.define_singleton_method(:assets) { _stub }
    end
    unless config.respond_to?(:importmap)
      _im_stub = Object.new
      _im_stub.define_singleton_method(:method_missing) { |_m, *_a, &_b| self }
      _im_stub.define_singleton_method(:respond_to_missing?) { |*_| true }
      config.define_singleton_method(:importmap) { _im_stub }
    end

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    config.time_zone = "UTC"
    config.api_only  = false
    config.active_job.queue_adapter = :solid_queue
  end
end
