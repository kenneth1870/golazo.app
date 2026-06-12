# Golazo.app — FIFA World Cup 2026 Live Scores

> Live scores · Real-time stats · Full bracket · Push notifications
> **golazo.app** — hosted on [Render.com](https://render.com)

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Ruby on Rails 8.1 (API mode) |
| Frontend | React 19 + Vite (`vite_rails`) |
| Database | PostgreSQL 15 |
| Jobs | Solid Queue (DB-backed, runs inside Puma) |
| Cache | Solid Cache (DB-backed) |
| WebSockets | Solid Cable (ActionCable over Postgres) |
| Auth | JWT (`jwt` gem) + bcrypt |
| Push | Web Push / VAPID (`web-push` gem) |
| Observability | Sentry |
| Rate limiting | Rack::Attack |
| Deployment | Docker → Render.com |

---

## Features

- **Live scores** — auto-refreshing match list with live minute, score, and red-card display
- **Today / Fixtures / Results** — date-navigable strip with client-timezone-aware filtering (no cross-midnight bleed)
- **Group stage** — all 12 groups with mini standings tables and FIFA tiebreakers
- **Knockout bracket** — official FIFA 2026 R32 → R16 → QF → SF → Final bracket; auto-populates as teams advance
- **Bracket predictor** — users can fill in their own bracket predictions
- **Match detail** — summary, stats, lineups (pitch grid), H2H, injuries, player ratings, venue photo, AI-generated match summary
- **Team & player pages** — squad, stats, transfers, trophies
- **Score predictions** — predict scorelines before kickoff; graded leaderboard after FT
- **Push notifications** — VAPID Web Push for match reminders and live score alerts; per-team subscriptions
- **PWA** — installable, service worker with network-first API caching and offline fallback
- **i18n** — 8 languages (EN, ES, PT, FR, DE, AR, JA, KO); IP-based auto-detection, manual override persisted in `localStorage`
- **News feed** — live football news filtered to match context
- **Admin panel** — match score entry, standings recalculation, push broadcast, user management

---

## Data sources

| Source | Used for |
|---|---|
| [API-Football (API-Sports) v3](https://www.api-football.com) | Live scores, lineups, stats, player ratings, injuries, predictions, odds |
| [football-data.org](https://www.football-data.org) | One-off WC metadata sync (teams, fixtures) |

Live data flows through two clients:
- `LiveScoresClient` — wraps API-Football v3, used for all match-day queries
- `ApiSportsClient` — resolves internal fixture IDs when needed

---

## Setup

### Requirements

- Ruby **3.2.2** (pinned in `.ruby-version`; 3.3 has an ActionView syntax error on darwin 25)
- Node **22.x**
- PostgreSQL **15+**

### Environment variables

```bash
# Required
DATABASE_URL=postgres://...
RAILS_MASTER_KEY=...                  # decrypts credentials.yml.enc

# Live scores API (required for any score data)
RAPIDAPI_KEY=your_api_football_key    # API-Football via RapidAPI or direct

# Auth & security
JWT_SECRET=...                        # signs JWT tokens; defaults to secret_key_base if unset
ADMIN_API_TOKEN=...                   # static Bearer token for data-sync scripts
ALLOWED_ORIGINS=https://golazo.app   # comma-separated CORS allowlist

# Web Push (optional — push notifications disabled if unset)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com  # contact address required by push servers

# Optional
FOOTBALL_DATA_API_KEY=...             # football-data.org, for one-off WC metadata imports
SENTRY_DSN=...                        # error tracking; inert if unset
```

Generate VAPID keys:
```bash
rails webpush:generate_keys
```

### Install & run

```bash
bundle install
npm install

rails db:create db:migrate db:seed
# seed imports WC teams, all 104 group fixtures, and the knockout bracket skeleton
```

Two terminals for local development:
```bash
rails server          # API + ActionCable on :3000
npm run dev           # Vite HMR (proxies to Rails)
```

The app is served entirely from `:3000` in development. Vite assets are proxied transparently.

---

## Architecture

### Request flow

```
Browser → Service Worker (network-first for /api/*, cache-first for assets)
       → Rails API (JSON only)
           ├── Solid Cache (standings, fixtures — 15-30 min TTL)
           ├── LiveScoresClient → API-Football v3
           └── ActionCable → Solid Cable → browser (live score push)
```

### Background jobs (Solid Queue, runs inside Puma)

| Job | Schedule | Purpose |
|---|---|---|
| `SyncStandingsJob` | every 30 min | Syncs WC standings from API-Football |
| `RecalculateStandingsJob` | on FT | Recomputes standings from DB results with FIFA tiebreakers |
| `SyncScoresJob` | every 2 min on match days | Polls live scores, broadcasts via ActionCable |

Recurring schedule is defined in `config/recurring.yml` (production only).

### Timezone handling

All date filtering uses the **client's IANA timezone** (sent as `?tz=America/Mexico_City`). The backend converts to a UTC range via `TZInfo` so matches near local midnight are never dropped. This applies to `/api/v1/matches`, `/api/v1/fixtures`, `/api/v1/results`, and `/api/v1/today`.

### Standings

`WorldCupStandings` computes group tables purely from finished DB matches, applying FIFA tiebreakers in order: points → goal difference → goals for → head-to-head (points, GD, GF) → alphabetical. Results are written to the `standings` table and cached for 15 minutes.

### Knockout bracket

`WorldCupKnockout` maintains the official FIFA 2026 bracket (R32 match numbers 73–88, R16 pairings, QF, SF, Final) and auto-fills slots as matches finish. The third-place table for the 16 R32 best-third slots follows the 495-combination FIFA lookup — approximated until after the group stage (June 25, 2026).

---

## Key files

| Path | Purpose |
|---|---|
| `app/services/live_scores_client.rb` | API-Football v3 wrapper — scores, lineups, ratings |
| `app/services/world_cup_standings.rb` | FIFA tiebreaker standings calculator |
| `app/services/world_cup_knockout.rb` | Bracket slot assignment |
| `app/services/world_cup_sync.rb` | Full WC data sync orchestrator |
| `app/controllers/api/v1/today_controller.rb` | Merges DB + API matches, deduplicates |
| `app/controllers/api/v1/base_controller.rb` | JWT auth, timezone helpers, cache headers |
| `app/frontend/hooks/useMatches.js` | Module-level match cache + polling (shared across all components) |
| `app/frontend/pages/MatchShowPage.jsx` | Full match detail page |
| `app/frontend/pages/scores/GroupStagePage.jsx` | Group stage with mini standings |
| `app/frontend/pages/scores/KnockoutPage.jsx` | Bracket visualisation |
| `db/world_cup_group_fixtures.yml` | Canonical WC 2026 group schedule (source of truth for seeding) |
| `public/sw.js` | Service worker — network-first API, cache-first assets, push handler |
| `config/recurring.yml` | Solid Queue recurring job schedule (production) |

---

## Admin endpoints

All admin routes require `Authorization: Bearer <ADMIN_API_TOKEN>` or a valid admin JWT.

| Method | Path | Action |
|---|---|---|
| `GET` | `/api/v1/admin/standings` | Computed standings (no N+1) |
| `POST` | `/api/v1/admin/standings/recalculate` | Recalculate from DB + bust cache |
| `PATCH` | `/api/v1/admin/matches/:id` | Update score / status |
| `POST` | `/api/v1/admin/push/broadcast` | Send push to all subscribers |

---

## Deployment (Render.com)

```bash
# Build command (in render.yaml / Dockerfile)
bundle exec rails assets:precompile
bundle exec rails db:migrate

# Start command
bundle exec thrust bundle exec puma -C config/puma.rb
```

`Thruster` sits in front of Puma to handle HTTP/2, asset compression, and X-Sendfile.
All three Solid adapters (Queue, Cache, Cable) share the same Postgres connection pool — no Redis required.

---

## Reload the WC schedule

If the fixture list changes:

```bash
# Re-import group fixtures from db/world_cup_group_fixtures.yml
rails golazo:load_schedule

# Recalculate standings + rebuild bracket from current DB state
rails runner "RecalculateStandingsJob.perform_now"
```

---

## License

Private — all rights reserved.
