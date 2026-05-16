import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SHARE_FORMATS = {
  story: { label: 'Story', ratio: '9:16', width: 1080, height: 1920 },
  post: { label: 'Post', ratio: '4:5', width: 1080, height: 1350 },
  square: { label: 'Square', ratio: '1:1', width: 1080, height: 1080 }
};

function EntityShare({ entity, kind, url, title, subtitle, stats, labels }) {
  const [copied, setCopied] = useState(false);
  const shareText = labels.shareText;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(labels.copyLink, url);
    }
  }

  async function nativeShare() {
    try {
      if (!navigator.share) {
        await copyLink();
        return;
      }

      await navigator.share({ title, text: shareText, url });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        await copyLink();
      }
    }
  }

  async function shareImage(formatKey) {
    const blob = await createEntityShareBlob({ title, subtitle, stats, url, kind, formatKey }).catch(() => null);
    if (!blob) {
      await nativeShare();
      return;
    }

    const file = new File([blob], `splitrace-${kind}-${entity.id || entity.slug || formatKey}.png`, {
      type: 'image/png'
    });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: shareText, url }).catch(() => {});
      return;
    }

    downloadBlob(file);
  }

  return (
    <div className="sr-share-panel" aria-label={labels.title}>
      <div className="sr-share-preview">
        <div className="sr-share-preview-art" aria-hidden="true">
          {kind === 'segment' ? <SegmentShareIcon /> : <TournamentShareIcon />}
        </div>
        <div>
          <span className="sr-share-kicker">{kind === 'segment' ? labels.segment : labels.tournament}</span>
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </div>
      </div>
      <div className="sr-share-link">
        <span>{url}</span>
      </div>
      <div className="sr-share-actions">
        <button type="button" onClick={copyLink} className="sr-share-btn">
          {copied ? labels.linkCopied : labels.copyLink}
        </button>
        <button type="button" onClick={nativeShare} className="sr-share-btn sr-share-btn-primary">
          {labels.share}
        </button>
        <a
          className="sr-share-icon"
          href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
          target="_blank"
          rel="noreferrer"
        >
          Telegram
        </a>
        <a
          className="sr-share-icon"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
        >
          Facebook
        </a>
        <a
          className="sr-share-icon"
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`}
          target="_blank"
          rel="noreferrer"
        >
          X
        </a>
        <a
          className="sr-share-icon"
          href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
      </div>
      <div className="sr-share-format-row" aria-label={labels.shareImage}>
        {Object.entries(SHARE_FORMATS).map(([format, config]) => (
          <button key={format} type="button" onClick={() => shareImage(format)} className="sr-share-format-btn">
            <strong>{config.label}</strong>
            <span>{config.ratio}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TournamentShare({ tournament }) {
  const labels = useShareLabels();
  const url = useMemo(
    () => new URL(`/tournaments/${tournament.slug}`, window.location.origin).toString(),
    [tournament.slug]
  );
  const location = [tournament.city, tournament.country].filter(Boolean).join(', ');
  const stats = [
    { label: labels.participants, value: String(tournament.participants_count ?? 0) },
    { label: labels.segments, value: String(tournament.total_segments_count ?? tournament.segments?.length ?? 0) },
    { label: labels.status, value: tournament.status || '-' }
  ];

  return (
    <EntityShare
      entity={tournament}
      kind="tournament"
      url={url}
      title={tournament.name}
      subtitle={location || labels.tournamentSubtitle}
      stats={stats}
      labels={{
        ...labels,
        title: labels.shareTournament,
        shareText: labels.tournamentShareText(tournament.name)
      }}
    />
  );
}

function SegmentShare({ segment }) {
  const labels = useShareLabels();
  const url = useMemo(() => new URL(`/segments/${segment.id}`, window.location.origin).toString(), [segment.id]);
  const location = [segment.city, segment.country].filter(Boolean).join(', ');
  const stats = [
    {
      label: labels.distance,
      value: segment.distance_meters ? `${(segment.distance_meters / 1000).toFixed(2)} km` : '-'
    },
    { label: labels.location, value: location || '-' }
  ];

  return (
    <EntityShare
      entity={segment}
      kind="segment"
      url={url}
      title={segment.name}
      subtitle={location || labels.segmentSubtitle}
      stats={stats}
      labels={{
        ...labels,
        title: labels.shareSegment,
        shareText: labels.segmentShareText(segment.name)
      }}
    />
  );
}

function useShareLabels() {
  const { t } = useTranslation();
  return {
    shareTournament: t('tournaments.shareTournament'),
    shareSegment: t('segments.shareSegment', { defaultValue: 'Share segment' }),
    copyLink: t('tournaments.copyLink'),
    linkCopied: t('tournaments.linkCopied'),
    share: t('tournaments.share'),
    shareImage: t('share.image', { defaultValue: 'Share image' }),
    tournament: t('share.tournament', { defaultValue: 'Tournament' }),
    segment: t('share.segment', { defaultValue: 'Segment' }),
    tournamentSubtitle: t('share.tournamentSubtitle', { defaultValue: 'SplitRace tournament' }),
    segmentSubtitle: t('share.segmentSubtitle', { defaultValue: 'SplitRace segment' }),
    participants: t('tournaments.participantsLabel', { defaultValue: 'Participants' }),
    segments: t('tournaments.segmentsHeader', { defaultValue: 'Segments' }),
    status: t('tournaments.status', { defaultValue: 'Status' }),
    distance: t('tournaments.distance', { defaultValue: 'Distance' }),
    location: t('tournaments.location', { defaultValue: 'Location' }),
    tournamentShareText: (name) => t('tournaments.shareText', { name }),
    segmentShareText: (name) =>
      t('segments.shareText', { name, defaultValue: `Try this running segment on SplitRace: ${name}` })
  };
}

async function createEntityShareBlob({ title, subtitle, stats, url, kind, formatKey }) {
  const format = SHARE_FORMATS[formatKey] || SHARE_FORMATS.story;
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext('2d');
  const scale = format.width / 1080;
  const pad = 80 * scale;
  const artTop = formatKey === 'story' ? 330 * scale : 210 * scale;

  const gradient = ctx.createLinearGradient(0, 0, format.width, format.height);
  gradient.addColorStop(0, '#0d1124');
  gradient.addColorStop(0.55, '#171b33');
  gradient.addColorStop(1, '#080b18');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, format.width, format.height);

  drawCircle(ctx, format.width - 100 * scale, 140 * scale, 290 * scale, 'rgba(229, 57, 53, 0.14)');
  drawCircle(ctx, 100 * scale, format.height - 160 * scale, 300 * scale, 'rgba(59, 130, 246, 0.1)');
  drawGrid(ctx, format.width, format.height, 44 * scale);

  ctx.fillStyle = '#ffffff';
  ctx.font = `${38 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText('SPLITRACE', pad, pad + 26 * scale);
  ctx.fillStyle = 'rgba(255,255,255,0.48)';
  ctx.font = `${24 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText(kind === 'segment' ? 'Segment challenge' : 'Running tournament', pad, pad + 70 * scale);

  drawShareArt(ctx, kind, format.width / 2, artTop, scale);

  const titleY = formatKey === 'story' ? 760 * scale : 530 * scale;
  ctx.fillStyle = '#ff5953';
  ctx.font = `900 ${26 * scale}px Inter, system-ui, sans-serif`;
  ctx.fillText(kind.toUpperCase(), pad, titleY - 72 * scale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${formatKey === 'square' ? 58 * scale : 76 * scale}px Inter, system-ui, sans-serif`;
  wrapCanvasText(ctx, title, pad, titleY, format.width - pad * 2, 86 * scale, formatKey === 'story' ? 3 : 2);

  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.font = `${28 * scale}px Inter, system-ui, sans-serif`;
  wrapCanvasText(ctx, subtitle || '', pad, titleY + 190 * scale, format.width - pad * 2, 38 * scale, 2);

  const statsY = formatKey === 'story' ? 1120 * scale : 830 * scale;
  drawRoundRect(ctx, pad, statsY, format.width - pad * 2, 190 * scale, 34 * scale, '#151a30');
  stats.slice(0, 3).forEach((stat, index) => {
    const x = pad + 50 * scale + index * 300 * scale;
    ctx.fillStyle = index === 0 ? '#ff5953' : '#ffffff';
    ctx.font = `900 ${36 * scale}px Inter, system-ui, sans-serif`;
    truncateCanvasText(ctx, stat.value, x, statsY + 78 * scale, 245 * scale);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `800 ${18 * scale}px Inter, system-ui, sans-serif`;
    truncateCanvasText(ctx, stat.label.toUpperCase(), x, statsY + 124 * scale, 245 * scale);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `700 ${24 * scale}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(url.replace(/^https?:\/\//, ''), format.width / 2, format.height - 86 * scale);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1));
}

function drawShareArt(ctx, kind, cx, cy, scale) {
  ctx.strokeStyle = '#ff5953';
  ctx.lineWidth = 26 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'segment') {
    ctx.moveTo(cx - 210 * scale, cy + 60 * scale);
    ctx.bezierCurveTo(
      cx - 90 * scale,
      cy - 70 * scale,
      cx + 40 * scale,
      cy + 130 * scale,
      cx + 210 * scale,
      cy - 40 * scale
    );
  } else {
    ctx.moveTo(cx - 230 * scale, cy + 70 * scale);
    ctx.bezierCurveTo(
      cx - 90 * scale,
      cy + 30 * scale,
      cx - 70 * scale,
      cy - 110 * scale,
      cx + 70 * scale,
      cy - 60 * scale
    );
    ctx.bezierCurveTo(
      cx + 160 * scale,
      cy - 30 * scale,
      cx + 120 * scale,
      cy + 90 * scale,
      cx + 230 * scale,
      cy + 40 * scale
    );
  }
  ctx.stroke();

  drawCircle(ctx, cx - 230 * scale, cy + 72 * scale, 34 * scale, '#ffffff');
  drawCircle(ctx, cx - 230 * scale, cy + 72 * scale, 17 * scale, '#0d1124');
  drawCircle(ctx, cx + 230 * scale, cy - 40 * scale, 34 * scale, '#ffffff');

  if (kind === 'tournament') {
    ctx.fillStyle = '#f7d36c';
    ctx.fillRect(cx - 44 * scale, cy - 150 * scale, 88 * scale, 95 * scale);
    ctx.fillRect(cx - 70 * scale, cy - 40 * scale, 140 * scale, 24 * scale);
  } else {
    ctx.fillStyle = '#ff5953';
    ctx.beginPath();
    ctx.arc(cx + 150 * scale, cy - 92 * scale, 58 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d1124';
    ctx.beginPath();
    ctx.arc(cx + 150 * scale, cy - 92 * scale, 22 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrid(ctx, width, height, gap) {
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawCircle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRoundRect(ctx, x, y, width, height, radius, color) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text).split(' ');
  let line = '';
  let lines = 0;
  words.forEach((word) => {
    if (lines >= maxLines) {
      return;
    }
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
    } else {
      line = test;
    }
  });
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y);
  }
}

function truncateCanvasText(ctx, text, x, y, maxWidth) {
  let output = String(text);
  while (ctx.measureText(output).width > maxWidth && output.length > 4) {
    output = `${output.slice(0, -4)}...`;
  }
  ctx.fillText(output, x, y);
}

function downloadBlob(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

function SegmentShareIcon() {
  return (
    <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <path d="M18 58 C36 28, 58 70, 82 36" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
      <circle cx="18" cy="58" r="8" fill="#fff" />
      <path d="M86 12a16 16 0 0 1 16 16c0 12-16 29-16 29S70 40 70 28a16 16 0 0 1 16-16z" fill="currentColor" />
      <circle cx="86" cy="28" r="6" fill="#151a30" />
    </svg>
  );
}

function TournamentShareIcon() {
  return (
    <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <path
        d="M16 60 C34 50, 42 20, 64 32 S84 70, 104 42"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path d="M54 14h28v15c0 18-8 30-14 30S54 47 54 29V14z" fill="#f7d36c" />
      <path
        d="M54 24H38c0 15 7 23 19 25M82 24h16c0 15-7 23-19 25"
        fill="none"
        stroke="#f7d36c"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M68 58v12M50 72h36" stroke="#f7d36c" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export { SegmentShare, TournamentShare };
export default EntityShare;
