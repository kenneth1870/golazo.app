import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../../hooks/usePageMeta"
import { fetchJson } from "../../utils/fetchJson"
import OfflineBanner from "../../components/OfflineBanner"

const COUNTRY_FLAG = { "USA": "🇺🇸", "Canada": "🇨🇦", "Mexico": "🇲🇽" }

export default function VenuesPage() {
  const { t } = useTranslation()
  usePageMeta(t("mundial.venuesTitle"), "FIFA World Cup 2026 stadiums — 16 official venues across USA, Canada and Mexico.")
  const navigate = useNavigate()
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [stale, setStale] = useState(false)

  const load = () => {
    setError(false)
    setStale(false)
    setLoading(true)
    fetchJson("/api/v1/venues")
      .then(({ data, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline) { setError(true); return }
        setVenues(Array.isArray(data) ? data : [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  if (error) return (
    <div className="site-section">
      <div className="container" style={{ textAlign: "center", paddingTop: 60 }}>
        <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("mundial.venuesLoadError")}</p>
        <button className="btn btn-primary btn-sm" onClick={load}>{t("error.retry")}</button>
      </div>
    </div>
  )

  const byCountry = venues.reduce((acc, v) => {
    if (!acc[v.country]) acc[v.country] = []
    acc[v.country].push(v)
    return acc
  }, {})

  const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  return (
    <div className="site-section">
      <OfflineBanner stale={stale} onRetry={load} />
      <div className="container">
        {Object.entries(byCountry).map(([country, countryVenues]) => (
          <div key={country} className="mb-5">
            <div className="title-section">
              <h2 className="heading">{COUNTRY_FLAG[country]} {country}</h2>
            </div>
            <div className="row">
              {countryVenues.map((v, i) => (
                <div key={i} className="col-lg-6 mb-4">
                  <div
                    className="venue-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/mundial/venues/${slugify(v.name)}`)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div className="venue-card__name">{v.name}</div>
                        <div className="venue-card__city">{v.city}</div>
                      </div>
                      {v.matches?.length > 0 && (
                        <span style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 700 }}>
                          {t("mundial.venueMatches", { count: v.matches.length })} ›
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                      <div className="venue-card__capacity">
                        <span className="venue-card__capacity-label">{t("mundial.capacity")}</span>
                        <span className="venue-card__capacity-value">{v.capacity?.toLocaleString()}</span>
                      </div>
                      {v.group && <div className="venue-card__note" style={{ alignSelf: "center" }}>{v.group}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
