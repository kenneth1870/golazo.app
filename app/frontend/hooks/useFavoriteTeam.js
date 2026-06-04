import { useState, useEffect } from "react"

const KEY = "golazo_favorite_team"

export function useFavoriteTeam() {
  const [fav, setFav] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || null }
    catch { return null }
  })

  function saveFav(team) {
    setFav(team)
    if (team) localStorage.setItem(KEY, JSON.stringify(team))
    else localStorage.removeItem(KEY)
  }

  return [fav, saveFav]
}
