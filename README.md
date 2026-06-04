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

- Ruby 3.3+
- Node 20+
- PostgreSQL 15+

### Environment variables

```
DATABASE_URL=postgres://...
RAPIDAPI_KEY=your_rapidapi_key    # free-api-live-football-data on RapidAPI
```

### Install & run

```bash
bundle install
npm install
rails db:create db:migrate

# Two terminals:
rails server    # http://localhost:3000
npm run dev     # Vite HMR on :3036
```

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
