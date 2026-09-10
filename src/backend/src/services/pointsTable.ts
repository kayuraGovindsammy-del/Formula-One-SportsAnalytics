// ---------------------------------------------------------------------------
// F1 points-per-finishing-position scale — docs/f1-statistics.md §3.
//
// Pure function: no express, no req/res, no file or database access.
//
// Only the base race scale (P1-P10) is implemented here. Two related scales
// are deliberately NOT implemented, because no rule for either is documented
// anywhere (see docs/f1-statistics.md §3):
//   - the fastest-lap bonus point
//   - the separate, smaller sprint-session points scale
// A sprint session's classification should not be passed through this
// function until that scale is defined.
// ---------------------------------------------------------------------------

const POINTS_BY_POSITION: readonly number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * Points earned for a given race finishing position, per the standard F1
 * scale. Returns 0 for P11 and lower, and for a null position (no derivable
 * finish) — never null itself, since "scored zero" and "nothing to add to the
 * total" are the same thing from a points perspective.
 */
export function pointsForPosition(position: number | null): number {
  if (position === null || position < 1) {
    return 0;
  }

  return POINTS_BY_POSITION[position - 1] ?? 0;
}
