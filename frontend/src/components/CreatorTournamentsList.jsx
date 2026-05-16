function CreatorTournamentsList({
  loading,
  tournaments,
  segmentOptions,
  expandedAdd,
  setExpandedAdd,
  addSegment,
  submitForReview,
  t
}) {
  return (
    <>
      <h3 className="sr-section-heading">{t('creator.myTournaments')}</h3>
      {loading && <p>{t('common.loading')}</p>}
      {!loading && tournaments.length === 0 && <p className="sr-card">{t('creator.noTournaments')}</p>}
      <div className="sr-creator-list">
        {tournaments.map((tournament) => {
          const isEditable = tournament.status === 'draft' || tournament.status === 'rejected';
          const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
          const available = segmentOptions.filter((s) => !tournament.segments?.some((e) => e.segment.id === s.id));
          return (
            <div key={tournament.id} className="sr-card">
              <div className="sr-creator-card-head">
                <div>
                  <h3>{tournament.name}</h3>
                  <span className={`sr-status-badge sr-status-${tournament.status}`}>
                    {t(`creator.status_${tournament.status}`)}
                  </span>
                </div>
                {isEditable && (
                  <button type="button" onClick={() => submitForReview(tournament)}>
                    {t('creator.submitReview')}
                  </button>
                )}
              </div>

              {tournament.review_note && <p className="sr-creator-review-note">{tournament.review_note}</p>}

              <p className="sr-creator-seg-count">
                {sortedSegments.length} / {tournament.total_segments_count} {t('creator.segments')}
              </p>

              {sortedSegments.length > 0 ? (
                <div className="sr-creator-segment-list">
                  {sortedSegments.map((ts) => (
                    <div key={ts.segment.id} className="sr-creator-segment-item">
                      <span className="sr-creator-seg-num">#{ts.order_number}</span>
                      <span className="sr-creator-seg-name">{ts.segment.name}</span>
                      {ts.is_rated && <span className="sr-creator-rated">★ {t('creator.rated')}</span>}
                      {ts.segment.distance_meters != null && (
                        <span className="sr-creator-seg-dist">{(ts.segment.distance_meters / 1000).toFixed(2)} km</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sr-muted sr-spaced-card">{t('creator.noSegmentsAdded')}</p>
              )}

              {isEditable && (
                <>
                  <button
                    type="button"
                    className="sr-creator-ghost-btn sr-creator-add-toggle"
                    onClick={() => setExpandedAdd(expandedAdd === tournament.id ? null : tournament.id)}
                  >
                    {expandedAdd === tournament.id ? t('creator.cancelAdd') : t('creator.addSegmentBtn')}
                  </button>
                  {expandedAdd === tournament.id && (
                    <form
                      className="sr-creator-add-row sr-creator-add-row-expanded"
                      onSubmit={async (event) => {
                        const ok = await addSegment(tournament, event);
                        if (ok) {
                          setExpandedAdd(null);
                        }
                      }}
                    >
                      <select name="segment_id" required>
                        <option value="">{t('creator.selectSegment')}</option>
                        {available.map((segment) => (
                          <option key={segment.id} value={segment.id}>
                            {segment.name}
                          </option>
                        ))}
                      </select>
                      <input name="order_number" type="number" min="1" defaultValue={sortedSegments.length + 1} />
                      <label>
                        <input name="is_rated" type="checkbox" defaultChecked /> {t('creator.rated')}
                      </label>
                      <button type="submit">{t('creator.add')}</button>
                    </form>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default CreatorTournamentsList;
