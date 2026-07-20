import { useState, useEffect } from "react"

let cached = null

export function useAppFocus() {
  const [focus, setFocus] = useState(cached || { wc_paused: true, clubs_primary: true, push_enabled: false, featured_clubs: [] })

  useEffect(() => {
    if (cached) return
    fetch("/api/v1/config")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { cached = d; setFocus(d) } })
      .catch(() => {})
  }, [])

  return focus
}
