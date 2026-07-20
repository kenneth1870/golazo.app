export default function EmptyState({ icon = "⚽", title, description, children, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon" aria-hidden="true">{icon}</div>}
      {title && <h3>{title}</h3>}
      {description && (
        <p style={{ color: "var(--muted)", maxWidth: 320, textAlign: "center", margin: "0 0 12px" }}>
          {description}
        </p>
      )}
      {children}
      {action}
    </div>
  )
}
