import { useEffect, useRef } from "react"

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(active) {
  const rootRef = useRef(null)

  useEffect(() => {
    if (!active || !rootRef.current) return
    const root = rootRef.current
    const previouslyFocused = document.activeElement

    const focusables = () => [...root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
    const first = focusables()[0]
    first?.focus()

    function onKeyDown(e) {
      if (e.key !== "Tab") return
      const list = focusables()
      if (list.length === 0) return
      const firstEl = list[0]
      const lastEl  = list[list.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    root.addEventListener("keydown", onKeyDown)
    return () => {
      root.removeEventListener("keydown", onKeyDown)
      if (previouslyFocused?.focus) previouslyFocused.focus()
    }
  }, [active])

  return rootRef
}
