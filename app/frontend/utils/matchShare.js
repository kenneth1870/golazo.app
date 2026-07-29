/** Build WhatsApp-friendly share text for a match. */
export function buildMatchShareText({
  homeName,
  awayName,
  homeScore,
  awayScore,
  statusShort,
  isLive,
  events,
  homeTeamRaw,
  round,
  t,
}) {
  const hs = homeScore ?? "?"
  const as = awayScore ?? "?"
  const isFT = ["FT", "AET", "PEN"].includes(statusShort)
  const lines = []

  if (isLive) {
    lines.push(`🔴 ${t("status.live")} · ${homeName} ${hs}–${as} ${awayName}`)
  } else if (isFT) {
    const winner = Number(hs) > Number(as) ? homeName : Number(as) > Number(hs) ? awayName : null
    lines.push(
      `⚽ ${t("status.ft")} · ${homeName} ${hs}–${as} ${awayName}${
        winner ? t("match.shareWin", { team: winner }) : ` · ${t("match.draw")}`
      }`
    )
  } else {
    lines.push(`${homeName} vs ${awayName}`)
  }

  if (round) lines.push(`📅 ${round}`)

  const goalEvents = (events ?? []).filter(e => e.type === "Goal" && e.detail !== "Missed Penalty")
  if (goalEvents.length > 0 && homeTeamRaw) {
    const homeGoals = goalEvents.filter(e => e.team?.name === homeTeamRaw).map(e => `${e.player} ${e.minute}'`).join(", ")
    const awayGoals = goalEvents.filter(e => e.team?.name !== homeTeamRaw).map(e => `${e.player} ${e.minute}'`).join(", ")
    if (homeGoals) lines.push(`  ${homeName}: ${homeGoals}`)
    if (awayGoals) lines.push(`  ${awayName}: ${awayGoals}`)
  }

  if (typeof window !== "undefined") lines.push(window.location.href)
  return lines.join("\n")
}

export async function shareMatchText({ title, text, onCopied }) {
  const url = typeof window !== "undefined" ? window.location.href : ""

  const fallback = () => {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    } catch {}
    navigator.vibrate?.(50)
    onCopied?.()
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      navigator.vibrate?.(50)
      onCopied?.()
      return
    } catch {
      fallback()
    }
  } else {
    fallback()
  }
}
