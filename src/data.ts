import { ActivityFeedItem, Match, Player, Prediction } from './types';

// BeerCup uses Supabase + live World Cup sync for real data.
// These arrays are intentionally empty to avoid booting fake players, matches, predictions, or activity.
export const INITIAL_PLAYERS: Player[] = [];
export const INITIAL_MATCHES: Match[] = [];
export const INITIAL_PREDICTIONS: Prediction[] = [];
export const INITIAL_FEED: ActivityFeedItem[] = [];
