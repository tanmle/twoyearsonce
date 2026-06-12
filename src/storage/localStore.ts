import { ActivityFeedItem, Match, Player, Prediction } from '../types';

export const LOCAL_STORAGE_KEYS = {
  players: 'beer_cup_players',
  currentPlayerId: 'beer_cup_current_player_id',
  matches: 'beer_cup_matches',
  predictions: 'beer_cup_predictions',
  activities: 'beer_cup_activities',
} as const;

export function loadJson<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) as T : fallback;
}

export function saveJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function clearBeerCupLocalState() {
  Object.values(LOCAL_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

export interface BeerCupLocalState {
  players: Player[];
  currentPlayerId: string;
  matches: Match[];
  predictions: Prediction[];
  activities: ActivityFeedItem[];
}
