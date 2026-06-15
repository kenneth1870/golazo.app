# Send a push notification for a single match — forced to Spanish — to every
# subscriber following either team (plus global subscribers).
#
# Usage (run with rails runner so the app is loaded):
#
#   # By team names (case-insensitive, partial match on either side):
#   bin/rails runner script/send_match_notification.rb "Germany" "Curacao" prematch
#
#   # Goal with a score:
#   bin/rails runner script/send_match_notification.rb "Germany" "Curacao" goal 2 1 67
#
#   # Full-time with a score:
#   bin/rails runner script/send_match_notification.rb "Germany" "Curacao" fulltime 2 1
#
#   # By match id instead of team names:
#   bin/rails runner script/send_match_notification.rb --id 378 prematch
#
# Event types: prematch | goal | fulltime | halftime | kickoff | red_card
# Args after the event: [home_score] [away_score] [minute]

require "web-push"

args = ARGV.dup

# ── Resolve the match ────────────────────────────────────────────────────────
match =
  if args.first == "--id"
    args.shift
    Match.find(args.shift.to_i)
  else
    home_q = args.shift.to_s
    away_q = args.shift.to_s
    abort "Provide home and away team names, or --id <match_id>" if home_q.blank? || away_q.blank?
    Match.includes(:home_team, :away_team)
         .joins(:home_team, :away_team)
         .where("LOWER(teams.name) LIKE ?", "%#{home_q.downcase}%")
         .references(:home_team)
         .detect { |m| m.away_team&.name&.downcase&.include?(away_q.downcase) } ||
      abort("No match found for '#{home_q}' vs '#{away_q}'")
  end

event   = (args.shift || "prematch").to_s
home_sc = args.shift
away_sc = args.shift
minute  = args.shift

home = TeamNameTranslator.translate(match.home_team&.name.to_s, "es")
away = TeamNameTranslator.translate(match.away_team&.name.to_s, "es")
score = (home_sc && away_sc) ? "#{home_sc}–#{away_sc}" : nil
url   = "/matches/#{match.external_id || "db-#{match.id}"}"

# ── Build Spanish copy (reuse the job's own builder so wording stays in sync) ──
job = MatchEventNotificationJob.new
title, body = job.send(:build_copy_es, event, home, away, score, minute&.to_i)

subs = PushSubscription.for_teams([ home, away ]).to_a
puts "Match:    #{home} vs #{away} (id=#{match.id})"
puts "Event:    #{event}#{score ? " #{score}" : ""}#{minute ? " #{minute}'" : ""}"
puts "Copy:     #{title} | #{body}"
puts "Targets:  #{subs.length} subscriber(s)"
abort "No subscribers — nothing to send." if subs.empty?

payload = {
  title: title, body: body, url: url,
  icon: "/images/apple-touch-icon.png?v=2",
  badge: "/images/badge-72.png",
  match_id: match.id
}.to_json

ok = 0
subs.each do |sub|
  WebPush.payload_send(
    message: payload, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth,
    vapid: {
      subject:     ENV["VAPID_SUBJECT"],
      public_key:  ENV["VAPID_PUBLIC_KEY"],
      private_key: ENV["VAPID_PRIVATE_KEY"]
    },
    ttl: 300
  )
  ok += 1
  puts "  ✓ sent to sub #{sub.id} (#{sub.push_provider})"
rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription => e
  puts "  ✗ removing stale sub #{sub.id}: #{e.message}"
  sub.destroy
rescue => e
  puts "  ✗ sub #{sub.id} failed: #{e.class}: #{e.message}"
end

puts "Done — #{ok}/#{subs.length} delivered."
