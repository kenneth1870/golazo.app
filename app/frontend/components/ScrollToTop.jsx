import { useEffect } from "react"
import { useLocation, useNavigationType } from "react-router-dom"

export default function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  // POP = browser back/forward — preserve scroll position in that case
  useEffect(() => { if (navType !== "POP") window.scrollTo(0, 0) }, [pathname, navType])
  return null
}
