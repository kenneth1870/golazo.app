import { useState, useCallback } from "react"

const KEY = "golazo_favorites"

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      // Migrate from old single-team key
      const old = localStorage.getItem("golazo_favorite_team")
      if (old) {
        const team = JSON.parse(old)
        const migrated = [{ type: "team", id: team.id, name: team.name, flag_url: team.flag_url, group: team.group }]
        localStorage.setItem(KEY, JSON.stringify(migrated))
        localStorage.removeItem("golazo_favorite_team")
        return migrated
      }
      return []
    }
    return JSON.parse(raw)
  } catch { return [] }
}

function persist(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr))
}

// Each favorite: { type: "team"|"competition", id, name, flag_url?, code? }
export function useFavorites() {
  const [favorites, setFavorites] = useState(load)

  const isFavorite = useCallback((type, id) =>
    favorites.some(f => f.type === type && String(f.id) === String(id)),
  [favorites])

  const addFavorite = useCallback((item) => {
    setFavorites(prev => {
      if (prev.some(f => f.type === item.type && String(f.id) === String(item.id))) return prev
      const next = [...prev, item]
      persist(next)
      return next
    })
  }, [])

  const removeFavorite = useCallback((type, id) => {
    setFavorites(prev => {
      const next = prev.filter(f => !(f.type === type && String(f.id) === String(id)))
      persist(next)
      return next
    })
  }, [])

  const toggleFavorite = useCallback((item) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.type === item.type && String(f.id) === String(item.id))
      const next = exists
        ? prev.filter(f => !(f.type === item.type && String(f.id) === String(item.id)))
        : [...prev, item]
      persist(next)
      return next
    })
  }, [])

  const favoriteTeams        = favorites.filter(f => f.type === "team")
  const favoriteCompetitions = favorites.filter(f => f.type === "competition")
  const favoriteTeamNames    = favoriteTeams.map(f => f.name)

  return {
    favorites,
    favoriteTeams,
    favoriteCompetitions,
    favoriteTeamNames,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  }
}

// Backward-compat shim so existing callers don't break
export function useFavoriteTeam() {
  const { favoriteTeams, addFavorite, removeFavorite } = useFavorites()
  const fav = favoriteTeams[0] ?? null

  function saveFav(team) {
    if (team) addFavorite({ type: "team", id: team.id, name: team.name, flag_url: team.flag_url, group: team.group })
    else if (fav) removeFavorite("team", fav.id)
  }

  return [fav, saveFav]
}
