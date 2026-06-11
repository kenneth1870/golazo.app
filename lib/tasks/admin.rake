# lib/tasks/admin.rake
# Usage:
#   bin/rails admin:create_admin EMAIL=you@example.com PASSWORD=secret123 NAME="Your Name"
namespace :admin do
  desc "Create or promote an admin user. Env: EMAIL, PASSWORD, NAME"
  task create_admin: :environment do
    email    = ENV.fetch("EMAIL") { abort "Usage: bin/rails admin:create_admin EMAIL=... PASSWORD=... NAME=..." }
    password = ENV.fetch("PASSWORD") { abort "PASSWORD required" }
    name     = ENV.fetch("NAME", email.split("@").first.capitalize)

    user = User.find_or_initialize_by(email: email.downcase.strip)
    user.name     = name
    user.role     = :admin
    user.password = password
    user.password_confirmation = password

    if user.save
      puts "✓ Admin user #{user.email} (#{user.name}) saved — role: #{user.role}"
    else
      puts "✗ Failed: #{user.errors.full_messages.join(', ')}"
    end
  end
end
