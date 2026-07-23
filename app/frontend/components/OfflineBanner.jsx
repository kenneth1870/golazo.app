import { useTranslation } from "react-i18next"

export default function OfflineBanner({ stale = false, onRetry }) {
  const { t } = useTranslation()
  if (!stale) return null

  return (
    <div className="offline-banner" role="status">
      <span>{stale ? t("error.offlineStale") : t("error.tryAgain")}</span>
      {onRetry && (
        <button type="button" className="offline-banner__retry" onClick={onRetry}>
          {t("error.retry")}
        </button>
      )}
    </div>
  )
}
