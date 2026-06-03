export function formatKickoff(utcDate) {
  if (!utcDate) return "TBD"
  const d = new Date(utcDate)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function formatMatchDate(utcDate) {
  if (!utcDate) return "TBD"
  const d = new Date(utcDate)
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
}

export function formatMatchDateTime(utcDate) {
  if (!utcDate) return "TBD"
  const d = new Date(utcDate)
  return d.toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  })
}

export function formatFull(utcDate) {
  if (!utcDate) return "TBD"
  const d = new Date(utcDate)
  return d.toLocaleString([], {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short"
  })
}

export function isToday(utcDate) {
  if (!utcDate) return false
  const d = new Date(utcDate)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}
