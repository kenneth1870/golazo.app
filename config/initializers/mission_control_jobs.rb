# Mission Control Jobs — job monitoring dashboard at /jobs
#
# Protected by HTTP basic auth in non-development environments.
# Set JOBS_PASSWORD (and optionally JOBS_USER) in production credentials / env vars.
unless Rails.env.development?
  MissionControl::Jobs.http_basic_auth_enabled  = true
  MissionControl::Jobs.http_basic_auth_user     = ENV.fetch("JOBS_USER")
  MissionControl::Jobs.http_basic_auth_password = ENV.fetch("JOBS_PASSWORD")
end
