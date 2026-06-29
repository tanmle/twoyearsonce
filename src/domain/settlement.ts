import { GoalEvent, Match, PenaltyStatus, Prediction } from '../types';

export interface PredictionSettlement {
  status: PenaltyStatus;
  penaltyVnd: number;
}

const EPSILON = 0.0001;
// Goals scored after the 90th minute (extra time) are excluded from settlement.
// Stoppage time of the second half is reported as minute 90 ("90+x'"), so it stays in.
const REGULAR_TIME_LAST_MINUTE = 90;

function isEqual(value: number, target: number) {
  return Math.abs(value - target) < EPSILON;
}

/**
 * Returns the regular-time (90') goal count derived from goal events, or `null` when the
 * events cannot be trusted (missing/partial sync, unparsed minutes). The caller then falls
 * back to the final score. The FIFA feed's score includes extra-time goals, so without this
 * a knockout match decided in extra time would settle on the wrong number.
 */
function regularTimeGoals(events: GoalEvent[] | undefined, finalGoals: number): number | null {
  const list = events ?? [];
  // If the event list does not fully account for the final score, it is incomplete — bail out.
  if (list.length !== finalGoals) return null;
  if (list.some((event) => !Number.isFinite(event.minute))) return null;
  return list.filter((event) => (event.minute as number) <= REGULAR_TIME_LAST_MINUTE).length;
}

export function settlePrediction(match: Match, prediction: Prediction): PredictionSettlement {
  if (
    match.status !== 'FINISHED' ||
    match.homeGoals === undefined ||
    match.awayGoals === undefined ||
    !prediction.choice
  ) {
    return { status: 'SETTLE_PENDING', penaltyVnd: 0 };
  }

  const homeRegular = regularTimeGoals(match.homeGoalEvents, match.homeGoals);
  const awayRegular = regularTimeGoals(match.awayGoalEvents, match.awayGoals);
  const useRegular = homeRegular !== null && awayRegular !== null;
  const homeGoals = useRegular ? homeRegular : match.homeGoals;
  const awayGoals = useRegular ? awayRegular : match.awayGoals;

  const homeMargin = homeGoals + match.handicap - awayGoals;
  const selectedMargin = prediction.choice === 'HOME' ? homeMargin : -homeMargin;

  const isPostGroupMatch = Boolean(match.matchType && match.matchType !== 'group');
  const usesHopeStar = prediction.hopeStar && isPostGroupMatch;

  if (selectedMargin > EPSILON) {
    return { status: 'WIN', penaltyVnd: usesHopeStar ? -10000 : 0 };
  }

  if (isEqual(selectedMargin, 0)) {
    return { status: 'WIN', penaltyVnd: 0 };
  }

  if (isEqual(selectedMargin, -0.25)) {
    return usesHopeStar
      ? { status: 'LOSE', penaltyVnd: 10000 }
      : { status: 'LOSE_HALF', penaltyVnd: 5000 };
  }

  return usesHopeStar
    ? { status: 'LOSE_DOUBLE', penaltyVnd: 20000 }
    : { status: 'LOSE', penaltyVnd: 10000 };
}

export function getOutcomeKey(status: PenaltyStatus) {
  switch (status) {
    case 'WIN':
      return 'không thua';
    case 'LOSE_HALF':
      return 'thua nửa';
    case 'LOSE':
      return 'thua';
    case 'LOSE_DOUBLE':
      return 'thua đôi';
    case 'SETTLE_PENDING':
      return 'chưa tính';
  }
}
