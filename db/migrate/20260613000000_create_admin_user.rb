# One-off data migration to seed the initial admin account, since the
# production environment has no shell access to run `admin:create_admin`.
#
# SECURITY: never commit passwords here. For fresh environments set
# ADMIN_SEED_PASSWORD before migrating, or run:
#   bin/rails admin:create_admin EMAIL=... PASSWORD=... NAME=...
#
# Uses raw SQL + a bcrypt digest so it does not depend on the User model
# staying unchanged. Idempotent via ON CONFLICT DO NOTHING.
class CreateAdminUser < ActiveRecord::Migration[8.1]
  EMAIL      = "kenneth1870@hotmail.com".freeze
  NAME       = "Kenneth".freeze
  ROLE_ADMIN = 1 # User.roles[:admin]

  def up
    password = ENV["ADMIN_SEED_PASSWORD"].presence
    return say("Skipping admin seed — set ADMIN_SEED_PASSWORD or run admin:create_admin") if password.blank?

    require "bcrypt"
    digest = BCrypt::Password.create(password)

    execute <<~SQL.squish
      INSERT INTO users (email, name, password_digest, role, sign_in_count, created_at, updated_at)
      VALUES (#{quote(EMAIL)}, #{quote(NAME)}, #{quote(digest)}, #{ROLE_ADMIN}, 0, now(), now())
      ON CONFLICT (email) DO NOTHING
    SQL
  end

  def down
    execute "DELETE FROM users WHERE email = #{quote(EMAIL)}"
  end
end
