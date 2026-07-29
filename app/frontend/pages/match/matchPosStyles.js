export const POS_STYLE = {
  G:  { bg: "#f59e0b", shadow: "rgba(245,158,11,.4)" },
  D:  { bg: "#3b82f6", shadow: "rgba(59,130,246,.4)" },
  M:  { bg: "#10b981", shadow: "rgba(16,185,129,.4)" },
  F:  { bg: "var(--accent)", shadow: "rgba(238,30,70,.4)" },
}

export const POS_I18N = {
  G: "match.posGK",
  D: "match.posDEF",
  M: "match.posMID",
  F: "match.posFWD",
}

export function posStyle(pos) { return POS_STYLE[pos] || POS_STYLE.M }
export function posLabel(pos, t) { return t(POS_I18N[pos] || POS_I18N.M) }
