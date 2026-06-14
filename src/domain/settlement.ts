import { Match, PenaltyStatus, Prediction } from '../types';

export interface PredictionSettlement {
  status: PenaltyStatus;
  penaltyVnd: number;
}

const EPSILON = 0.0001;

function isEqual(value: number, target: number) {
  return Math.abs(value - target) < EPSILON;
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

  const homeMargin = match.homeGoals + match.handicap - match.awayGoals;
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
