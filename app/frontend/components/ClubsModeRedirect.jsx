import { Navigate } from "react-router-dom"
import { useAppFocus } from "../hooks/useAppFocus"

/** In clubs-only mode, send users to leagues instead of archived WC surfaces. */
export default function ClubsModeRedirect({ to = "/leagues", children }) {
  const { wc_paused: wcPaused = true } = useAppFocus()
  if (wcPaused) return <Navigate to={to} replace />
  return children
}
