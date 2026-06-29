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

interface GoalEvent {
  playerId?: string;
  playerName: string;
  minute?: number;
  stoppageMinute?: number;
  label?: string;
  type?: 'goal' | 'penalty' | 'own_goal';
}

interface MatchDetailsInfo {
  fifaMatchCentreUrl?: string;
  fifaMatchId?: string;
  tournamentName?: string;
  seasonName?: string;
  stageName?: string;
  groupName?: string;
  matchNumber?: number;
  venueName?: string;
  venueCity?: string;
  attendance?: number;
  referee?: string;
  lastDetailSyncedAt?: string;
}

interface FifaLocalizedText {
  Locale: string;
  Description: string;
}

interface FifaCalendarMatch {
  IdCompetition: string;
  IdSeason: string;
  IdStage: string;
  IdGroup?: string;
  IdMatch: string;
  MatchNumber?: number;
  Home?: { TeamName?: FifaLocalizedText[] };
  Away?: { TeamName?: FifaLocalizedText[] };
}

interface FifaLiveGoal {
  Type?: number;
  IdPlayer?: string;
  Minute?: string;
}

interface FifaLivePlayer {
  IdPlayer: string;
  PlayerName?: FifaLocalizedText[];
  ShortName?: FifaLocalizedText[];
}

interface FifaLiveTeam {
  Goals?: FifaLiveGoal[];
  Players?: FifaLivePlayer[];
}

interface FifaLiveMatch {
  IdCompetition: string;
  IdSeason: string;
  IdStage: string;
  IdGroup?: string;
  IdMatch: string;
  CompetitionName?: FifaLocalizedText[];
  SeasonName?: FifaLocalizedText[];
  StageName?: FifaLocalizedText[];
  GroupName?: FifaLocalizedText[];
  Stadium?: { Name?: FifaLocalizedText[]; CityName?: FifaLocalizedText[] };
  Attendance?: string | number | null;
  Officials?: Array<{ Name?: FifaLocalizedText[]; NameShort?: FifaLocalizedText[]; OfficialType?: number; TypeLocalized?: FifaLocalizedText[] }>;
  MatchNumber?: number;
  HomeTeam?: FifaLiveTeam;
  AwayTeam?: FifaLiveTeam;
}

interface MatchDetailPayload {
  homeGoalEvents: GoalEvent[];
  awayGoalEvents: GoalEvent[];
  details: MatchDetailsInfo;
}

interface MatchForSettlement {
  id: string;
  status: MatchStatus;
  homeGoals?: number;
  awayGoals?: number;
  homeGoalEvents?: GoalEvent[];
  awayGoalEvents?: GoalEvent[];
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
const FIFA_CALENDAR_URL = 'https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idCompetition=17&idSeason=285023';
const FIFA_LIVE_MATCH_URL_PREFIX = 'https://api.fifa.com/api/v3/live/football';
const FIFA_MATCH_CENTRE_URL_PREFIX = 'https://www.fifa.com/en/match-centre/match';
const TEAM_FLAGS_BUCKET = 'team-flags';
const TEAM_FLAGS_PATH_PREFIX = 'worldcup-2026';
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

function buildMatchKey(homeName: string, awayName: string) {
  return `${normalizeName(homeName)}_${normalizeName(awayName)}`;
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

function getFlagFileExtension(flagUrl: string) {
  try {
    const pathname = new URL(flagUrl).pathname.toLowerCase();
    const extension = pathname.split('.').pop();
    if (extension && ['svg', 'png', 'jpg', 'jpeg', 'webp'].includes(extension)) return extension;
  } catch {
    // Fall through to the default extension.
  }

  return 'svg';
}

function getFlagContentType(extension: string) {
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  return 'image/svg+xml';
}

function getStoredFlagPublicUrl(supabase: any, path: string) {
  return supabase.storage.from(TEAM_FLAGS_BUCKET).getPublicUrl(path).data.publicUrl as string;
}

async function listCachedTeamFlags(supabase: any) {
  const cachedFlags = new Map<string, string>();

  try {
    const { data: files, error } = await supabase.storage
      .from(TEAM_FLAGS_BUCKET)
      .list(TEAM_FLAGS_PATH_PREFIX, { limit: 1000 });

    if (error) throw error;

    (files ?? []).forEach((file: { name: string }) => {
      const code = file.name.split('.')[0]?.toUpperCase();
      if (!code) return;
      cachedFlags.set(code, getStoredFlagPublicUrl(supabase, `${TEAM_FLAGS_PATH_PREFIX}/${file.name}`));
    });
  } catch (error) {
    console.warn('Failed to list cached team flags:', error);
  }

  return cachedFlags;
}

async function ensureTeamFlagsBucket(supabase: any) {
  const { data: bucket } = await supabase.storage.getBucket(TEAM_FLAGS_BUCKET);
  if (bucket) return;

  const { error } = await supabase.storage.createBucket(TEAM_FLAGS_BUCKET, {
    public: true,
    fileSizeLimit: 1048576,
    allowedMimeTypes: ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'],
  });

  if (error && !String(error.message ?? error).toLowerCase().includes('already exists')) {
    throw error;
  }
}

async function cacheTeamFlag(supabase: any, team: TeamFlag, cachedFlags: Map<string, string>): Promise<TeamFlag> {
  if (!team.flag || team.flag.startsWith('data:')) return team;

  const normalizedCode = (team.fifa_code || normalizeName(team.name_en)).toUpperCase();
  if (!normalizedCode) return team;

  const cachedFlag = cachedFlags.get(normalizedCode);
  if (cachedFlag) return { ...team, flag: cachedFlag };

  const extension = getFlagFileExtension(team.flag);
  const fileName = `${normalizedCode.toLowerCase()}.${extension}`;
  const path = `${TEAM_FLAGS_PATH_PREFIX}/${fileName}`;
  const publicUrl = getStoredFlagPublicUrl(supabase, path);

  try {
    const response = await fetch(team.flag);
    if (!response.ok) throw new Error(`Flag fetch failed ${response.status}: ${team.flag}`);

    const body = await response.arrayBuffer();
    const contentType = getFlagContentType(extension);
    const { error: uploadError } = await supabase.storage
      .from(TEAM_FLAGS_BUCKET)
      .upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });

    if (uploadError) throw uploadError;
    cachedFlags.set(normalizedCode, publicUrl);
    return { ...team, flag: publicUrl };
  } catch (error) {
    console.warn(`Failed to cache flag for ${team.name_en}:`, error);
    return team;
  }
}

async function cacheTeamFlags(supabase: any, teams: TeamFlag[], cachedFlags: Map<string, string>) {
  await ensureTeamFlagsBucket(supabase);
  return Promise.all(teams.map((team) => cacheTeamFlag(supabase, team, cachedFlags)));
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

function parseGoalScorers(raw: FifaTournament['homeGoalScorersAssists'], playerNames: Map<number, string>, teamScore: number | null | undefined) {
  // The fantasy feed sometimes lists a scorer on a 0-0 fixture (contradictory source data);
  // trust the score and drop scorers when the team did not score.
  if (!teamScore) return [];
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
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.json();
}

async function fetchFifaApiJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) throw new Error(`FIFA detail fetch failed ${response.status}: ${url}`);
  return response.json();
}

function localizedText(value: FifaLocalizedText[] | undefined) {
  return value?.find((item) => item.Locale === 'en-GB')?.Description
    ?? value?.[0]?.Description;
}

function parseGoalMinute(label: string | undefined) {
  if (!label) return {};

  const [minutePart, stoppagePart] = label.replace(/'/g, '').split('+');
  const minute = Number(minutePart);
  const stoppageMinute = stoppagePart === undefined ? undefined : Number(stoppagePart);

  return {
    minute: Number.isFinite(minute) ? minute : undefined,
    stoppageMinute: Number.isFinite(stoppageMinute) ? stoppageMinute : undefined,
  };
}

function mapGoalType(type: number | undefined): GoalEvent['type'] {
  if (type === 1) return 'penalty';
  if (type === 3) return 'own_goal';
  return 'goal';
}

function buildPlayerMap(team: FifaLiveTeam | undefined) {
  return new Map((team?.Players ?? []).map((player) => [
    player.IdPlayer,
    localizedText(player.ShortName) ?? localizedText(player.PlayerName) ?? `#${player.IdPlayer}`,
  ]));
}

function mapGoalEvents(team: FifaLiveTeam | undefined) {
  const playerNames = buildPlayerMap(team);

  return (team?.Goals ?? []).map((goal) => ({
    playerId: goal.IdPlayer,
    playerName: goal.IdPlayer ? playerNames.get(goal.IdPlayer) ?? `#${goal.IdPlayer}` : 'Unknown scorer',
    label: goal.Minute,
    ...parseGoalMinute(goal.Minute),
    type: mapGoalType(goal.Type),
  }));
}

function findReferee(officials: FifaLiveMatch['Officials']) {
  const referee = officials?.find((official) => (
    official.OfficialType === 1 || localizedText(official.TypeLocalized)?.toLowerCase() === 'referee'
  ));

  return localizedText(referee?.Name) ?? localizedText(referee?.NameShort);
}

function buildFifaMatchCentreUrl(match: FifaLiveMatch | FifaCalendarMatch) {
  return `${FIFA_MATCH_CENTRE_URL_PREFIX}/${match.IdCompetition}/${match.IdSeason}/${match.IdStage}/${match.IdMatch}`;
}

function mapMatchDetails(detail: FifaLiveMatch, syncedAt: string): MatchDetailPayload {
  return {
    homeGoalEvents: mapGoalEvents(detail.HomeTeam),
    awayGoalEvents: mapGoalEvents(detail.AwayTeam),
    details: {
      fifaMatchCentreUrl: buildFifaMatchCentreUrl(detail),
      fifaMatchId: detail.IdMatch,
      tournamentName: localizedText(detail.CompetitionName),
      seasonName: localizedText(detail.SeasonName),
      stageName: localizedText(detail.StageName),
      groupName: localizedText(detail.GroupName),
      matchNumber: detail.MatchNumber,
      venueName: localizedText(detail.Stadium?.Name),
      venueCity: localizedText(detail.Stadium?.CityName),
      attendance: detail.Attendance === null || detail.Attendance === undefined ? undefined : Number(detail.Attendance),
      referee: findReferee(detail.Officials),
      lastDetailSyncedAt: syncedAt,
    },
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = [];
  let nextIndex = 0;

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }));

  return results;
}

function buildCalendarMatchKey(match: FifaCalendarMatch) {
  const home = localizedText(match.Home?.TeamName);
  const away = localizedText(match.Away?.TeamName);
  if (!home || !away) return undefined;
  return buildMatchKey(home, away);
}

async function fetchMatchDetailsByMatchKey(syncedAt: string, targetMatchKeys: Set<string>) {
  const detailsByMatchKey = new Map<string, MatchDetailPayload>();
  if (targetMatchKeys.size === 0) return detailsByMatchKey;

  try {
    const calendarData = await fetchFifaApiJson<{ Results?: FifaCalendarMatch[] }>(FIFA_CALENDAR_URL);
    const calendarMatches = (calendarData.Results ?? [])
      .map((match) => ({ match, key: buildCalendarMatchKey(match) }))
      .filter((entry): entry is { match: FifaCalendarMatch; key: string } => (
        entry.key !== undefined && targetMatchKeys.has(entry.key)
      ));

    await mapWithConcurrency(calendarMatches, 4, async ({ match: calendarMatch, key }) => {
      try {
        const detailUrl = `${FIFA_LIVE_MATCH_URL_PREFIX}/${calendarMatch.IdCompetition}/${calendarMatch.IdSeason}/${calendarMatch.IdStage}/${calendarMatch.IdMatch}?language=en`;
        const detail = await fetchFifaApiJson<FifaLiveMatch>(detailUrl);
        detailsByMatchKey.set(key, mapMatchDetails(detail, syncedAt));
      } catch (error) {
        detailsByMatchKey.set(key, {
          homeGoalEvents: [],
          awayGoalEvents: [],
          details: {
            fifaMatchCentreUrl: buildFifaMatchCentreUrl(calendarMatch),
            fifaMatchId: calendarMatch.IdMatch,
            matchNumber: calendarMatch.MatchNumber,
            lastDetailSyncedAt: syncedAt,
          },
        });
        console.warn(`Failed to fetch FIFA details for match ${calendarMatch.IdMatch}:`, error);
      }
    });
  } catch (error) {
    console.warn('Failed to fetch FIFA match detail index:', error);
  }

  return detailsByMatchKey;
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
// Goals after the 90th minute (extra time) are excluded from settlement; second-half
// stoppage time is reported as minute 90 ("90+x'") and therefore stays in.
const REGULAR_TIME_LAST_MINUTE = 90;

function isEqual(value: number, target: number) {
  return Math.abs(value - target) < EPSILON;
}

// Regular-time (90') goal count from goal events, or null when events are missing/partial.
// The FIFA score includes extra-time goals, so settling on it would be wrong for knockouts.
function regularTimeGoals(events: GoalEvent[] | undefined, finalGoals: number): number | null {
  const list = events ?? [];
  if (list.length !== finalGoals) return null;
  if (list.some((event) => !Number.isFinite(event.minute))) return null;
  return list.filter((event) => (event.minute as number) <= REGULAR_TIME_LAST_MINUTE).length;
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

  const homeRegular = regularTimeGoals(match.homeGoalEvents, match.homeGoals);
  const awayRegular = regularTimeGoals(match.awayGoalEvents, match.awayGoals);
  const useRegular = homeRegular !== null && awayRegular !== null;
  const homeGoals = useRegular ? homeRegular : match.homeGoals;
  const awayGoals = useRegular ? awayRegular : match.awayGoals;

  const homeMargin = homeGoals + match.handicap - awayGoals;
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

    const [roundsData, playersData, squadsData, existingMatchesResult] = await Promise.all([
      fetchJson<FifaRound[]>(FIFA_ROUNDS_URL),
      fetchJson<FifaPlayer[]>(FIFA_PLAYERS_URL),
      fetchJson<FifaSquad[]>(FIFA_SQUADS_URL),
      supabase.from('matches').select('id, handicap, handicap_is_manual, odds_updated_at, handicap_synced_at, handicap_sync_attempted_at, home_goal_events, away_goal_events, match_details'),
    ]);

    if (existingMatchesResult.error) throw existingMatchesResult.error;

    const playerNames = buildPlayerNameMap(playersData ?? []);
    const squadGroups = buildSquadGroupMap(squadsData ?? []);
    await ensureTeamFlagsBucket(supabase);
    const cachedFlagsByCode = await listCachedTeamFlags(supabase);
    const teamFlagsData = cachedFlagsByCode.size > 0
      ? { teams: [] as TeamFlag[] }
      : await fetchJson<{ teams?: TeamFlag[] }>(TEAM_FLAGS_URL).catch(() => ({ teams: [] }));
    const cachedTeamFlags = await cacheTeamFlags(supabase, teamFlagsData.teams ?? [], cachedFlagsByCode);
    const teamLogos = buildTeamLogoMap(cachedTeamFlags);
    cachedFlagsByCode.forEach((flagUrl, code) => teamLogos.set(code, flagUrl));
    const existingMatchesById = new Map((existingMatchesResult.data ?? []).map((match) => [match.id, match]));
    const syncedAt = new Date().toISOString();
    const detailTargetMatchKeys = new Set<string>();
    (roundsData ?? []).forEach((round) => (round.tournaments ?? []).forEach((game) => {
      const hasGoal = Number(game.homeScore ?? 0) + Number(game.awayScore ?? 0) > 0;
      if (hasGoal || mapFifaStatus(game) === 'LIVE') {
        detailTargetMatchKeys.add(buildMatchKey(game.homeSquadName || 'TBD', game.awaySquadName || 'TBD'));
      }
    }));
    const matchDetailsByKey = await fetchMatchDetailsByMatchKey(syncedAt, detailTargetMatchKeys);

    const matches = (roundsData ?? []).flatMap((round) => (round.tournaments ?? []).map((game) => {
      const fixtureDate = new Date(game.date);
      const safeFixtureDate = Number.isNaN(fixtureDate.getTime()) ? new Date() : fixtureDate;
      const status = mapFifaStatus(game);
      const matchId = `wc26_${game.id}`;
      const existingMatch = existingMatchesById.get(matchId);
      const handicap = Number(existingMatch?.handicap ?? 0);
      const homeTeam = game.homeSquadName || 'TBD';
      const awayTeam = game.awaySquadName || 'TBD';
      const matchDetail = matchDetailsByKey.get(buildMatchKey(homeTeam, awayTeam));
      const hasGoals = Number(game.homeScore ?? 0) + Number(game.awayScore ?? 0) > 0;

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
        home_scorers: parseGoalScorers(game.homeGoalScorersAssists, playerNames, game.homeScore),
        away_scorers: parseGoalScorers(game.awayGoalScorersAssists, playerNames, game.awayScore),
        home_goal_events: hasGoals ? (matchDetail?.homeGoalEvents ?? existingMatch?.home_goal_events ?? []) : [],
        away_goal_events: hasGoals ? (matchDetail?.awayGoalEvents ?? existingMatch?.away_goal_events ?? []) : [],
        match_details: matchDetail?.details ?? (hasGoals ? existingMatch?.match_details : undefined) ?? {},
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
          homeGoalEvents: match.home_goal_events ?? undefined,
          awayGoalEvents: match.away_goal_events ?? undefined,
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
    const matchesWithGoalEventsCount = matches.filter((match) => (
      (match.home_goal_events?.length ?? 0) + (match.away_goal_events?.length ?? 0) > 0
    )).length;
    const cachedFlagsCount = matches.filter((match) => (
      String(match.home_logo).includes('/storage/v1/object/public/team-flags/') ||
      String(match.away_logo).includes('/storage/v1/object/public/team-flags/')
    )).length;
    const { error: activityError } = await supabase.from('activities').insert({
      player_name: 'Hệ thống',
      action_text: 'đã đồng bộ dữ liệu trận đấu từ FIFA rounds.json',
      target_text: `${matches.length} trận • ${liveMatchesCount} live • ${finishedMatches.length} đã xong • ${matchesWithGoalEventsCount} có phút bàn thắng • ${cachedFlagsCount} có cờ cache`,
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
      matchesWithGoalEvents: matchesWithGoalEventsCount,
      detailMatches: matchDetailsByKey.size,
      detailTargets: detailTargetMatchKeys.size,
      cachedFlagMatches: cachedFlagsCount,
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
