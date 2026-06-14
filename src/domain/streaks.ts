import { Match, Settlement } from '../types';
import { sortMatchesChronologically } from './matches';

export type FormResult = 'WIN' | 'LOSE_HALF' | 'LOSE' | 'LOSE_DOUBLE';

export interface PlayerStreakSummary {
  currentKind: 'WIN' | 'LOSE' | 'NONE';
  currentCount: number;
  bestWinStreak: number;
  worstLoseStreak: number;
  recentResults: Array<{ matchId: string; status: FormResult }>;
}

const losingStatuses = new Set<FormResult>(['LOSE_HALF', 'LOSE', 'LOSE_DOUBLE']);

export function getPlayerStreakSummary(
  playerId: string,
  matches: Match[],
  settlements: Settlement[],
): PlayerStreakSummary {
  const settlementsByMatchId = new Map(
    settlements
      .filter((settlement) => settlement.playerId === playerId)
      .map((settlement) => [settlement.matchId, settlement.status as FormResult]),
  );

  const orderedResults = sortMatchesChronologically(matches)
    .map((match) => {
      const status = settlementsByMatchId.get(match.id);
      return status ? { matchId: match.id, status } : null;
    })
    .filter((result): result is { matchId: string; status: FormResult } => Boolean(result));

  let bestWinStreak = 0;
  let worstLoseStreak = 0;
  let winRun = 0;
  let loseRun = 0;

  orderedResults.forEach((result) => {
    if (result.status === 'WIN') {
      winRun += 1;
      loseRun = 0;
    } else if (losingStatuses.has(result.status)) {
      loseRun += 1;
      winRun = 0;
    }

    bestWinStreak = Math.max(bestWinStreak, winRun);
    worstLoseStreak = Math.max(worstLoseStreak, loseRun);
  });

  let currentKind: PlayerStreakSummary['currentKind'] = 'NONE';
  let currentCount = 0;
  const latest = orderedResults.at(-1);

  if (latest) {
    currentKind = latest.status === 'WIN' ? 'WIN' : 'LOSE';

    for (let index = orderedResults.length - 1; index >= 0; index -= 1) {
      const status = orderedResults[index].status;
      const kind = status === 'WIN' ? 'WIN' : 'LOSE';
      if (kind !== currentKind) break;
      currentCount += 1;
    }
  }

  return {
    currentKind,
    currentCount,
    bestWinStreak,
    worstLoseStreak,
    recentResults: orderedResults.slice(-8),
  };
}

export function getStreakBadge(summary: PlayerStreakSummary) {
  if (summary.currentKind === 'WIN' && summary.currentCount >= 3) {
    return { label: `🔥 x${summary.currentCount}`, tone: 'win' as const };
  }

  if (summary.currentKind === 'LOSE' && summary.currentCount >= 2) {
    return { label: `🍺 x${summary.currentCount}`, tone: 'lose' as const };
  }

  return null;
}

export function getFormEmoji(status: FormResult) {
  switch (status) {
    case 'WIN':
      return '✅';
    case 'LOSE_HALF':
      return '🍺½';
    case 'LOSE':
      return '🍺';
    case 'LOSE_DOUBLE':
      return '🍺🍺';
  }
}
