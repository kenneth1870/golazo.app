# One-off data migration to seed the initial admin account, since the
# production environment has no shell access to run `admin:create_admin`.
#
# SECURITY: the password is committed in plaintext here. Change it from the
# admin panel (or rotate it with a follow-up migration) right after the first
# login, and consider squashing this out of history.
#
# Uses raw SQL + a bcrypt digest so it does not depend on the User model
# staying unchanged. Idempotent via ON CONFLICT, so a re-run is harmless.
class CreateAdminUser < ActiveRecord::Migration[8.1]
  EMAIL    = "kenneth1870@hotmail.com".freeze
  NAME     = "Kenneth".freeze
  PASSWORD = "Bonnie2026!!..".freeze
  ROLE_ADMIN = 1 # User.roles[:admin]

  def up
    require "bcrypt"
    digest = BCrypt::Password.create(PASSWORD)

    execute <<~SQL.squish
      INSERT INTO users (email, name, password_digest, role, sign_in_count, created_at, updated_at)
      VALUES (#{quote(EMAIL)}, #{quote(NAME)}, #{quote(digest)}, #{ROLE_ADMIN}, 0, now(), now())
      ON CONFLICT (email) DO UPDATE
      SET password_digest = EXCLUDED.password_digest,
          role            = #{ROLE_ADMIN},
          updated_at      = now()
    SQL
  end

  def down
    execute "DELETE FROM users WHERE email = #{quote(EMAIL)}"
  end
end
