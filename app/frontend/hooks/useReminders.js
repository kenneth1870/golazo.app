import { useState, useEffect, useCallback } from "react"
import { storageGet, storageSet } from "../utils/safeStorage"
import { useAppFocus } from "./useAppFocus"

const KEY = "golazo_reminders"

function load() {
  try { return JSON.parse(storageGet(KEY) || "[]") }
  catch { return [] }
}

function persist(arr) {
  storageSet(KEY, JSON.stringify(arr))
}

export function useReminders() {
  const { push_enabled: pushEnabled = false } = useAppFocus()
  const [reminders, setReminders] = useState(load)

  useEffect(() => {
    if (!pushEnabled) return
    const now = Date.now()
    setReminders(prev => {
      const fresh = prev.filter(r => new Date(r.kickoff_at).getTime() > now - 3_600_000)
      if (fresh.length !== prev.length) persist(fresh)
      return fresh
    })
  }, [pushEnabled])

  useEffect(() => {
    if (!pushEnabled) return
    const now = Date.now()
    const timers = reminders.map(r => {
      const delay = new Date(r.kickoff_at).getTime() - now
      if (delay <= 0 || delay > 48 * 3_600_000) return null
      return setTimeout(() => {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          navigator.serviceWorker?.ready.then(reg => {
            reg.showNotification("⚽ Kickoff!", {
              body: `${r.home_team} vs ${r.away_team} is starting now`,
              icon: "/images/icon-192.png",
              tag: `match-${r.id}`,
            })
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
  }, [reminders, pushEnabled])

  const isReminded = useCallback(
    id => pushEnabled && reminders.some(r => r.id === String(id)),
    [reminders, pushEnabled]
  )

  const addReminder = useCallback(async (match) => {
    if (!pushEnabled) return false
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
  }, [pushEnabled])

  const removeReminder = useCallback(id => {
    setReminders(prev => {
      const next = prev.filter(r => r.id !== String(id))
      persist(next)
      return next
    })
  }, [])

  return { reminders, isReminded, addReminder, removeReminder, enabled: pushEnabled }
}
