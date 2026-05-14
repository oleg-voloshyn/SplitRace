import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function TournamentShare({ tournament }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const shareUrl = useMemo(() => new URL(`/tournaments/${tournament.slug}`, window.location.origin).toString(), [tournament.slug])
  const shareText = t('tournaments.shareText', { name: tournament.name })
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(shareText)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt(t('tournaments.copyLink'), shareUrl)
    }
  }

  async function nativeShare() {
    try {
      if (!navigator.share) {
        await copyLink()
        return
      }

      await navigator.share({
        title: tournament.name,
        text: shareText,
        url: shareUrl,
      })
    } catch (error) {
      if (error?.name !== 'AbortError') await copyLink()
    }
  }

  return (
    <div className="sr-share-panel" aria-label={t('tournaments.shareTournament')}>
      <div className="sr-share-link">
        <span>{shareUrl}</span>
      </div>
      <div className="sr-share-actions">
        <button type="button" onClick={copyLink} className="sr-share-btn">
          {copied ? t('tournaments.linkCopied') : t('tournaments.copyLink')}
        </button>
        <button type="button" onClick={nativeShare} className="sr-share-btn sr-share-btn-primary">
          {t('tournaments.share')}
        </button>
        <a className="sr-share-icon" href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noreferrer">Telegram</a>
        <a className="sr-share-icon" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer">Facebook</a>
        <a className="sr-share-icon" href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noreferrer">X</a>
        <a className="sr-share-icon" href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </div>
    </div>
  )
}
