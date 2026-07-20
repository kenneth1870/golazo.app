import { useState, useEffect, useCallback } from "react"
import { isIosSafari, isStandalone } from "../utils/platform"
import { getDeviceId } from "../utils/deviceId"
import { useAppFocus } from "./useAppFocus"
import i18n from "../i18n"

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const { push_enabled: pushEnabled = false } = useAppFocus()
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading,    setLoading]    = useState(false)

  // Check if already subscribed on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub)
      })
    })
  }, [])

  const subscribe = useCallback(async (teamNames = [], eventPrefs = []) => {
    if (!pushEnabled) return { error: "Push notifications are paused" }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { error: "Push not supported in this browser" }
    }

    setLoading(true)
    try {
      // Request notification permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") return { error: "Permission denied" }

      // Fetch VAPID public key from server
      const keyRes = await fetch("/api/v1/vapid_public_key")
      if (!keyRes.ok) throw new Error("Failed to fetch server key")
      const { key } = await keyRes.json()
      if (!key) throw new Error("Push notifications are not configured on this server")

      // Subscribe via PushManager
      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      const subJson = pushSub.toJSON()

      // Save subscription to server
      await fetch("/api/v1/push_subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify({
          endpoint:     subJson.endpoint,
          p256dh:       subJson.keys?.p256dh,
          auth:         subJson.keys?.auth,
          device_id:    getDeviceId(),
          team_ids:     teamNames,
          event_prefs:  eventPrefs,
          locale:       i18n.language,
        }),
      })

      setSubscribed(true)
      // Persist the subscribed teams locally so addTeams can accumulate later
      const existing = JSON.parse(localStorage.getItem("push_sub_teams") || "[]")
      const merged = [...new Set([...existing, ...teamNames.filter(Boolean)])]
      localStorage.setItem("push_sub_teams", JSON.stringify(merged))
      return { ok: true }
    } catch (err) {
      // swallow — error returned to caller via { error: err.message }
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }, [pushEnabled])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.getSubscription()
      if (pushSub) {
        const endpoint = pushSub.endpoint
        await pushSub.unsubscribe()
        await fetch("/api/v1/push_subscriptions", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
          },
          body: JSON.stringify({ endpoint }),
        })
      }
      setSubscribed(false)
    } catch (err) {
      // swallow unsubscribe failure — subscription may already be expired
    } finally {
      setLoading(false)
    }
  }, [])

  const updateTeams = useCallback(async (teamNames, eventPrefs) => {
    try {
      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.getSubscription()
      if (!pushSub) return
      const body = { endpoint: pushSub.endpoint, team_ids: teamNames }
      if (eventPrefs !== undefined) body.event_prefs = eventPrefs
      await fetch("/api/v1/push_subscriptions/teams", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      // swallow — non-critical background sync
    }
  }, [])

  const updateEventPrefs = useCallback(async (eventPrefs) => {
    try {
      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.getSubscription()
      if (!pushSub) return
      const existing = JSON.parse(localStorage.getItem("push_sub_teams") || "[]")
      await fetch("/api/v1/push_subscriptions/teams", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify({ endpoint: pushSub.endpoint, team_ids: existing, event_prefs: eventPrefs }),
      })
      localStorage.setItem("push_event_prefs", JSON.stringify(eventPrefs))
    } catch (err) {
      // swallow
    }
  }, [])

  // Add teams to the existing subscription without replacing others.
  // Persists the cumulative team list in localStorage so it survives page loads.
  const addTeams = useCallback(async (newTeams) => {
    try {
      const existing = JSON.parse(localStorage.getItem("push_sub_teams") || "[]")
      const merged = [...new Set([...existing, ...newTeams.filter(Boolean)])]
      localStorage.setItem("push_sub_teams", JSON.stringify(merged))
      await updateTeams(merged)
    } catch (err) {
      // swallow
    }
  }, [updateTeams])

  const supported = pushEnabled &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window

  const iosSafari = isIosSafari()
  const isIosPwa = iosSafari && isStandalone()
  const needsIosInstall = iosSafari && !isIosPwa

  // Whether the given team names are covered by the current subscription
  const teamsSubscribed = useCallback((teamNames) => {
    if (!subscribed) return false
    const saved = JSON.parse(localStorage.getItem("push_sub_teams") || "[]")
    if (saved.length === 0) return true  // global subscription
    return teamNames.some(n => saved.includes(n))
  }, [subscribed])

  const eventPrefs = (() => {
    try { return JSON.parse(localStorage.getItem("push_event_prefs") || "[]") } catch { return [] }
  })()

  return { supported, pushEnabled, permission, subscribed, loading, subscribe, unsubscribe, updateTeams, addTeams, teamsSubscribed, needsIosInstall, updateEventPrefs, eventPrefs }
}
