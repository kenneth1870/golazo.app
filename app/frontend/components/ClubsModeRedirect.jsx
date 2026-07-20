import { Navigate } from "react-router-dom"
import { useAppFocus } from "../hooks/useAppFocus"

/** In clubs-first mode, send users to leagues instead of archived WC surfaces. */
export default function ClubsModeRedirect({ to = "/leagues", children }) {
  const { clubs_primary: clubsPrimary } = useAppFocus()
  if (clubsPrimary) return <Navigate to={to} replace />
  return children
}
