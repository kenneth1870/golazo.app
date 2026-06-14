import { useEffect, useRef } from "react"
import { getConsumer } from "../utils/cable"

export function useStandingsChannel(onUpdate) {
  const subRef = useRef(null)
  const cbRef  = useRef(onUpdate)

  useEffect(() => { cbRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    subRef.current = getConsumer().subscriptions.create(
      { channel: "StandingsChannel" },
      { received: (data) => { if (data?.type === "standings_updated") cbRef.current?.() } }
    )
    return () => { subRef.current?.unsubscribe() }
  }, [])
}
