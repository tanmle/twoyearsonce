import { ActivityFeedItem, League, Match, Player, Prediction, Settlement } from '../types';
import { supabase } from '../lib/supabase';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return supabase;
}

export async function invokeWorldCupSync() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('sync-worldcup', {
    method: 'POST',
  });

  if (error) throw error;
  return data;
}

export async function fetchPlayersFromSupabase(): Promise<Player[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('players').select('*').order('name');
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    totalPredictionsCount: 0,
    notLoseCount: 0,
    loseHalfCount: 0,
    loseCount: 0,
    loseDoubleCount: 0,
    totalPenaltyVnd: 0,
    role: row.role ?? 'player',
  }));
}

export async function fetchMatchesFromSupabase(): Promise<Match[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('matches')
    .select('*')
    .order('kickoff_at', { ascending: true, nullsFirst: false })
    .order('display_date', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    externalId: row.external_id ?? undefined,
    league: row.league as League,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeLogo: row.home_logo,
    awayLogo: row.away_logo,
    handicap: Number(row.handicap ?? 0),
    handicapIsManual: row.handicap_is_manual ?? false,
    time: row.display_time,
    date: row.display_date,
    kickoffAt: row.kickoff_at ?? undefined,
    stadium: row.stadium,
    status: row.status,
    homeGoals: row.home_goals ?? undefined,
    awayGoals: row.away_goals ?? undefined,
    homeScorers: row.home_scorers ?? [],
    awayScorers: row.away_scorers ?? [],
    liveTimeText: row.live_time_text ?? undefined,
    isHot: row.is_hot ?? false,
    lastSyncedAt: row.last_synced_at ?? undefined,
    oddsUpdatedAt: row.odds_updated_at ?? undefined,
    matchType: row.match_type ?? undefined,
    matchGroup: row.match_group ?? undefined,
  }));
}

export async function fetchPredictionsFromSupabase(): Promise<Prediction[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('predictions').select('*');
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    choice: row.choice,
    timestamp: row.updated_at ? new Date(row.updated_at).toLocaleString('vi-VN') : 'Đã đồng bộ',
    hopeStar: row.hope_star ?? false,
  }));
}

export async function fetchSettlementsFromSupabase(): Promise<Settlement[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('settlements').select('*');
  if (error) throw error;

  return (data ?? []).map((row) => ({
    predictionId: row.prediction_id,
    matchId: row.match_id,
    playerId: row.player_id,
    status: row.status,
    penaltyVnd: row.penalty_vnd ?? 0,
  }));
}

export async function fetchActivitiesFromSupabase(): Promise<ActivityFeedItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    playerName: row.player_name,
    actionText: row.action_text,
    targetText: row.target_text ?? undefined,
    type: row.type,
    statusType: row.status_type ?? undefined,
    timeAgo: row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : 'Đã đồng bộ',
  }));
}

export async function insertPlayerToSupabase(player: Player) {
  const client = requireSupabase();
  const { error } = await client.from('players').insert({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    role: player.role ?? 'player',
  });

  if (error) throw error;
}

export async function upsertMatchesToSupabase(matches: Match[]) {
  const client = requireSupabase();
  const { error } = await client.from('matches').upsert(matches.map((match) => ({
    id: match.id,
    external_id: match.externalId,
    league: match.league,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    home_logo: match.homeLogo,
    away_logo: match.awayLogo,
    handicap: match.handicap,
    handicap_is_manual: match.handicapIsManual ?? false,
    display_time: match.time,
    display_date: match.date,
    kickoff_at: match.kickoffAt,
    stadium: match.stadium,
    status: match.status,
    home_goals: match.homeGoals,
    away_goals: match.awayGoals,
    home_scorers: match.homeScorers ?? [],
    away_scorers: match.awayScorers ?? [],
    live_time_text: match.liveTimeText,
    is_hot: match.isHot ?? false,
    last_synced_at: match.lastSyncedAt,
    odds_updated_at: match.oddsUpdatedAt,
    match_type: match.matchType,
    match_group: match.matchGroup,
  })));

  if (error) throw error;
}

export async function upsertPredictionToSupabase(prediction: Prediction) {
  const client = requireSupabase();
  const { error } = await client.from('predictions').upsert({
    match_id: prediction.matchId,
    player_id: prediction.playerId,
    choice: prediction.choice,
    hope_star: prediction.hopeStar ?? false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'match_id,player_id' });

  if (error) throw error;
}

export async function upsertSettlementsToSupabase(settlements: Settlement[]) {
  if (settlements.length === 0) return;

  const client = requireSupabase();
  const { error } = await client.from('settlements').upsert(settlements.map((settlement) => ({
    prediction_id: settlement.predictionId,
    match_id: settlement.matchId,
    player_id: settlement.playerId,
    status: settlement.status,
    penalty_vnd: settlement.penaltyVnd,
    settled_at: new Date().toISOString(),
  })), { onConflict: 'prediction_id' });

  if (error) throw error;
}

export async function insertActivityToSupabase(activity: ActivityFeedItem, playerId?: string) {
  const client = requireSupabase();
  const { error } = await client.from('activities').insert({
    player_id: playerId,
    player_name: activity.playerName,
    action_text: activity.actionText,
    target_text: activity.targetText,
    type: activity.type,
    status_type: activity.statusType,
  });

  if (error) throw error;
}
