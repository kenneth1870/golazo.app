import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchWithTimeout } from "../utils/fetchWithTimeout"

const TRANSFER_TYPE_COLOR = {
  "Loan":         "#f59e0b",
  "Loan Renewal": "#f59e0b",
  "Free Transfer":"#10b981",
  "Free agent":   "#10b981",
  "N/A":          "#6b7280",
}

function typeColor(type) {
  if (!type) return "#6b7280"
  const t = type.trim()
  return TRANSFER_TYPE_COLOR[t] || "#ee1e46"
}

function typeLabel(type) {
  if (!type || type === "N/A") return "—"
  return type
}

function ClubLogo({ club }) {
  if (!club) return <div style={{ width: 28, height: 28, borderRadius: 4, background: "var(--border,#2a2a2a)" }} />
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 52 }}>
      {club.logo && (
        <img
          src={club.logo} alt={club.name}
          style={{ width: 28, height: 28, objectFit: "contain" }}
          onError={e => { e.target.style.display = "none" }}
        />
      )}
      <span style={{ fontSize: "0.58rem", color: "var(--muted,#888)", textAlign: "center", lineHeight: 1.2, maxWidth: 56 }}>
        {club.name}
      </span>
    </div>
  )
}

function TransferRow({ transfer }) {
  const dateStr = transfer.date
    ? new Date(transfer.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : "—"

  const color = typeColor(transfer.type)

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 0", borderBottom: "1px solid var(--border,#1e1e1e)",
    }}>
      {/* Player name */}
      <div style={{ flex: "0 0 120px", minWidth: 0 }}>
        <Link
          to={`/players/${transfer.player_id}`}
          style={{ fontWeight: 600, fontSize: "0.85rem", color: "#fff", textDecoration: "none" }}
        >
          {transfer.player_name}
        </Link>
        <div style={{ fontSize: "0.68rem", color: "var(--muted,#888)", marginTop: 2 }}>{dateStr}</div>
      </div>

      {/* From club */}
      <ClubLogo club={transfer.from} />

      {/* Arrow */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ fontSize: "1rem", color: color }}>→</div>
        <span style={{
          fontSize: "0.56rem", fontWeight: 700,
          padding: "2px 6px", borderRadius: 6,
          background: `${color}22`, color: color,
          textAlign: "center", lineHeight: 1.3, whiteSpace: "nowrap",
        }}>
          {typeLabel(transfer.type)}
        </span>
      </div>

      {/* To club */}
      <ClubLogo club={transfer.to} />
    </div>
  )
}

function TransferSkeleton() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--border,#1e1e1e)" }}>
      <div className="loading-shimmer" style={{ width: 110, height: 36, borderRadius: 6 }} />
      <div className="loading-shimmer" style={{ width: 52, height: 48, borderRadius: 8 }} />
      <div className="loading-shimmer" style={{ width: 44, height: 32, borderRadius: 6 }} />
      <div className="loading-shimmer" style={{ width: 52, height: 48, borderRadius: 8 }} />
    </div>
  )
}

export default function TransferCenterPage() {
  const { t } = useTranslation()
  usePageMeta(
    t("transfers.title", "Transfer Center"),
    "Latest football transfers and rumors — World Cup 2026 player moves, free transfers, loans and signings."
  )

  const [transfers, setTransfers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [filter, setFilter]       = useState("all")  // "all" | "permanent" | "loan" | "free"

  useEffect(() => {
    setLoading(true)
    fetchWithTimeout("/api/v1/transfers?limit=60")
      .then(r => r.json())
      .then(setTransfers)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const filterMap = {
    all:       () => true,
    permanent: tr => tr.type && !tr.type.toLowerCase().includes("loan") && tr.type !== "N/A" && tr.type !== "Free Transfer" && tr.type !== "Free agent",
    loan:      tr => tr.type?.toLowerCase().includes("loan"),
    free:      tr => ["Free Transfer", "Free agent"].includes(tr.type),
  }

  const visible = transfers.filter(filterMap[filter] || filterMap.all)

  // Stat chips
  const stats = {
    total:     transfers.length,
    free:      transfers.filter(filterMap.free).length,
    loans:     transfers.filter(filterMap.loan).length,
    permanent: transfers.filter(filterMap.permanent).length,
  }

  return (
    <>
      <div className="page-hero" style={{ backgroundImage: "url('/images/hero_2.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">
            🔄 {t("transfers.title", "Transfer Center")}
          </h1>
          <p className="page-hero__sub">
            {t("transfers.subtitle", "Recent moves for top World Cup 2026 players")}
          </p>
        </div>
      </div>

      {/* Stat chips */}
      {!loading && transfers.length > 0 && (
        <div style={{ background: "var(--surface,#111)", borderBottom: "1px solid var(--border,#1e1e1e)" }}>
          <div className="container" style={{ display: "flex", gap: 16, padding: "12px 0", overflowX: "auto" }}>
            {[
              { key: "total",     label: t("transfers.all", "All"),       count: stats.total,     color: "#6b7280" },
              { key: "permanent", label: t("transfers.signed", "Signed"), count: stats.permanent, color: "#ee1e46" },
              { key: "loan",      label: t("transfers.loan", "Loan"),     count: stats.loans,     color: "#f59e0b" },
              { key: "free",      label: t("transfers.free", "Free"),     count: stats.free,      color: "#10b981" },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 2, padding: "8px 16px", borderRadius: 10, border: "none",
                  background: filter === chip.key ? `${chip.color}22` : "transparent",
                  cursor: "pointer", flexShrink: 0, transition: "all .15s",
                  outline: filter === chip.key ? `1px solid ${chip.color}` : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: chip.color }}>
                  {chip.count}
                </span>
                <span style={{ fontSize: "0.68rem", color: filter === chip.key ? chip.color : "var(--muted,#888)" }}>
                  {chip.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="site-section">
        <div className="container">
          <div className="widget-next-match">
            <div className="widget-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>
                {filter === "all"       ? t("transfers.recentMoves", "Recent Moves")
                 : filter === "loan"    ? t("transfers.loans", "Loans")
                 : filter === "free"    ? t("transfers.freeTransfers", "Free Transfers")
                 : t("transfers.signings", "Signings")}
              </h3>
              <span style={{ fontSize: "0.72rem", color: "var(--muted,#888)" }}>
                {!loading && `${visible.length} ${t("transfers.moves", "moves")}`}
              </span>
            </div>
            <div className="widget-body" style={{ paddingTop: 0 }}>
              {loading ? (
                [...Array(8)].map((_, i) => <TransferSkeleton key={i} />)
              ) : error ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted,#888)" }}>
                  {t("error.failedToLoad", "Failed to load")}
                </div>
              ) : visible.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔄</div>
                  <p style={{ color: "var(--muted,#888)" }}>
                    {t("transfers.noMoves", "No moves in this category")}
                  </p>
                </div>
              ) : (
                visible.map((tr, i) => (
                  <TransferRow key={`${tr.player_id}-${tr.date}-${i}`} transfer={tr} />
                ))
              )}
            </div>
          </div>

          {!loading && (
            <p style={{ textAlign: "center", color: "var(--muted,#888)", fontSize: "0.72rem", marginTop: 24 }}>
              {t("transfers.trackedNote", "Tracking transfers for top WC 2026 players since Jan 2025")}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
