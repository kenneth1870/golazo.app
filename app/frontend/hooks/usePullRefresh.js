import { useRef, useState, useCallback } from "react"

const DEFAULT_THRESHOLD = 72

export function usePullRefresh(onRefresh, { threshold = DEFAULT_THRESHOLD, disabled = false } = {}) {
  const [pullDist, setPullDist]     = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullStartY  = useRef(null)
  const isPulling   = useRef(false)

  const handlers = {
    onTouchStart: useCallback((e) => {
      if (disabled || window.scrollY > 0) return
      pullStartY.current = e.touches[0].clientY
      isPulling.current = true
    }, [disabled]),

    onTouchMove: useCallback((e) => {
      if (!isPulling.current || pullStartY.current === null) return
      const dy = e.touches[0].clientY - pullStartY.current
      if (dy <= 0) { setPullDist(0); return }
      setPullDist(Math.min(dy, threshold * 1.5))
    }, [threshold]),

    onTouchEnd: useCallback(async () => {
      if (!isPulling.current) return
      isPulling.current = false
      const dist = pullDist
      setPullDist(0)
      pullStartY.current = null
      if (dist >= threshold && !disabled) {
        setRefreshing(true)
        try {
          await Promise.resolve(onRefresh?.())
        } finally {
          setRefreshing(false)
        }
      }
    }, [pullDist, threshold, disabled, onRefresh]),
  }

  return { pullDist, refreshing, showIndicator: pullDist > 4 || refreshing, ...handlers }
}
