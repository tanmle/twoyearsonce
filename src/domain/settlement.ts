import { Match, PenaltyStatus, Prediction } from '../types';

export interface PredictionSettlement {
  status: PenaltyStatus;
  penaltyVnd: number;
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

  const correctedHomeGoals = match.homeGoals + match.handicap;
  const isHomeWin = correctedHomeGoals > match.awayGoals;
  const isHandicapDraw = correctedHomeGoals === match.awayGoals;

  if (prediction.choice === 'HOME') {
    if (isHomeWin) return { status: 'WIN', penaltyVnd: 0 };
    if (isHandicapDraw) return { status: 'LOSE_HALF', penaltyVnd: 5000 };
    return { status: 'LOSE', penaltyVnd: 10000 };
  }

  if (!isHomeWin && !isHandicapDraw) return { status: 'WIN', penaltyVnd: 0 };
  if (isHandicapDraw) return { status: 'LOSE_HALF', penaltyVnd: 5000 };
  return { status: 'LOSE_DOUBLE', penaltyVnd: 20000 };
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
