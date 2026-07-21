/** Keyboard-accessible props for click-to-dismiss modal backdrops. */
export function dismissOverlayProps(onDismiss, ariaLabel = "Close") {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": ariaLabel,
    onClick: onDismiss,
    onKeyDown(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onDismiss()
      }
    },
  }
}
