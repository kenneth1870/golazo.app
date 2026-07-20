import i18n from "../i18n"

function tbd() {
  return i18n.t("time.tbd")
}

export function formatKickoff(utcDate, locale) {
  if (!utcDate) return tbd()
  const loc = locale || i18n.language
  return new Date(utcDate).toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit", hour12: true })
}

export function formatMatchDate(utcDate, locale) {
  if (!utcDate) return tbd()
  return new Date(utcDate).toLocaleDateString(locale || undefined, { weekday: "short", month: "short", day: "numeric" })
}

export function formatMatchDateTime(utcDate, locale) {
  if (!utcDate) return tbd()
  return new Date(utcDate).toLocaleString(locale || undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

export function formatFull(utcDate, locale) {
  if (!utcDate) return tbd()
  return new Date(utcDate).toLocaleString(locale || undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  })
}

export function isToday(utcDate) {
  if (!utcDate) return false
  const d = new Date(utcDate)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}
