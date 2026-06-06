import { useState, useEffect, useCallback } from "react"

const KEY = "golazo_reminders"

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") }
  catch { return [] }
}

function persist(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr))
}

export function useReminders() {
  const [reminders, setReminders] = useState(load)

  useEffect(() => {
    const now = Date.now()
    // Prune reminders that fired > 1 hour ago
    const fresh = reminders.filter(r => new Date(r.kickoff_at).getTime() > now - 3_600_000)
    if (fresh.length !== reminders.length) {
      persist(fresh)
      setReminders(fresh)
    }

    // Schedule in-app notifications for reminders within 48h
    const timers = fresh.map(r => {
      const delay = new Date(r.kickoff_at).getTime() - now
      if (delay <= 0 || delay > 48 * 3_600_000) return null
      return setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification("⚽ Kickoff!", {
            body: `${r.home_team} vs ${r.away_team} is starting now`,
            icon: "/images/icon-192.png",
            tag: `match-${r.id}`,
          })
        }
        setReminders(prev => {
          const next = prev.filter(x => x.id !== r.id)
          persist(next)
          return next
        })
      }, delay)
    }).filter(Boolean)

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isReminded = useCallback(
    id => reminders.some(r => r.id === String(id)),
    [reminders]
  )

  const addReminder = useCallback(async (match) => {
    if (typeof Notification === "undefined") return false
    if (Notification.permission !== "granted") {
      const p = await Notification.requestPermission()
      if (p !== "granted") return false
    }
    const r = {
      id:         String(match.external_id || match.id),
      kickoff_at: match.kickoff_at,
      home_team:  match.home_team?.name || match.home?.name || "Home",
      away_team:  match.away_team?.name || match.away?.name || "Away",
    }
    setReminders(prev => {
      const next = [...prev.filter(x => x.id !== r.id), r]
      persist(next)
      return next
    })
    return true
  }, [])

  const removeReminder = useCallback(id => {
    setReminders(prev => {
      const next = prev.filter(r => r.id !== String(id))
      persist(next)
      return next
    })
  }, [])

  return { reminders, isReminded, addReminder, removeReminder }
}
