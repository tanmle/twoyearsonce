/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string; // e.g. 'huy', 'alex', 'anhquoc', 'minhhoang', 'vanthanh', 'trunghieu', 'tunglam', 'tiendung', 'minhphuong', 'quynh'
  name: string;
  avatar: string;
  totalPredictionsCount: number;
  notLoseCount: number;
  loseHalfCount: number;
  loseCount: number;
  loseDoubleCount: number;
  totalPenaltyVnd: number; // Penalty aggregate in VND
  role?: 'player' | 'admin';
  isCurrentUser?: boolean; 
}

export type League = 'PREMIER LEAGUE' | 'LA LIGA' | 'CHAMPIONS LEAGUE' | 'SERIE A' | 'WORLD CUP';

export interface Match {
  id: string;
  league: League;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  handicap: number; // e.g. -0.5, -0.75, 0.0, 0.5
  time: string; // e.g. "22:00", "01:45"
  date: string; // e.g. "20 Oct, 2024"
  kickoffAt?: string; // ISO timestamp for reliable sorting
  stadium: string; // e.g. "Anfield", "Old Trafford"
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  homeGoals?: number;
  awayGoals?: number;
  liveTimeText?: string; // e.g. "LIVE 67'", "LIVE IN 2H 45M"
  isHot?: boolean;
  externalId?: string;
  lastSyncedAt?: string;
  oddsUpdatedAt?: string;
}

export type PredictionChoice = 'HOME' | 'AWAY' | null;

export interface Prediction {
  matchId: string;
  playerId: string;
  choice: PredictionChoice;
  timestamp: string; // e.g. "2 mins ago"
}

export type PenaltyStatus = 'WIN' | 'LOSE_HALF' | 'LOSE' | 'LOSE_DOUBLE' | 'SETTLE_PENDING';

export interface Settlement {
  matchId: string;
  playerId: string;
  status: Exclude<PenaltyStatus, 'SETTLE_PENDING'>;
  penaltyVnd: number;
}

export interface ActivityFeedItem {
  id: string;
  playerName: string;
  actionText: string;
  type: 'change_prediction' | 'penalty' | 'join_prediction';
  targetText?: string;
  timeAgo: string;
  statusType?: 'LOSE_DOUBLE' | 'LOSE_HALF' | 'LOSE' | 'WIN';
}
