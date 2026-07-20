// Tiny client-side cache for match-detail responses, warmed by prefetching on
// row hover/tap so the match page can paint instantly instead of showing a
// skeleton while the network round-trip completes.
//
// The navId is the same value used to navigate (`external_id`, or `db-<id>` for
// DB-only fixtures) and the same path MatchShowPage fetches, so a prefetch and
// the subsequent page load share one entry.

const cache    = new Map() // navId -> { data, ts }
const inflight = new Map() // navId -> Promise
const TTL_MS   = 30_000    // match_detail is server-cached ~30s; mirror that here
const MAX      = 20

export function navIdFor(match) {
  if (!match) return null
  if (match.external_id != null && match.external_id !== "") return String(match.external_id)
  if (match.id != null) return `db-${match.id}`
  return null
}

export function matchPath(match) {
  const id = navIdFor(match)
  return id ? `/matches/${id}` : null
}

export function navigateToMatch(navigate, match, options) {
  const path = matchPath(match)
  if (path) navigate(path, options)
}

export function getCachedMatchDetail(navId) {
  if (!navId) return null
  const e = cache.get(navId)
  if (!e) return null
  if (Date.now() - e.ts > TTL_MS) { cache.delete(navId); return null }
  return e.data
}

export function setCachedMatchDetail(navId, data) {
  if (!navId || !data) return
  cache.set(navId, { data, ts: Date.now() })
  if (cache.size > MAX) cache.delete(cache.keys().next().value) // evict oldest
}

// Fire-and-forget warm-up. Dedupes concurrent prefetches for the same id and
// skips the network entirely when a fresh entry already exists.
export function prefetchMatchDetail(navId) {
  if (!navId || getCachedMatchDetail(navId) || inflight.has(navId)) return
  const p = fetch(`/api/v1/match_detail/${navId}`)
    .then(r => (r.ok ? r.json() : null))
    .then(data => { if (data?.fixture) setCachedMatchDetail(navId, data); return data })
    .catch(() => null)
    .finally(() => inflight.delete(navId))
  inflight.set(navId, p)
}
