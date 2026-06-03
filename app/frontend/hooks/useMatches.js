import { useState, useEffect, useCallback } from "react"

export function useMatches(filter = "all") {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/matches?filter=${filter}`)
      if (!res.ok) throw new Error("Failed to fetch matches")
      const data = await res.json()
      setMatches(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

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
