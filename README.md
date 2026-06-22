# ⚽ Golazo.app — FIFA World Cup 2026

> **Live scores · Real-time stats · Full bracket · Push notifications · Stadium pages · AI summaries**
> Deployed at **golazo.app** — built for the 2026 World Cup in USA, Canada & Mexico

![Ruby](https://img.shields.io/badge/Ruby-3.2.2-CC342D?style=flat-square&logo=ruby)
![Rails](https://img.shields.io/badge/Rails-8.1-CC0000?style=flat-square&logo=rubyonrails)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql)
![Render](https://img.shields.io/badge/Deployed-Render.com-46E3B7?style=flat-square&logo=render)

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Ruby on Rails 8.1 (API mode) |
| Frontend | React 19 + Vite (`vite_rails`) |
| Database | PostgreSQL 17 |
| Jobs | Solid Queue (DB-backed, runs inside Puma) |
| Cache | Solid Cache (DB-backed) |
| WebSockets | Solid Cable (ActionCable over Postgres) |
| Auth | JWT (`jwt` gem) + bcrypt |
| Push | Web Push / VAPID (`web-push` gem) |
| AI | Claude API (match summaries) |
| Observability | Sentry |
| Rate limiting | Rack::Attack |
| Memory | jemalloc (aggressive OS return) |
| Deployment | Docker → Render.com (Thruster + Puma) |

---

## Features

### Live Match Experience
- **Live scores** — auto-polling every 2 min on match days with live minute, score, and red-card display
- **ActionCable WebSocket push** — real-time score updates broadcast to all connected clients
- **Match detail** — tabbed view: Summary, Stats, Line-ups (pitch grid), H2H; live polling + WebSocket
- **AI match summaries** — Claude-generated post-match recap, lazy-loaded after full-time
- **Score predictions** — predict scorelines pre-kickoff; graded leaderboard + friends comparison

### Navigation & Discovery
- **Today / Fixtures / Results** — date-navigable strip with client-timezone-aware filtering (no cross-midnight bleed)
- **Group stage** — all 12 groups with mini standings tables and FIFA tiebreakers
- **Knockout bracket** — official FIFA 2026 R32 → R16 → QF → SF → Final bracket; auto-populates as teams advance
- **Bracket predictor** — fill in your own bracket predictions
- **Mundial hub** — teams, schedule, venues, top scorers all in one page

### Stadiums & Venues
- **Venue detail pages** — click any venue name to open a stadium info page
- **Stadium photo heroes** — server-side resolved photos with 7-day cache (no broken images)
- **Venue match schedule** — see all matches at each stadium

### Personalization & Notifications
- **Multi-favorites** — follow teams + competitions, personalized Today screen
- **Push notifications** — VAPID Web Push for match reminders and live goal alerts; per-team subscriptions
- **iOS push support** — native iOS push modal flow; no `new Notification()` on main thread
- **Priority goal queue** — scorer resolved in background, notification sent immediately without API round-trip

### App Shell & UX
- **PWA** — installable, service worker (network-first API, cache-first assets), offline fallback
- **Pull-to-refresh**, skeleton loaders, swipe navigation between match pages
- **Link previews** — dynamic OG meta tags based on live/today matches; venue photos in OG image
- **i18n** — English + Spanish (react-i18next); IP-based auto-detection, manual override in `localStorage`
- **Onboarding** — pick favourite teams/leagues on first visit

### Content
- **Team & player pages** — squad, stats, transfers, trophies
- **News feed** — live football news filtered to match context
- **Transfer Center** — latest football transfers
- **Admin panel** — match score entry, standings recalculation, push broadcast, user management

---

## Data sources

| Source | Used for |
|---|---|
| [API-Football (API-Sports) v3](https://www.api-football.com) | Live scores, lineups, stats, player ratings, injuries, predictions, odds, stadium photos |
| [football-data.org](https://www.football-data.org) | One-off WC metadata sync (teams, fixtures) |

Live data flows through two clients:
- `LiveScoresClient` — wraps API-Football v3; scores, lineups, stats, stadium photo resolution
- `ApiSportsClient` — resolves internal fixture IDs when needed

---

## Architecture

### Request flow

```
Browser → Service Worker (network-first /api/*, cache-first assets)
       → Rails API (JSON only)
           ├── Solid Cache (standings, fixtures, stadium photos — 15 min – 7 day TTL)
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

All date filtering uses the **client's IANA timezone** (sent as `?tz=America/Mexico_City`). The backend converts to a UTC range via `TZInfo` so matches near local midnight are never dropped.

### Standings

`WorldCupStandings` computes group tables purely from finished DB matches, applying FIFA tiebreakers in order: points → goal difference → goals for → head-to-head (points, GD, GF) → alphabetical. Results are written to the `standings` table and cached for 15 minutes.

### Knockout bracket

`WorldCupKnockout` maintains the official FIFA 2026 bracket (R32 match numbers 73–88, R16 pairings, QF, SF, Final) and auto-fills slots as matches finish. The third-place table for the 16 R32 best-third slots follows the 495-combination FIFA lookup — approximated until after the group stage.

---

## Key files

| Path | Purpose |
|---|---|
| `app/services/live_scores_client.rb` | API-Football v3 wrapper — scores, lineups, ratings, stadium photos |
| `app/services/world_cup_standings.rb` | FIFA tiebreaker standings calculator |
| `app/services/world_cup_knockout.rb` | Bracket slot assignment |
| `app/services/world_cup_sync.rb` | Full WC data sync orchestrator |
| `app/controllers/api/v1/today_controller.rb` | Merges DB + API matches, deduplicates |
| `app/controllers/api/v1/base_controller.rb` | JWT auth, timezone helpers, cache headers |
| `app/controllers/api/v1/venues_controller.rb` | Venue detail + stadium photo (7-day cache) |
| `app/frontend/hooks/useMatches.js` | Module-level match cache + polling (shared across components) |
| `app/frontend/pages/MatchShowPage.jsx` | Full match detail (tabs, live WS, AI summary) |
| `app/frontend/pages/scores/GroupStagePage.jsx` | Group stage with mini standings |
| `app/frontend/pages/scores/KnockoutPage.jsx` | Bracket visualisation |
| `app/frontend/pages/VenueShowPage.jsx` | Stadium detail page with photo hero + matches |
| `db/world_cup_group_fixtures.yml` | Canonical WC 2026 group schedule (source of truth for seeding) |
| `public/sw.js` | Service worker — network-first API, cache-first assets, push handler |
| `config/recurring.yml` | Solid Queue recurring job schedule (production) |

---

## Setup

### Requirements

- Ruby **3.2.2** (`.ruby-version`; Ruby 3.3 has an ActionView syntax error on macOS darwin 25 — Docker/Render uses 3.3.0)
- Node **22.x**
- PostgreSQL **17+**

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
npm run dev           # Vite HMR on :3036 (proxies to Rails)
```

The app is served entirely from `:3000` in development. Vite assets are proxied transparently.

---

## Deployment (Render.com)

```bash
# Build command (Dockerfile / render.yaml)
bundle exec rails assets:precompile
bundle exec rails db:migrate

# Start command
bundle exec thrust bundle exec puma -C config/puma.rb
```

`Thruster` handles HTTP/2, asset compression, and X-Sendfile in front of Puma.
All three Solid adapters (Queue, Cache, Cable) share the same Postgres connection pool — no Redis required.
jemalloc is configured to aggressively return freed memory to the OS, keeping the Render instance footprint lean.

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

## Useful rake tasks

```bash
# Re-import group fixtures from db/world_cup_group_fixtures.yml
rails golazo:load_schedule

# Recalculate standings + rebuild bracket from current DB state
rails runner "RecalculateStandingsJob.perform_now"
```

---

## License

Private — all rights reserved.
