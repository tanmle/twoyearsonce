import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';
type PredictionChoice = 'HOME' | 'AWAY';
type SettlementStatus = 'WIN' | 'LOSE_HALF' | 'LOSE' | 'LOSE_DOUBLE';

interface WC26Team {
  id: string;
  name_en: string;
  flag: string;
}

interface WC26Game {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_label?: string;
  away_team_label?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_score: string;
  away_score: string;
  home_scorers: string | null;
  away_scorers: string | null;
  local_date: string;
  stadium_id: string;
  finished: string;
  time_elapsed: string;
  type: string;
  group?: string;
}

interface WC26Stadium {
  id: string;
  name_en: string;
  city_en: string;
  country_en: string;
}

interface MatchForSettlement {
  id: string;
  status: MatchStatus;
  homeGoals?: number;
  awayGoals?: number;
  handicap: number;
  matchType?: string;
}

interface PredictionRow {
  id: string;
  match_id: string;
  player_id: string;
  choice: PredictionChoice;
  hope_star: boolean;
}

const API_BASE_URL = 'https://worldcup26.ir/get';
const VIETNAM_TIME_ZONE = 'Asia/Bangkok';
const FALLBACK_TEAM_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0A1622"/>
  <circle cx="32" cy="32" r="22" fill="#102133" stroke="#00F06A" stroke-width="3"/>
  <path d="M32 14l5.3 10.7 11.8 1.7-8.5 8.3 2 11.7L32 40.8 21.4 46.4l2-11.7-8.5-8.3 11.8-1.7L32 14z" fill="#00F06A"/>
  <text x="32" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#ffffff">TBD</text>
</svg>`);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getStadiumTimeZone(stadium?: WC26Stadium) {
  if (!stadium) return 'UTC';

  const city = stadium.city_en.toLowerCase();
  const country = stadium.country_en.toLowerCase();

  if (city.includes('vancouver')) return 'America/Vancouver';
  if (city.includes('seattle') || city.includes('los angeles') || city.includes('san francisco')) return 'America/Los_Angeles';
  if (city.includes('toronto')) return 'America/Toronto';
  if (
    city.includes('atlanta') ||
    city.includes('miami') ||
    city.includes('boston') ||
    city.includes('philadelphia') ||
    city.includes('new york') ||
    city.includes('new jersey')
  ) return 'America/New_York';
  if (city.includes('dallas') || city.includes('houston') || city.includes('kansas city')) return 'America/Chicago';
  if (country.includes('mexico')) return 'America/Mexico_City';

  return 'UTC';
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

function parseApiDateInTimeZone(rawDate: string, timeZone: string) {
  const match = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return new Date(rawDate);

  const [, month, day, year, hour, minute] = match;
  const localAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let utcDate = new Date(localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc), timeZone));
  utcDate = new Date(localAsUtc - getTimeZoneOffsetMs(utcDate, timeZone));

  return utcDate;
}

function formatDateGmt7(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);
}

function formatTimeGmt7(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);
}

function parseScorers(raw: string | null | undefined): string[] {
  if (!raw || raw === 'null') return [];

  return raw
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .split(/","|",|,"|”,|,“|”,”/)
    .map((scorer) => scorer.replace(/^"|"$/g, '').replace(/^“|”$/g, '').trim())
    .filter(Boolean);
}

function parseGoals(raw: string | null | undefined) {
  if (!raw || raw === 'null') return null;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? null : value;
}

function settlePrediction(match: MatchForSettlement, prediction: PredictionRow): { status?: SettlementStatus; penaltyVnd: number } {
  if (
    match.status !== 'FINISHED' ||
    match.homeGoals === undefined ||
    match.awayGoals === undefined ||
    !prediction.choice
  ) {
    return { penaltyVnd: 0 };
  }

  const correctedHomeGoals = match.homeGoals + match.handicap;
  const isHomeWin = correctedHomeGoals > match.awayGoals;
  const isHandicapDraw = correctedHomeGoals === match.awayGoals;
  const isPostGroupMatch = Boolean(match.matchType && match.matchType !== 'group');
  const usesHopeStar = prediction.hope_star && isPostGroupMatch;
  const selectedTeamWins = prediction.choice === 'HOME'
    ? isHomeWin
    : !isHomeWin && !isHandicapDraw;

  if (selectedTeamWins) return { status: 'WIN', penaltyVnd: usesHopeStar ? -10000 : 0 };
  if (isHandicapDraw) return usesHopeStar
    ? { status: 'LOSE', penaltyVnd: 10000 }
    : { status: 'LOSE_HALF', penaltyVnd: 5000 };
  return usesHopeStar
    ? { status: 'LOSE_DOUBLE', penaltyVnd: 20000 }
    : { status: 'LOSE', penaltyVnd: 10000 };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const [teamsData, gamesData, stadiumsData, existingMatchesResult] = await Promise.all([
      fetchJson<{ teams?: WC26Team[] }>(`${API_BASE_URL}/teams`),
      fetchJson<{ games?: WC26Game[] }>(`${API_BASE_URL}/games`),
      fetchJson<{ stadiums?: WC26Stadium[] }>(`${API_BASE_URL}/stadiums`),
      supabase.from('matches').select('id, handicap, handicap_is_manual, odds_updated_at'),
    ]);

    if (existingMatchesResult.error) throw existingMatchesResult.error;

    const teamMap = new Map((teamsData.teams ?? []).map((team) => [team.id, team]));
    const stadiumMap = new Map((stadiumsData.stadiums ?? []).map((stadium) => [stadium.id, stadium]));
    const existingMatchesById = new Map((existingMatchesResult.data ?? []).map((match) => [match.id, match]));
    const syncedAt = new Date().toISOString();

    const matches = (gamesData.games ?? []).map((apiGame) => {
      const stadium = stadiumMap.get(apiGame.stadium_id);
      const fixtureDate = parseApiDateInTimeZone(apiGame.local_date, getStadiumTimeZone(stadium));
      const safeFixtureDate = Number.isNaN(fixtureDate.getTime()) ? new Date() : fixtureDate;
      const isFinished = apiGame.finished === 'TRUE' || apiGame.time_elapsed === 'finished';
      const isLive = !isFinished && apiGame.time_elapsed !== 'notstarted';
      const status: MatchStatus = isFinished ? 'FINISHED' : isLive ? 'LIVE' : 'UPCOMING';
      const homeTeam = teamMap.get(apiGame.home_team_id);
      const awayTeam = teamMap.get(apiGame.away_team_id);
      const matchId = `wc26_${apiGame.id}`;
      const existingMatch = existingMatchesById.get(matchId);
      const handicap = Number(existingMatch?.handicap ?? 0);

      return {
        id: matchId,
        external_id: apiGame.id,
        league: 'WORLD CUP',
        home_team: homeTeam?.name_en ?? apiGame.home_team_name_en ?? apiGame.home_team_label ?? 'TBD',
        away_team: awayTeam?.name_en ?? apiGame.away_team_name_en ?? apiGame.away_team_label ?? 'TBD',
        home_logo: homeTeam?.flag ?? FALLBACK_TEAM_LOGO,
        away_logo: awayTeam?.flag ?? FALLBACK_TEAM_LOGO,
        handicap,
        handicap_is_manual: existingMatch?.handicap_is_manual ?? false,
        display_time: status === 'FINISHED' ? 'FINISHED' : formatTimeGmt7(safeFixtureDate),
        display_date: formatDateGmt7(safeFixtureDate),
        kickoff_at: safeFixtureDate.toISOString(),
        stadium: stadium?.name_en ?? `Sân ${apiGame.id}`,
        status,
        home_goals: parseGoals(apiGame.home_score),
        away_goals: parseGoals(apiGame.away_score),
        home_scorers: parseScorers(apiGame.home_scorers),
        away_scorers: parseScorers(apiGame.away_scorers),
        live_time_text: isLive ? `TRỰC TIẾP ${apiGame.time_elapsed}'` : null,
        is_hot: status === 'LIVE' || status === 'UPCOMING',
        last_synced_at: syncedAt,
        odds_updated_at: existingMatch?.odds_updated_at ?? null,
        match_type: apiGame.type,
        match_group: apiGame.group ?? null,
      };
    });

    const { error: matchesError } = await supabase.from('matches').upsert(matches);
    if (matchesError) throw matchesError;

    const finishedMatches = matches.filter((match) => (
      match.status === 'FINISHED' && match.home_goals !== null && match.away_goals !== null
    ));

    let settlementsCount = 0;
    if (finishedMatches.length > 0) {
      const finishedMatchIds = finishedMatches.map((match) => match.id);
      const { data: predictions, error: predictionsError } = await supabase
        .from('predictions')
        .select('id, match_id, player_id, choice, hope_star')
        .in('match_id', finishedMatchIds);

      if (predictionsError) throw predictionsError;

      const finishedById = new Map(finishedMatches.map((match) => [match.id, match]));
      const settlements = (predictions ?? []).flatMap((prediction: PredictionRow) => {
        const match = finishedById.get(prediction.match_id);
        if (!match) return [];

        const settled = settlePrediction({
          id: match.id,
          status: match.status,
          homeGoals: match.home_goals ?? undefined,
          awayGoals: match.away_goals ?? undefined,
          handicap: Number(match.handicap ?? 0),
          matchType: match.match_type ?? undefined,
        }, prediction);

        if (!settled.status) return [];

        return [{
          prediction_id: prediction.id,
          match_id: prediction.match_id,
          player_id: prediction.player_id,
          status: settled.status,
          penalty_vnd: settled.penaltyVnd,
          settled_at: syncedAt,
        }];
      });

      if (settlements.length > 0) {
        const { error: settlementsError } = await supabase
          .from('settlements')
          .upsert(settlements, { onConflict: 'prediction_id' });
        if (settlementsError) throw settlementsError;
        settlementsCount = settlements.length;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      matches: matches.length,
      finishedMatches: finishedMatches.length,
      settlements: settlementsCount,
      syncedAt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
