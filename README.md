# Golazo.app — Mundial 2026 Live Scores

Live scores, real-time stats, and every goal from the FIFA World Cup 2026 (USA · Canada · Mexico) and international football.

## Stack

- **Backend**: Ruby on Rails 8.1 API + PostgreSQL
- **Frontend**: React 18 + Vite (via `vite_rails`)
- **Data**: [free-api-live-football-data](https://rapidapi.com/heisenbug/api/free-api-live-football-data) on RapidAPI (FotMob-based)
- **i18n**: 8 languages (EN, ES, PT, FR, DE, AR, JA, KO) with IP-based auto-detection

## Features

- **Live Matches** — date-navigable strip (±3 days), auto-refresh, live minute display
- **Team logos** — FotMob CDN resolved from team IDs
- **Timezone-aware** — IP geolocation sets language + timezone; date filter uses browser local time so no cross-midnight bleed
- **Featured leagues only** — International Friendlies, UEFA competitions, top domestic leagues; obscure/lower-tier and women's matches filtered out
- **Match detail** — Summary, Stats, Lineups (pitch grid), H2H fetched in parallel threads
- **i18n** — IP → country → language mapping; manual override persisted in localStorage

## Setup

### Requirements

- Ruby 3.2.2 (pinned in `.ruby-version`; 3.3 has an actionview SyntaxError on darwin25)
- Node 22.x
- PostgreSQL 15+

### Environment variables

```
DATABASE_URL=postgres://...
RAPIDAPI_KEY=your_rapidapi_key       # free-api-live-football-data on RapidAPI (required)
FOOTBALL_DATA_API_KEY=...            # football-data.org, for one-off WC metadata sync (optional)
ADMIN_API_TOKEN=...                  # Bearer token required by the write endpoints
                                     #   (matches#update, goals#create, stats/upsert).
                                     #   If unset, those endpoints reject every request.
ALLOWED_ORIGINS=https://your-host    # comma-separated CORS allowlist (default http://localhost:3036)
SENTRY_DSN=...                       # error monitoring (optional; inert if unset)
RAPIDAPI_WC_LEAGUE_ID=4              # override the FotMob WC league id if needed
```

### Install & run

```bash
bundle install
npm install
rails db:create db:migrate db:seed   # seed loads WC teams, group fixtures, and the knockout bracket

# Two terminals:
rails server    # http://localhost:3000
npm run dev     # Vite HMR on :3036
```

### Production notes

- **Caching** uses Solid Cache and **Action Cable** uses Solid Cable — both backed by the
  primary Postgres DB so they work across the web and Solid Queue worker processes. (The
  `async` cable adapter only works in a single process and would silently drop live updates.)
- **Recurring syncs** are defined once in `config/recurring.yml` (production only) and run
  inside Puma via the Solid Queue plugin.
- **Rate limiting** is enforced by `rack-attack` (see `config/initializers/rack_attack.rb`).
- **Schedule data** lives in `db/world_cup_group_fixtures.yml`; reload it any time with
  `rails golazo:load_schedule` (group fixtures + knockout bracket).

## Key files

| File | Purpose |
|------|---------|
| `app/services/live_scores_client.rb` | RapidAPI client — fetches today+tomorrow, normalizes, filters leagues |
| `app/controllers/api/v1/today_controller.rb` | Merges DB + API matches, deduplicates |
| `app/frontend/pages/scores/TodayPage.jsx` | Date strip, match list, local timezone filter |
| `app/frontend/hooks/useLocale.js` | IP geolocation → language + timezone |
| `app/frontend/i18n/` | Translation files for 8 languages |

## API notes

- `football-get-matches-by-date` requires `YYYYMMDD` format
- FotMob buckets matches by ~UTC+1 day boundary — late-evening games appear in the next UTC day bucket, so we fetch both `date` and `date+1` then filter client-side by local timezone
- Team logos: `https://images.fotmob.com/image_resources/logo/teamlogo/{id}_large.png`
- Match detail uses `eventid` param (not `matchId`)
- Status codes: 2/3=live halves, 10/11=half-time, 6=FT, 9/13/14=postponed/abandoned
