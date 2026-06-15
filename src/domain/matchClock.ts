import { Match } from '../types';

export function formatLiveMatchClock(match: Match) {
  if (match.status !== 'LIVE') return null;
  return match.liveTimeText || 'TRỰC TIẾP';
}

export function formatMatchLastSyncedAt(match: Match) {
  if (!match.lastSyncedAt) return null;

  const syncedAt = new Date(match.lastSyncedAt);
  if (Number.isNaN(syncedAt.getTime())) return null;

  return syncedAt.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatLiveMatchTimestamp(match: Match) {
  const liveClock = formatLiveMatchClock(match);
  if (!liveClock) return null;

  const syncedAt = formatMatchLastSyncedAt(match);
  return liveClock;
}
