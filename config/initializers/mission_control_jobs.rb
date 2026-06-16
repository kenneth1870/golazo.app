# Mission Control Jobs — job monitoring dashboard at /jobs
#
# Protected by HTTP basic auth in non-development environments.
# Set JOBS_PASSWORD (and optionally JOBS_USER) in production credentials / env vars.
unless Rails.env.development?
  jobs_user = ENV["JOBS_USER"]
  jobs_pass = ENV["JOBS_PASSWORD"]
  if jobs_user.present? && jobs_pass.present?
    MissionControl::Jobs.http_basic_auth_enabled  = true
    MissionControl::Jobs.http_basic_auth_user     = jobs_user
    MissionControl::Jobs.http_basic_auth_password = jobs_pass
  end
end
