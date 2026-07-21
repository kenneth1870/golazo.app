# ⚽ Golazo.app

> **Live football scores** — club leagues and World Cup, real-time updates, English & Spanish

Deployed at **[golazo.app](https://golazo.app)**

![Ruby](https://img.shields.io/badge/Ruby-3.3.8-CC342D?style=flat-square&logo=ruby)
![Rails](https://img.shields.io/badge/Rails-8.1-CC0000?style=flat-square&logo=rubyonrails)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql)

---

## Overview

Golazo is a live football scores app built as a Rails API + React SPA. It surfaces today's fixtures, live minute/score updates, league standings, match detail, news, and (in WC mode) bracket and group-stage views.

### App focus modes

Controlled by `APP_FOCUS` (default: `clubs`):

| Mode | `APP_FOCUS` | Behaviour |
|---|---|---|
| **Clubs-primary** | `clubs` | Home and nav centre on club football. Featured leagues: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, UCL, MLS, **Liga Tica**, **Liga MX**. FIFA World Cup 2026 is kept as an **archived** section. |
| **WC-primary** | `wc` | World Cup 2026 is the main surface — groups, knockout bracket, venues, national teams. |
| **Both** | `both` | Club leagues and WC active together. |

The frontend reads focus flags from `GET /api/v1/config` (`clubs_primary`, `wc_paused`, etc.).

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Ruby on Rails 8.1 (API mode) |
| Frontend | React 19 + Vite (`vite_rails`) |
| Real-time | ActionCable (Solid Cable over Postgres) |
| Database | PostgreSQL 17 |
| Jobs / cache / cable | Solid Queue, Solid Cache, Solid Cable (no Redis) |
| i18n | English + Spanish (`react-i18next`) |
| Auth | JWT + bcrypt |
| Push | Web Push / VAPID (optional; `PUSH_NOTIFICATIONS=enabled`) |
| Data | API-Football (API-Sports) v3 |
| Deployment | Docker → Render.com (Thruster + Puma) |

---

## Features

- **Live scores** — polling on match days + ActionCable push for score/status changes
- **Today / Fixtures / Results** — date strip filtered by client timezone (`?tz=America/Costa_Rica`)
- **League hub** — per-competition fixtures, standings, and team pages (`/api/v1/competitions/:code/fixtures`)
- **Match detail** — line-ups, stats, H2H, AI post-match summaries
- **Favorites & search** — follow teams/leagues; club team pages under `/leagues/:code/teams/:slug`
- **News feed** — league-aware football news
- **PWA** — installable, service worker, offline fallback
- **WC mode** — group stage, knockout bracket, venues, predictions, push notifications

---

## Architecture

### Request flow

```
Browser → Service Worker (network-first /api/*)
       → Rails API (JSON)
           ├── LiveScoresClient → API-Football v3
           ├── Solid Cache (fixtures, standings, photos)
           └── ActionCable → browser (live score push)
```

### Key API surfaces

- **`GET /api/v1/today`** — merges API fixtures for the requested local date. In clubs mode, pulls featured league fixtures; in WC mode, overlays DB scores onto API data for live matches. Accepts `?date=` and `?tz=` (IANA timezone).
- **`GET /api/v1/competitions/:code/fixtures`** — league-scoped fixtures and results.
- **`GET /api/v1/config`** — app focus, featured clubs, push flags for the frontend.

### LATAM kickoff normalization

API-Football often stacks Liga Tica and Liga MX **jornadas on Sunday** even when real kickoffs span the week. `ApiMatchNormalizer#adjusted_kickoff` shifts Sunday jornada fixtures back three days (→ Thursday) so they appear on the correct local date in `/api/v1/today`. Placeholder 20:00 UTC times are flagged as TBC.

### Background jobs

Solid Queue runs inside Puma (`config/recurring.yml` in production). Key jobs: `SyncLiveScoresJob` (live polling + ActionCable broadcast), `SyncStandingsJob`, `SyncTodayMatchesJob`. WC-specific sync jobs are skipped when `APP_FOCUS=clubs`.

---

## Setup

### Requirements

- Ruby **3.3.8** (`.ruby-version`)
- Node **22.x**
- PostgreSQL **17+**

### Environment variables

```bash
# Required
DATABASE_URL=postgres://...
RAILS_MASTER_KEY=...                  # decrypts credentials.yml.enc
RAPIDAPI_KEY=...                      # API-Football (RapidAPI or direct)

# Auth & security
JWT_SECRET=...
ADMIN_API_TOKEN=...                   # admin / sync scripts
ALLOWED_ORIGINS=http://localhost:3000

# App behaviour
APP_FOCUS=clubs                       # clubs | wc | both
PUSH_NOTIFICATIONS=paused             # enabled to activate Web Push

# Web Push (optional)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com

# Optional
FOOTBALL_DATA_API_KEY=...             # one-off WC metadata imports
SENTRY_DSN=...
```

Generate VAPID keys: `rails webpush:generate_keys`

### Install & run

```bash
bundle install
npm install
rails db:create db:migrate db:seed
```

Start all dev processes (Rails :3000, Vite HMR :3036, Solid Queue worker):

```bash
bin/dev
```

Requires [foreman](https://github.com/ddollar/foreman) (`gem install foreman`). Without foreman, `bin/dev` falls back to starting Rails and Vite directly.

Individual processes (from `Procfile.dev`):

```bash
bin/rails s -p 3000
bin/vite dev
bin/rails solid_queue:start
```

The app is served from **:3000**; Vite assets are proxied via `vite_rails`.

---

## Deployment (Render.com)

```bash
bundle exec rails assets:precompile
bundle exec rails db:migrate
bundle exec thrust bundle exec puma -C config/puma.rb
```

Thruster sits in front of Puma for HTTP/2 and compression. All Solid adapters share the Postgres pool — no Redis required.

---

## License

Private — all rights reserved.
