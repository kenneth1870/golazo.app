import { useTranslation } from "react-i18next"

export default function NewsArticleBody({ paragraphs, images = [], loading = false }) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="news-article__content news-article__content--loading" aria-busy="true">
        <p className="news-article__loading-label">{t("news.loadingBody")}</p>
        {[100, 95, 88, 100, 72, 90].map((w, i) => (
          <div key={i} className="loading-shimmer" style={{ height: 18, width: `${w}%`, borderRadius: 4, marginBottom: 14 }} />
        ))}
      </div>
    )
  }

  if (!paragraphs.length) return null

  const blocks = []
  const imgList = Array.isArray(images) ? images : []
  const interval = imgList.length > 0 ? Math.max(3, Math.floor(paragraphs.length / (imgList.length + 1))) : null
  let imgIdx = 0

  paragraphs.forEach((p, i) => {
    blocks.push({ type: "p", text: p, key: `p-${i}` })
    if (interval && imgList[imgIdx] && (i + 1) % interval === 0) {
      blocks.push({ type: "img", ...imgList[imgIdx], key: `img-${imgIdx}` })
      imgIdx += 1
    }
  })

  while (imgIdx < imgList.length) {
    blocks.push({ type: "img", ...imgList[imgIdx], key: `img-tail-${imgIdx}` })
    imgIdx += 1
  }

  return (
    <div className="news-article__content">
      {blocks.map(block => {
        if (block.type === "p") {
          return <p key={block.key}>{block.text}</p>
        }
        return (
          <figure key={block.key} className="news-article__figure">
            <img
              src={block.url}
              alt={block.caption || ""}
              className="news-article__inline-img"
              loading="lazy"
              decoding="async"
              onError={e => { e.target.closest("figure")?.remove() }}
            />
            {block.caption && <figcaption className="news-article__caption">{block.caption}</figcaption>}
          </figure>
        )
      })}
    </div>
  )
}
