/**
 * MatchReactions — emoji reaction bar for a match.
 *
 * Usage:
 *   <MatchReactions matchId="12345" />
 *
 * Fetches current counts on mount, then allows the user to react.
 * Each emoji can only be reacted once per session (tracked in sessionStorage).
 * The server also rate-limits per IP.
 */
import { useState, useEffect, useCallback } from "react"

const EMOJIS = [
  { emoji: "⚽", label: "Goal!" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🎉", label: "Party" },
  { emoji: "😭", label: "Sad" },
  { emoji: "😮", label: "Wow" },
  { emoji: "👏", label: "Applause" },
]

function reactionKey(matchId, emoji) {
  return `golazo_reacted_${matchId}_${encodeURIComponent(emoji)}`
}

function hasReacted(matchId, emoji) {
  try { return sessionStorage.getItem(reactionKey(matchId, emoji)) === "1" }
  catch { return false }
}

function markReacted(matchId, emoji) {
  try { sessionStorage.setItem(reactionKey(matchId, emoji), "1") }
  catch {}
}

function formatCount(n) {
  if (!n || n === 0) return null
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function MatchReactions({ matchId, compact = false }) {
  const [counts, setCounts]     = useState({})
  const [loading, setLoading]   = useState(true)
  const [bouncing, setBouncing] = useState(null)

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/matches/${matchId}/reactions`)
      if (res.ok) setCounts(await res.json())
    } catch {}
    finally { setLoading(false) }
  }, [matchId])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  const react = async (emoji) => {
    if (hasReacted(matchId, emoji)) return

    // Optimistic update
    setCounts(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }))
    markReacted(matchId, emoji)
    setBouncing(emoji)
    setTimeout(() => setBouncing(null), 400)

    try {
      const res = await fetch(`/api/v1/matches/${matchId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      })
      if (res.ok) setCounts(await res.json())
    } catch {}
  }

  if (loading) return null

  const total = Object.values(counts).reduce((s, n) => s + (n || 0), 0)

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: compact ? 4 : 6,
      flexWrap: "wrap",
      padding: compact ? "6px 0" : "10px 0",
    }}>
      {EMOJIS.map(({ emoji, label }) => {
        const count    = counts[emoji] || 0
        const reacted  = hasReacted(matchId, emoji)
        const isBounce = bouncing === emoji

        return (
          <button
            key={emoji}
            onClick={() => react(emoji)}
            title={label}
            aria-label={`React with ${label}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: compact ? "4px 8px" : "6px 10px",
              borderRadius: 20,
              border: `1px solid ${reacted ? "var(--accent,#ee1e46)" : "var(--border,#2a2a2a)"}`,
              background: reacted ? "rgba(238,30,70,.12)" : "var(--surface2,#1a1a1a)",
              cursor: reacted ? "default" : "pointer",
              fontSize: compact ? "0.85rem" : "1rem",
              lineHeight: 1,
              transition: "all .15s",
              transform: isBounce ? "scale(1.25)" : "scale(1)",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{
              fontSize: compact ? "0.9rem" : "1.1rem",
              display: "inline-block",
              transition: "transform .15s",
            }}>
              {emoji}
            </span>
            {count > 0 && (
              <span style={{
                fontSize: compact ? "0.65rem" : "0.72rem",
                color: reacted ? "var(--accent,#ee1e46)" : "var(--muted,#888)",
                fontWeight: reacted ? 700 : 400,
                minWidth: 12,
              }}>
                {formatCount(count)}
              </span>
            )}
          </button>
        )
      })}

      {!compact && total > 0 && (
        <span style={{ fontSize: "0.7rem", color: "var(--muted,#888)", marginLeft: 4 }}>
          {total.toLocaleString()} reaction{total !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  )
}
