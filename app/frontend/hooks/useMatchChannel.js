import { useEffect, useRef } from "react"
import { getConsumer } from "../utils/cable"

export function useMatchChannel(matchId, onMessage) {
  const subRef = useRef(null)
  const cbRef  = useRef(onMessage)

  // Keep callback ref fresh without re-subscribing
  useEffect(() => { cbRef.current = onMessage }, [onMessage])

  useEffect(() => {
    if (!matchId) return

    subRef.current = getConsumer().subscriptions.create(
      { channel: "MatchChannel", match_id: matchId },
      { received: (data) => cbRef.current?.(data) }
    )

    return () => { subRef.current?.unsubscribe() }
  }, [matchId])
}
