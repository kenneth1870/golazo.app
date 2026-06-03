import { useState, useEffect, useCallback } from "react"

export function useMatches(filter = "all", { competition, group } = {}) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMatches = useCallback(async () => {
    try {
      const params = new URLSearchParams({ filter })
      if (competition) params.set("competition", competition)
      if (group) params.set("group", group)

      const res = await fetch(`/api/v1/matches?${params}`)
      if (!res.ok) throw new Error("Failed to fetch matches")
      setMatches(await res.json())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter, competition, group])

  useEffect(() => {
    fetchMatches()
    const interval = setInterval(fetchMatches, 30000)
    return () => clearInterval(interval)
  }, [fetchMatches])

  return { matches, loading, error, refetch: fetchMatches }
}

export function useMatch(matchId) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) return
    fetch(`/api/v1/matches/${matchId}`)
      .then(r => r.json())
      .then(setMatch)
      .finally(() => setLoading(false))
  }, [matchId])

  return { match, loading, setMatch }
}
