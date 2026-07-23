import { useState, memo } from "react"

/** Decorative logo/flag — returns null on error instead of hiding with display:none. */
const SafeImg = memo(function SafeImg({ src, alt, className, style }) {
  const [err, setErr] = useState(false)
  if (!src || err) return null
  return (
    <img
      src={src}
      alt={alt || ""}
      className={className}
      style={style}
      onError={() => setErr(true)}
    />
  )
})

export default SafeImg
