import { useState, useCallback } from "react"
import { fetchJson } from "../utils/fetchJson"

const TOKEN_KEY = "golazo_auth_token"
const USER_KEY  = "golazo_auth_user"

function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null") } catch { return null }
}

export function useAuth() {
  const [token, setToken] = useState(getStoredToken)
  const [user,  setUser]  = useState(getStoredUser)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const persist = (tok, usr) => {
    localStorage.setItem(TOKEN_KEY, tok)
    localStorage.setItem(USER_KEY, JSON.stringify(usr))
    setToken(tok)
    setUser(usr)
  }

  const clear = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  const loginWithSession = useCallback((tok, usr) => {
    persist(tok, usr)
  }, [])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data, ok, offline } = await fetchJson("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        soft: true,
      })
      if (!ok || offline) {
        setError(data?.error || "Login failed")
        return false
      }
      persist(data.token, data.user)
      return true
    } catch {
      setError("Network error. Please try again.")
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetchJson("/api/v1/sessions", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        soft: true,
      })
    } catch {}
    clear()
  }, [token])

  const authFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }).then(res => {
      if (res.status === 401) clear()
      return res
    })
  }, [token])

  /** JSON helper for admin routes — clears session and throws on 401. */
  const authJson = useCallback(async (url, options = {}) => {
    const res = await authFetch(url, options)
    if (res.status === 401) {
      clear()
      const err = new Error("session_expired")
      err.status = 401
      throw err
    }
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const body = await res.json()
        message = body.error || message
      } catch {}
      const err = new Error(message)
      err.status = res.status
      throw err
    }
    return res.json()
  }, [authFetch])

  const validateSession = useCallback(async () => {
    if (!token) return false
    try {
      const res = await authFetch("/api/v1/sessions/me")
      if (!res.ok) {
        clear()
        return false
      }
      const data = await res.json()
      if (data?.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        setUser(data.user)
      }
      return !!data?.user
    } catch {
      clear()
      return false
    }
  }, [authFetch, token])

  const isAdmin = user?.role === "admin"

  return { user, token, loading, error, login, loginWithSession, logout, authFetch, authJson, validateSession, isAdmin, isLoggedIn: !!token }
}
