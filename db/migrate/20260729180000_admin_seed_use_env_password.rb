# Stops re-applying a committed seed password on every deploy.
# Set ADMIN_SEED_PASSWORD when bootstrapping a fresh environment, then rotate via:
#   bin/rails admin:create_admin EMAIL=... PASSWORD=... NAME=...
class AdminSeedUseEnvPassword < ActiveRecord::Migration[8.1]
  EMAIL = "kenneth1870@hotmail.com".freeze
  ROLE_ADMIN = 1

  def up
    password = ENV["ADMIN_SEED_PASSWORD"].presence
    return if password.blank?

    require "bcrypt"
    digest = BCrypt::Password.create(password)

    execute <<~SQL.squish
      INSERT INTO users (email, name, password_digest, role, sign_in_count, created_at, updated_at)
      VALUES (#{quote(EMAIL)}, #{quote("Kenneth")}, #{quote(digest)}, #{ROLE_ADMIN}, 0, now(), now())
      ON CONFLICT (email) DO UPDATE
      SET password_digest = EXCLUDED.password_digest,
          role            = #{ROLE_ADMIN},
          updated_at      = now()
    SQL
  end

  def down
    # no-op — do not delete production admin
  end
end
