import { useEffect, useRef } from "react"
import { createConsumer } from "@rails/actioncable"

export function useExternalMatchChannel(fixtureId, onMessage) {
  const cableRef = useRef(null)
  const subRef   = useRef(null)
  const cbRef    = useRef(onMessage)

  // Keep callback ref fresh without re-subscribing
  useEffect(() => { cbRef.current = onMessage }, [onMessage])

  useEffect(() => {
    if (!fixtureId) return

    cableRef.current = createConsumer("/cable")
    subRef.current = cableRef.current.subscriptions.create(
      { channel: "ExternalMatchChannel", fixture_id: fixtureId },
      { received: (data) => cbRef.current?.(data) }
    )

    return () => {
      subRef.current?.unsubscribe()
      cableRef.current?.disconnect()
    }
  }, [fixtureId])
}
