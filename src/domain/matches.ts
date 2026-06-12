import { Match } from '../types';

const STATUS_ORDER: Record<Match['status'], number> = {
  LIVE: 0,
  UPCOMING: 1,
  FINISHED: 2,
};

function matchTimeValue(match: Match) {
  if (match.kickoffAt) {
    const value = new Date(match.kickoffAt).getTime();
    if (!Number.isNaN(value)) return value;
  }

  const fallback = new Date(`${match.date} ${match.time === 'FINISHED' ? '00:00' : match.time}`).getTime();
  return Number.isNaN(fallback) ? Number.MAX_SAFE_INTEGER : fallback;
}

export function sortMatchesForFixtures(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    const timeDiff = matchTimeValue(a) - matchTimeValue(b);
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id);
  });
}

export function sortMatchesChronologically(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const timeDiff = matchTimeValue(a) - matchTimeValue(b);
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });
}
