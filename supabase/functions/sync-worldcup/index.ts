import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';
type PredictionChoice = 'HOME' | 'AWAY';
type SettlementStatus = 'WIN' | 'LOSE_HALF' | 'LOSE' | 'LOSE_DOUBLE';

interface FifaRound {
  id: number;
  status: string;
  startDate: string;
  endDate: string;
  tournaments?: FifaTournament[];
}

interface FifaTournament {
  id: number;
  period: string;
  minutes: number;
  extraMinutes: number;
  venueName: string;
  venueCity: string;
  date: string;
  status: string;
  isSuspended: boolean;
  homeSquadId: number;
  awaySquadId: number;
  homeSquadName: string;
  awaySquadName: string;
  homeSquadAbbr: string;
  awaySquadAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  homeGoalScorersAssists: Array<{ playerId: number; assistId: number | null }> | null;
  awayGoalScorersAssists: Array<{ playerId: number; assistId: number | null }> | null;
}

interface FifaPlayer {
  id: number;
  firstName: string | null;
  lastName: string | null;
  knownName: string | null;
}

interface FifaSquad {
  id: number;
  name: string;
  group: string | null;
  abbr: string;
  isEliminated: boolean;
}

interface TeamFlag {
  name_en: string;
  flag: string;
  fifa_code: string;
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

const FIFA_ROUNDS_URL = 'https://play.fifa.com/json/fantasy/rounds.json';
const FIFA_PLAYERS_URL = 'https://play.fifa.com/json/fantasy/players.json';
const FIFA_SQUADS_URL = 'https://play.fifa.com/json/fantasy/squads.json';
const TEAM_FLAGS_URL = 'https://worldcup26.ir/get/teams';
const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/';
const VIETNAM_TIME_ZONE = 'Asia/Bangkok';
const HANDICAP_SYNC_WINDOW_MINUTES_MIN = 45;
const HANDICAP_SYNC_WINDOW_MINUTES_MAX = 70;

const TEAM_ALIASES: Record<string, string> = {
  bosniaandherzegovina: 'bosniaherzegovina',
  capeverde: 'caboverde',
  czechrepublic: 'czechia',
  democraticrepublicofthecongo: 'congodr',
  drcongo: 'congodr',
  iran: 'iriran',
  ivorycoast: 'cotedivoire',
  southkorea: 'korearepublic',
  turkey: 'turkiye',
  unitedstates: 'usa',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function normalizeName(name: string) {
  const clean = name.toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[clean] || clean;
}

function teamBadge(abbr: string | undefined, name: string) {
  const label = (abbr || name.slice(0, 3) || 'TBD').toUpperCase().replace(/[<&>]/g, '');
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0A1622"/>
  <circle cx="32" cy="28" r="21" fill="#102133" stroke="#00F06A" stroke-width="3"/>
  <text x="32" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#00F06A">${label}</text>
  <text x="32" y="57" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#ffffff">FIFA</text>
</svg>`);
}

function buildTeamLogoMap(teams: TeamFlag[]) {
  const logoMap = new Map<string, string>();

  teams.forEach((team) => {
    if (!team.flag) return;
    logoMap.set(normalizeName(team.name_en), team.flag);
    logoMap.set(team.fifa_code.toUpperCase(), team.flag);
  });

  return logoMap;
}

function getTeamLogo(name: string, abbr: string | undefined, logoMap: Map<string, string>) {
  return (abbr ? logoMap.get(abbr.toUpperCase()) : undefined)
    ?? logoMap.get(normalizeName(name))
    ?? teamBadge(abbr, name);
}

function formatPlayerName(player: FifaPlayer) {
  return player.knownName || [player.firstName, player.lastName].filter(Boolean).join(' ') || `#${player.id}`;
}

function buildPlayerNameMap(players: FifaPlayer[]) {
  return new Map(players.map((player) => [player.id, formatPlayerName(player)]));
}

function parseGoalScorers(raw: FifaTournament['homeGoalScorersAssists'], playerNames: Map<number, string>) {
  return (raw ?? []).map((goal) => playerNames.get(goal.playerId) ?? `#${goal.playerId}`);
}

function getRoundMatchType(roundId: number) {
  if (roundId <= 3) return 'group';
  if (roundId === 4) return 'round_of_32';
  if (roundId === 5) return 'round16';
  if (roundId === 6) return 'quarterfinal';
  if (roundId === 7) return 'semifinal';
  if (roundId === 8) return 'final';
  return `round_${roundId}`;
}

function buildSquadGroupMap(squads: FifaSquad[]) {
  return new Map(squads.map((squad) => [squad.id, squad.group?.toUpperCase()]));
}

function getMatchGroup(roundId: number, game: FifaTournament, squadGroups: Map<number, string | undefined>) {
  if (roundId > 3) return null;

  const homeGroup = squadGroups.get(game.homeSquadId);
  const awayGroup = squadGroups.get(game.awaySquadId);

  if (homeGroup && awayGroup && homeGroup !== awayGroup) return `${homeGroup}/${awayGroup}`;
  return homeGroup ?? awayGroup ?? null;
}

function mapFifaStatus(game: FifaTournament): MatchStatus {
  if (game.status === 'complete' || game.period === 'full_time') return 'FINISHED';
  if (game.status === 'playing' || !['scheduled', 'pre_match'].includes(game.period)) return 'LIVE';
  return 'UPCOMING';
}

function formatLiveTime(game: FifaTournament) {
  if (game.period === 'half_time') return 'NGHỈ GIỮA HIỆP';
  const minutes = Number(game.minutes ?? 0);
  const extra = Number(game.extraMinutes ?? 0);
  const clock = minutes > 0 ? `${minutes}${extra > 0 ? `+${extra}` : ''}'` : 'TRỰC TIẾP';
  return `TRỰC TIẾP ${clock}`;
}

function isInHandicapSyncWindow(kickoffAt: string, now: Date) {
  const kickoffTime = new Date(kickoffAt).getTime();
  if (Number.isNaN(kickoffTime)) return false;

  const minutesUntilKickoff = (kickoffTime - now.getTime()) / 60000;
  return minutesUntilKickoff >= HANDICAP_SYNC_WINDOW_MINUTES_MIN && minutesUntilKickoff <= HANDICAP_SYNC_WINDOW_MINUTES_MAX;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.json();
}

async function fetchOddsHandicapMap(oddsApiKey: string) {
  const oddsUrl = `${ODDS_API_URL}?apiKey=${oddsApiKey}&regions=eu,us&markets=spreads`;
  const oddsData = await fetchJson<any[]>(oddsUrl);
  const oddsMap = new Map<string, number>();

  if (!Array.isArray(oddsData)) return oddsMap;

  oddsData.forEach((event) => {
    const bookmaker = event.bookmakers?.[0];
    const spreadsMarket = bookmaker?.markets?.find((market: any) => market.key === 'spreads');
    const homeOutcome = spreadsMarket?.outcomes?.find((outcome: any) => (
      normalizeName(outcome.name) === normalizeName(event.home_team)
    ));

    if (!homeOutcome || typeof homeOutcome.point !== 'number') return;

    const homeKey = normalizeName(event.home_team);
    const awayKey = normalizeName(event.away_team);
    oddsMap.set(`${homeKey}_${awayKey}`, homeOutcome.point);
    oddsMap.set(`${awayKey}_${homeKey}`, -homeOutcome.point);
  });

  return oddsMap;
}

const EPSILON = 0.0001;

function isEqual(value: number, target: number) {
  return Math.abs(value - target) < EPSILON;
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

  const homeMargin = match.homeGoals + match.handicap - match.awayGoals;
  const selectedMargin = prediction.choice === 'HOME' ? homeMargin : -homeMargin;
  const isPostGroupMatch = Boolean(match.matchType && match.matchType !== 'group');
  const usesHopeStar = prediction.hope_star && isPostGroupMatch;

  if (selectedMargin > EPSILON) return { status: 'WIN', penaltyVnd: usesHopeStar ? -10000 : 0 };
  if (isEqual(selectedMargin, 0)) return { status: 'WIN', penaltyVnd: 0 };
  if (isEqual(selectedMargin, -0.25)) return usesHopeStar
    ? { status: 'LOSE', penaltyVnd: 10000 }
    : { status: 'LOSE_HALF', penaltyVnd: 5000 };
  return usesHopeStar
    ? { status: 'LOSE_DOUBLE', penaltyVnd: 20000 }
    : { status: 'LOSE', penaltyVnd: 10000 };
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

    const [roundsData, playersData, squadsData, teamFlagsData, existingMatchesResult] = await Promise.all([
      fetchJson<FifaRound[]>(FIFA_ROUNDS_URL),
      fetchJson<FifaPlayer[]>(FIFA_PLAYERS_URL),
      fetchJson<FifaSquad[]>(FIFA_SQUADS_URL),
      fetchJson<{ teams?: TeamFlag[] }>(TEAM_FLAGS_URL).catch(() => ({ teams: [] })),
      supabase.from('matches').select('id, handicap, handicap_is_manual, odds_updated_at, handicap_synced_at, handicap_sync_attempted_at'),
    ]);

    if (existingMatchesResult.error) throw existingMatchesResult.error;

    const playerNames = buildPlayerNameMap(playersData ?? []);
    const squadGroups = buildSquadGroupMap(squadsData ?? []);
    const teamLogos = buildTeamLogoMap(teamFlagsData.teams ?? []);
    const existingMatchesById = new Map((existingMatchesResult.data ?? []).map((match) => [match.id, match]));
    const syncedAt = new Date().toISOString();

    const matches = (roundsData ?? []).flatMap((round) => (round.tournaments ?? []).map((game) => {
      const fixtureDate = new Date(game.date);
      const safeFixtureDate = Number.isNaN(fixtureDate.getTime()) ? new Date() : fixtureDate;
      const status = mapFifaStatus(game);
      const matchId = `wc26_${game.id}`;
      const existingMatch = existingMatchesById.get(matchId);
      const handicap = Number(existingMatch?.handicap ?? 0);
      const homeTeam = game.homeSquadName || 'TBD';
      const awayTeam = game.awaySquadName || 'TBD';

      return {
        id: matchId,
        external_id: String(game.id),
        competition_id: 'worldcup-2026',
        league: 'WORLD CUP',
        home_team: homeTeam,
        away_team: awayTeam,
        home_logo: getTeamLogo(homeTeam, game.homeSquadAbbr, teamLogos),
        away_logo: getTeamLogo(awayTeam, game.awaySquadAbbr, teamLogos),
        handicap,
        handicap_is_manual: existingMatch?.handicap_is_manual ?? false,
        display_time: status === 'FINISHED' ? 'FINISHED' : formatTimeGmt7(safeFixtureDate),
        display_date: formatDateGmt7(safeFixtureDate),
        kickoff_at: safeFixtureDate.toISOString(),
        stadium: [game.venueName, game.venueCity].filter(Boolean).join(' • ') || `Sân ${game.id}`,
        status,
        home_goals: game.homeScore,
        away_goals: game.awayScore,
        home_scorers: parseGoalScorers(game.homeGoalScorersAssists, playerNames),
        away_scorers: parseGoalScorers(game.awayGoalScorersAssists, playerNames),
        live_time_text: status === 'LIVE' ? formatLiveTime(game) : null,
        is_hot: status === 'LIVE' || status === 'UPCOMING',
        last_synced_at: syncedAt,
        odds_updated_at: existingMatch?.odds_updated_at ?? null,
        handicap_synced_at: existingMatch?.handicap_synced_at ?? null,
        handicap_sync_attempted_at: existingMatch?.handicap_sync_attempted_at ?? null,
        match_type: getRoundMatchType(round.id),
        match_group: getMatchGroup(round.id, game, squadGroups),
      };
    }));

    const { error: matchesError } = await supabase.from('matches').upsert(matches);
    if (matchesError) throw matchesError;

    const oddsApiKey = Deno.env.get('ODDS_API_KEY');
    const now = new Date();
    const handicapEligibleMatches = matches.filter((match) => (
      match.status === 'UPCOMING' &&
      !match.handicap_is_manual &&
      !match.handicap_synced_at &&
      !match.handicap_sync_attempted_at &&
      isInHandicapSyncWindow(match.kickoff_at, now)
    ));

    let oddsApiCalled = false;
    let handicapsUpdated = 0;
    if (oddsApiKey && handicapEligibleMatches.length > 0) {
      oddsApiCalled = true;
      const oddsMap = await fetchOddsHandicapMap(oddsApiKey);
      const handicapUpdates = handicapEligibleMatches.map((match) => {
        const matchKey = `${normalizeName(match.home_team)}_${normalizeName(match.away_team)}`;
        const handicap = oddsMap.get(matchKey);

        return {
          id: match.id,
          handicap: handicap ?? match.handicap,
          handicap_is_manual: false,
          odds_updated_at: handicap === undefined ? match.odds_updated_at : syncedAt,
          handicap_synced_at: handicap === undefined ? match.handicap_synced_at : syncedAt,
          handicap_sync_attempted_at: syncedAt,
        };
      });

      const { error: handicapError } = await supabase.from('matches').upsert(handicapUpdates);
      if (handicapError) throw handicapError;

      handicapsUpdated = handicapUpdates.filter((update) => update.handicap_synced_at === syncedAt).length;
    }

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
          competition_id: 'worldcup-2026',
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

    const liveMatchesCount = matches.filter((match) => match.status === 'LIVE').length;
    const { error: activityError } = await supabase.from('activities').insert({
      player_name: 'Hệ thống',
      action_text: 'đã đồng bộ dữ liệu trận đấu từ FIFA rounds.json',
      target_text: `${matches.length} trận • ${liveMatchesCount} live • ${finishedMatches.length} đã xong`,
      type: 'join_prediction',
      competition_id: 'worldcup-2026',
      created_at: syncedAt,
    });
    if (activityError) console.warn('Failed to insert sync activity', activityError);

    return new Response(JSON.stringify({
      ok: true,
      source: FIFA_ROUNDS_URL,
      matches: matches.length,
      finishedMatches: finishedMatches.length,
      settlements: settlementsCount,
      handicapEligibleMatches: handicapEligibleMatches.length,
      oddsApiCalled,
      handicapsUpdated,
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
