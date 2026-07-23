export default function PullIndicator({ distance = 0, refreshing = false }) {
  const size = Math.min(distance / 72, 1)
  return (
    <div
      className="pull-indicator"
      style={{
        height: refreshing ? 48 : Math.min(distance * 0.6, 48),
        transition: refreshing ? "height .2s ease" : "none",
      }}
      aria-hidden="true"
    >
      <div
        className="pull-indicator__spinner"
        style={{
          transform: refreshing ? "none" : `rotate(${size * 360}deg)`,
          opacity: Math.max(size, refreshing ? 1 : 0),
        }}
      >
        {refreshing ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        )}
      </div>
    </div>
  )
}
