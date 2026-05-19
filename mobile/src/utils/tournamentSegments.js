// Selection state shape used by NewTournament's pick-segments step:
//   { [segmentId]: { rated: boolean, order: number, ratedOrder?: number } }
//
// `order` is insertion order (drives default ordering for unrated segments).
// `ratedOrder` is the user-chosen 1..ratedTarget position for rated segments;
// `null`/missing means "rated, but not yet positioned" (invalid for submit).

function firstAvailableRatedOrder(selectedSegments, ratedTarget) {
  const used = new Set(
    Object.values(selectedSegments)
      .filter((meta) => meta.rated && meta.ratedOrder)
      .map((meta) => meta.ratedOrder)
  );

  for (let position = 1; position <= ratedTarget; position += 1) {
    if (!used.has(position)) {
      return position;
    }
  }

  return ratedTarget + 1;
}

function hasCompleteRatedOrder(selectedSegments, ratedTarget) {
  const positions = Object.values(selectedSegments)
    .filter((meta) => meta.rated)
    .map((meta) => meta.ratedOrder)
    .filter(Boolean);
  if (positions.length !== ratedTarget) {
    return false;
  }

  const uniquePositions = new Set(positions);
  return (
    uniquePositions.size === ratedTarget &&
    Array.from({ length: ratedTarget }, (_, i) => i + 1).every((position) => uniquePositions.has(position))
  );
}

// Rated segments must be submitted first in the explicit rated order because
// TournamentSegment.order_number is the source of truth for unlock order.
// Unrated segments follow in insertion order.
function buildTournamentSegmentSubmitOrder(selectedSegments) {
  const entries = Object.entries(selectedSegments);
  const rated = entries
    .filter(([, meta]) => meta.rated)
    .sort(([, a], [, b]) => (a.ratedOrder || Number.MAX_SAFE_INTEGER) - (b.ratedOrder || Number.MAX_SAFE_INTEGER));
  const unrated = entries.filter(([, meta]) => !meta.rated).sort(([, a], [, b]) => a.order - b.order);

  return [...rated, ...unrated];
}

export { buildTournamentSegmentSubmitOrder, firstAvailableRatedOrder, hasCompleteRatedOrder };
