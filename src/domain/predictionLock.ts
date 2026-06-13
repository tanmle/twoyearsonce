import { Match } from '../types';

export function isPredictionLocked(match: Match, now = new Date()) {
  if (match.status === 'FINISHED' || match.status === 'LIVE') return true;
  if (!match.kickoffAt) return false;

  const kickoffTime = new Date(match.kickoffAt).getTime();
  if (Number.isNaN(kickoffTime)) return false;

  const lockTime = kickoffTime - 60 * 60 * 1000;
  return now.getTime() >= lockTime;
}
