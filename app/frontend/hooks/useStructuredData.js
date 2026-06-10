import { useEffect } from "react"

const SCRIPT_ID = "structured-data-ld"

/**
 * Injects a Schema.org JSON-LD <script> block into <head>.
 * Replaces any previously injected block on each call so navigating between
 * pages always reflects the current page's schema.
 *
 * @param {object|null} schema  Plain JS object matching a Schema.org type.
 *   Pass null / undefined to remove the script (e.g. on cleanup).
 */
export function useStructuredData(schema) {
  useEffect(() => {
    // Always remove stale block first
    document.getElementById(SCRIPT_ID)?.remove()

    if (!schema) return

    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id   = SCRIPT_ID
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)

    return () => { document.getElementById(SCRIPT_ID)?.remove() }
  }, [JSON.stringify(schema)]) // eslint-disable-line react-hooks/exhaustive-deps
}
