import { useState, useEffect, useCallback } from "react"
import { isIosSafari, isStandalone } from "../utils/platform"
import { getDeviceId } from "../utils/deviceId"
import { useAppFocus } from "./useAppFocus"
import { loadPushScope, savePushScope, hasPushScope } from "../utils/pushScope"
import i18n from "../i18n"

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

async function persistScope(endpoint, { teamNames, competitionCodes, eventPrefs }) {
  const body = {
    endpoint,
    team_ids: teamNames,
    competition_codes: competitionCodes,
  }
  if (eventPrefs !== undefined) body.event_prefs = eventPrefs

  await fetch("/api/v1/push_subscriptions/teams", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
    },
    body: JSON.stringify(body),
  })
}

export function usePushNotifications() {
  const { push_enabled: pushEnabled = false } = useAppFocus()
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scope, setScope] = useState(loadPushScope)

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscribed(!!sub)
      })
    })
  }, [])

  const subscribe = useCallback(async (teamNames = [], competitionCodes = [], eventPrefs = []) => {
    if (!pushEnabled) return { error: "Push notifications are paused" }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { error: "Push not supported in this browser" }
    }

    const nextScope = {
      teamNames: [...new Set(teamNames.filter(Boolean))],
      competitionCodes: [...new Set(competitionCodes.filter(Boolean))],
    }
    if (!hasPushScope(nextScope)) {
      return { error: "Select at least one team or league for notifications" }
    }

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") return { error: "Permission denied" }

      const keyRes = await fetch("/api/v1/vapid_public_key")
      if (!keyRes.ok) throw new Error("Failed to fetch server key")
      const { key } = await keyRes.json()
      if (!key) throw new Error("Push notifications are not configured on this server")

      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      const subJson = pushSub.toJSON()

      await fetch("/api/v1/push_subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          device_id: getDeviceId(),
          team_ids: nextScope.teamNames,
          competition_codes: nextScope.competitionCodes,
          event_prefs: eventPrefs,
          locale: i18n.language,
        }),
      })

      savePushScope(nextScope)
      setScope(nextScope)
      setSubscribed(true)
      return { ok: true }
    } catch (err) {
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
      // swallow unsubscribe failure
    } finally {
      setLoading(false)
    }
  }, [])

  const updateScope = useCallback(async (teamNames, competitionCodes, eventPrefs) => {
    try {
      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.getSubscription()
      if (!pushSub) return

      const nextScope = {
        teamNames: [...new Set((teamNames || []).filter(Boolean))],
        competitionCodes: [...new Set((competitionCodes || []).filter(Boolean))],
      }
      await persistScope(pushSub.endpoint, {
        teamNames: nextScope.teamNames,
        competitionCodes: nextScope.competitionCodes,
        eventPrefs,
      })
      savePushScope(nextScope)
      setScope(nextScope)
    } catch (err) {
      // swallow
    }
  }, [])

  const updateTeams = useCallback(async (teamNames, eventPrefs) => {
    const current = loadPushScope()
    await updateScope(teamNames, current.competitionCodes, eventPrefs)
  }, [updateScope])

  const updateEventPrefs = useCallback(async (eventPrefs) => {
    const current = loadPushScope()
    await updateScope(current.teamNames, current.competitionCodes, eventPrefs)
    localStorage.setItem("push_event_prefs", JSON.stringify(eventPrefs))
  }, [updateScope])

  const addTeams = useCallback(async (newTeams) => {
    const current = loadPushScope()
    const merged = [...new Set([...current.teamNames, ...newTeams.filter(Boolean)])]
    await updateScope(merged, current.competitionCodes)
  }, [updateScope])

  const removeTeams = useCallback(async (teamNames) => {
    const current = loadPushScope()
    const remove = new Set(teamNames.filter(Boolean))
    const merged = current.teamNames.filter(name => !remove.has(name))
    await updateScope(merged, current.competitionCodes)
  }, [updateScope])

  const addLeagues = useCallback(async (codes) => {
    const current = loadPushScope()
    const merged = [...new Set([...current.competitionCodes, ...codes.filter(Boolean)])]
    await updateScope(current.teamNames, merged)
  }, [updateScope])

  const removeLeagues = useCallback(async (codes) => {
    const current = loadPushScope()
    const remove = new Set(codes.filter(Boolean))
    const merged = current.competitionCodes.filter(code => !remove.has(code))
    await updateScope(current.teamNames, merged)
  }, [updateScope])

  const syncScopeFromFavorites = useCallback(async (favorites) => {
    if (!subscribed) return
    const teamNames = favorites.filter(f => f.type === "team").map(f => f.name).filter(Boolean)
    const competitionCodes = favorites.filter(f => f.type === "competition").map(f => f.code || f.id).filter(Boolean)
    if (!hasPushScope({ teamNames, competitionCodes })) return
    await updateScope(teamNames, competitionCodes)
  }, [subscribed, updateScope])

  const supported = pushEnabled &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window

  const iosSafari = isIosSafari()
  const isIosPwa = iosSafari && isStandalone()
  const needsIosInstall = iosSafari && !isIosPwa

  const teamsSubscribed = useCallback((teamNames) => {
    if (!subscribed) return false
    const saved = loadPushScope().teamNames
    return teamNames.some(n => saved.includes(n))
  }, [subscribed])

  const leaguesSubscribed = useCallback((codes) => {
    if (!subscribed) return false
    const saved = new Set(loadPushScope().competitionCodes)
    return codes.some(code => saved.has(code))
  }, [subscribed])

  const eventPrefs = (() => {
    try { return JSON.parse(localStorage.getItem("push_event_prefs") || "[]") } catch { return [] }
  })()

  return {
    supported,
    pushEnabled,
    permission,
    subscribed,
    loading,
    scope,
    subscribe,
    unsubscribe,
    updateTeams,
    updateScope,
    addTeams,
    removeTeams,
    addLeagues,
    removeLeagues,
    syncScopeFromFavorites,
    teamsSubscribed,
    leaguesSubscribed,
    needsIosInstall,
    updateEventPrefs,
    eventPrefs,
  }
}
