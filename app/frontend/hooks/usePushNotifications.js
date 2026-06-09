import { useState, useEffect, useCallback } from "react"
import { storageGet, storageSet } from "../utils/safeStorage"

const DEVICE_KEY = "golazo_device_id"

function getDeviceId() {
  let id = storageGet(DEVICE_KEY)
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
    storageSet(DEVICE_KEY, id)
  }
  return id
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
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

  const subscribe = useCallback(async (teamNames = []) => {
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
          endpoint:  subJson.endpoint,
          p256dh:    subJson.keys?.p256dh,
          auth:      subJson.keys?.auth,
          device_id: getDeviceId(),
          team_ids:  teamNames,
        }),
      })

      setSubscribed(true)
      return { ok: true }
    } catch (err) {
      console.error("[Push] Subscribe error:", err)
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

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
      console.error("[Push] Unsubscribe error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateTeams = useCallback(async (teamNames) => {
    try {
      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.getSubscription()
      if (!pushSub) return
      await fetch("/api/v1/push_subscriptions/teams", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify({ endpoint: pushSub.endpoint, team_ids: teamNames }),
      })
    } catch (err) {
      console.error("[Push] updateTeams error:", err)
    }
  }, [])

  const supported = typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window

  // On iOS, push notifications only work when installed as a PWA (added to home screen).
  // navigator.standalone is true only in that case.
  const isIos = typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isIosPwa = isIos && navigator.standalone === true
  // Show iOS hint if on iOS but NOT installed as PWA
  const needsIosInstall = isIos && !isIosPwa

  return { supported, permission, subscribed, loading, subscribe, unsubscribe, updateTeams, needsIosInstall }
}
