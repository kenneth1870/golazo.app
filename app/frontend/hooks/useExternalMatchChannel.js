import { useEffect, useRef } from "react"
import { getConsumer } from "../utils/cable"

export function useExternalMatchChannel(fixtureId, onMessage) {
  const subRef = useRef(null)
  const cbRef  = useRef(onMessage)

  // Keep callback ref fresh without re-subscribing
  useEffect(() => { cbRef.current = onMessage }, [onMessage])

  useEffect(() => {
    if (!fixtureId) return

    subRef.current = getConsumer().subscriptions.create(
      { channel: "ExternalMatchChannel", fixture_id: fixtureId },
      { received: (data) => cbRef.current?.(data) }
    )

    return () => { subRef.current?.unsubscribe() }
  }, [fixtureId])
}
