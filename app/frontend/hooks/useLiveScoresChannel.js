import { useEffect, useRef } from "react"
import { getConsumer } from "../utils/cable"

// Module-level shared subscription so multiple components (Home, Today, Knockout)
// listen on one WebSocket connection instead of opening one per hook call.
const listeners = new Set()
let subscription = null

function ensureSubscription() {
  if (subscription) return
  subscription = getConsumer().subscriptions.create(
    { channel: "LiveScoresChannel" },
    {
      received: (data) => {
        if (data?.type !== "live_score_update") return
        listeners.forEach(fn => fn(data))
      },
    }
  )
}

function releaseSubscription() {
  if (listeners.size === 0 && subscription) {
    subscription.unsubscribe()
    subscription = null
  }
}

// Subscribes to the shared "live_scores" stream. Every goal/status change for
// any match pushes here, so list views (Today, Home) update in real time
// without polling. onUpdate receives the payload:
//   { type, match_id, external_id, home_score, away_score, status, minute }
export function useLiveScoresChannel(onUpdate) {
  const cbRef = useRef(onUpdate)
  useEffect(() => { cbRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    const handler = (data) => cbRef.current?.(data)
    listeners.add(handler)
    ensureSubscription()
    return () => {
      listeners.delete(handler)
      releaseSubscription()
    }
  }, [])
}
