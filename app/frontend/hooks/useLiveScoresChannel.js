import { useEffect, useRef } from "react"
import { getConsumer } from "../utils/cable"

// Subscribes to the shared "live_scores" stream. Every goal/status change for
// any match pushes here, so list views (Today, Home) update in real time
// without polling. onUpdate receives the payload:
//   { type, match_id, external_id, home_score, away_score, status, minute }
export function useLiveScoresChannel(onUpdate) {
  const subRef = useRef(null)
  const cbRef  = useRef(onUpdate)

  useEffect(() => { cbRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    subRef.current = getConsumer().subscriptions.create(
      { channel: "LiveScoresChannel" },
      { received: (data) => { if (data?.type === "live_score_update") cbRef.current?.(data) } }
    )
    return () => { subRef.current?.unsubscribe() }
  }, [])
}
