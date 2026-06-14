import { useEffect, useRef } from "react"
import { createConsumer } from "@rails/actioncable"

export function useStandingsChannel(onUpdate) {
  const cableRef = useRef(null)
  const subRef   = useRef(null)
  const cbRef    = useRef(onUpdate)

  useEffect(() => { cbRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    cableRef.current = createConsumer("/cable")
    subRef.current = cableRef.current.subscriptions.create(
      { channel: "StandingsChannel" },
      { received: (data) => { if (data?.type === "standings_updated") cbRef.current?.() } }
    )
    return () => {
      subRef.current?.unsubscribe()
      cableRef.current?.disconnect()
    }
  }, [])
}
