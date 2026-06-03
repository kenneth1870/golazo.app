import { useState, useEffect } from "react"

const COUNTRY_FLAG = { "USA": "🇺🇸", "Canada": "🇨🇦", "Mexico": "🇲🇽" }

export default function VenuesPage() {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/venues")
      .then(r => r.json())
      .then(setVenues)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  const byCountry = venues.reduce((acc, v) => {
    if (!acc[v.country]) acc[v.country] = []
    acc[v.country].push(v)
    return acc
  }, {})

  return (
    <div className="site-section">
      <div className="container">
        {Object.entries(byCountry).map(([country, countryVenues]) => (
          <div key={country} className="mb-5">
            <div className="title-section">
              <h2 className="heading">{COUNTRY_FLAG[country]} {country}</h2>
            </div>
            <div className="row">
              {countryVenues.map((v, i) => (
                <div key={i} className="col-lg-4 col-md-6 mb-4">
                  <div className="venue-card">
                    <div className="venue-card__name">{v.name}</div>
                    <div className="venue-card__city">{v.city}</div>
                    <div className="venue-card__capacity">
                      <span className="venue-card__capacity-label">Capacity</span>
                      <span className="venue-card__capacity-value">{v.capacity?.toLocaleString()}</span>
                    </div>
                    {v.group && <div className="venue-card__note">{v.group}</div>}
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
