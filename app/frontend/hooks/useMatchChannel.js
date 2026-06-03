import { useEffect, useRef } from "react"
import { createConsumer } from "@rails/actioncable"

export function useMatchChannel(matchId, onMessage) {
  const cableRef = useRef(null)
  const subRef = useRef(null)

  useEffect(() => {
    if (!matchId) return

    cableRef.current = createConsumer("/cable")
    subRef.current = cableRef.current.subscriptions.create(
      { channel: "MatchChannel", match_id: matchId },
      { received: onMessage }
    )

    return () => {
      subRef.current?.unsubscribe()
      cableRef.current?.disconnect()
    }
  }, [matchId])
}
