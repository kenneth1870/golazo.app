import { useState } from "react"

/**
 * Renders a team/competition flag image with a coloured-initial fallback.
 * Replaces the old pattern `{src && <img onError={hide} />}` which left
 * empty gaps when images fail to load.
 *
 * Props:
 *   src       — image URL (may be null/undefined)
 *   name      — team/competition name, used for initials + hue
 *   size      — pixel size (width = height), default 16
 *   className — forwarded to both <img> and the fallback <span>
 */
export default function FlagImg({ src, name, size = 16, className, style }) {
  const [err, setErr] = useState(false)

  if (src && !err) {
    return (
      <img
        src={src}
        alt={name || ""}
        className={className}
        style={{ width: size, height: size, objectFit: "contain", ...style }}
        onError={() => setErr(true)}
      />
    )
  }

  // Deterministic hue from the first character so the same team always gets
  // the same colour, even across sessions.
  const hue = ((name?.charCodeAt(0) ?? 0) * 137) % 360
  const initial = (name ?? "?").slice(0, 1).toUpperCase()

  return (
    <span
      className={className}
      title={name}
      aria-label={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `hsl(${hue},45%,32%)`,
        color: "#fff",
        fontSize: Math.max(size * 0.45, 7),
        fontWeight: 800,
        flexShrink: 0,
        lineHeight: 1,
        userSelect: "none",
        ...style,
      }}
    >
      {initial}
    </span>
  )
}
