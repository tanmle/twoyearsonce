import {
  FormEntry,
  HistoryMatch,
  LineupPlayer,
  Match,
  MatchInsights,
  MatchStats,
  PowerRankingLeader,
  StatGroup,
  SubstitutionEvent,
  TeamLineup,
} from '../types';
import { buildMatchKey } from './api';

const FIFA_LIVE_PREFIX = 'https://api.fifa.com/api/v3/live/football';
const FIFA_CALENDAR_URL = 'https://api.fifa.com/api/v3/calendar/matches';
const FIFA_FLAG_PREFIX = 'https://api.fifa.com/api/v3/picture/flags-sq-4';
const FDH_API_PREFIX = 'https://fdh-api.fifa.com/v1';
const FIFA_MATCH_CENTRE_REGEX = /\/match\/(\d+)\/(\d+)\/(\d+)\/(\d+)/;
// WORLD CUP 2026 finals competition/season (matches src/services/api.ts calendar feed).
const WC26_COMPETITION = '17';
const WC26_SEASON = '285023';

const HISTORY_COUNT = 200;
const FORM_LIMIT = 5;
const H2H_LIMIT = 6;

interface LocalizedText {
  Locale: string;
  Description: string;
}

interface FifaTeamRef {
  IdTeam?: string;
  IdCountry?: string;
  Score?: number | null;
  TeamName?: LocalizedText[];
}

interface FifaCalendarResult {
  IdMatch?: string;
  IdStage?: string;
  IdSeason?: string;
  IdCompetition?: string;
  MatchNumber?: number;
  Date: string;
  MatchStatus?: number;
  ResultType?: number;
  Winner?: string | number | null;
  HomeTeamPenaltyScore?: number | null;
  AwayTeamPenaltyScore?: number | null;
  CompetitionName?: LocalizedText[];
  StageName?: LocalizedText[];
  GroupName?: LocalizedText[];
  Stadium?: { Name?: LocalizedText[]; CityName?: LocalizedText[] };
  Home?: FifaTeamRef | null;
  Away?: FifaTeamRef | null;
}

interface FifaLivePlayer {
  IdPlayer?: string;
  ShirtNumber?: number;
  Status?: number; // 1 = starter, 2 = substitute
  Position?: number; // 0 = GK, 1 = DF, 2 = MF, 3 = FW
  Captain?: boolean;
  PlayerName?: LocalizedText[];
  ShortName?: LocalizedText[];
  PlayerPicture?: { PictureUrl?: string } | null;
}

interface FifaLiveBooking {
  Card?: number; // 1 = yellow, otherwise red
  IdPlayer?: string;
}

interface FifaLiveSubstitution {
  IdPlayerOff?: string;
  IdPlayerOn?: string;
  PlayerOffName?: LocalizedText[];
  PlayerOnName?: LocalizedText[];
  Minute?: string;
}

interface FifaLiveTeam {
  IdTeam?: string;
  Tactics?: string;
  Coaches?: Array<{ Name?: LocalizedText[] }>;
  Players?: FifaLivePlayer[];
  Bookings?: FifaLiveBooking[];
  Substitutions?: FifaLiveSubstitution[];
}

interface FifaLiveMatch {
  HomeTeam?: FifaLiveTeam;
  AwayTeam?: FifaLiveTeam;
  Properties?: { IdIFES?: string };
}

// fdh-api.fifa.com uses lowercase locale keys.
interface FdhLocalizedText {
  locale: string;
  description: string;
}

interface FdhPowerRankingPlayer {
  teamName?: FdhLocalizedText[];
  teamFlag?: string;
  playerName?: FdhLocalizedText[];
  playerPicture?: { pictureUrl?: string } | null;
  attackingScore?: number;
  creativityScore?: number;
  defensiveScore?: number;
}

interface FdhPowerRanking {
  outfieldPlayers?: FdhPowerRankingPlayer[];
}

// teams.json shape: { "<teamId>": [ ["StatName", value, included], ... ] }
type FdhTeamStats = Record<string, Array<[string, number, boolean]>>;

interface FifaIds {
  competitionId: string;
  seasonId: string;
  stageId: string;
  matchId: string;
}

function text(value?: LocalizedText[]) {
  return value?.find((item) => item.Locale === 'en-GB')?.Description ?? value?.[0]?.Description;
}

function flagUrl(idCountry?: string) {
  return idCountry ? `${FIFA_FLAG_PREFIX}/${idCountry}` : undefined;
}

function fdhText(value?: FdhLocalizedText[]) {
  return value?.find((item) => item.locale === 'en-GB')?.description ?? value?.[0]?.description;
}

// Power-ranking flags arrive as a template: ".../flags-{format}-{size}/COD".
function fillFlagTemplate(template?: string) {
  return template?.replace('{format}', 'sq').replace('{size}', '4');
}

async function fetchFifaJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`FIFA fetch failed ${response.status}: ${url}`);
  return response.json() as Promise<T>;
}

function parseMatchCentreIds(url?: string): FifaIds | undefined {
  if (!url) return undefined;
  const match = url.match(FIFA_MATCH_CENTRE_REGEX);
  if (!match) return undefined;
  return { competitionId: match[1], seasonId: match[2], stageId: match[3], matchId: match[4] };
}

/**
 * Resolve the FIFA live-match ids for a Match. Finished/live matches already carry the
 * match-centre URL (synced from FIFA); otherwise we resolve from the WC26 calendar by
 * matching team names. NOTE: the fantasy game id (stored in externalId) is NOT the FIFA
 * MatchNumber — the two id spaces differ — so we must never join on it.
 */
async function resolveFifaIds(match: Match): Promise<FifaIds | undefined> {
  const targetKey = buildMatchKey(match.homeTeam, match.awayTeam);

  const calendarUrl = `${FIFA_CALENDAR_URL}?language=en&count=500&idCompetition=${WC26_COMPETITION}&idSeason=${WC26_SEASON}`;
  const calendar = await fetchFifaJson<{ Results?: FifaCalendarResult[] }>(calendarUrl);
  const candidates = (calendar.Results ?? []).filter((result) => (
    result.IdMatch && result.IdStage &&
    buildMatchKey(text(result.Home?.TeamName) ?? '', text(result.Away?.TeamName) ?? '') === targetKey
  ));
  // Fall back to the synced match-centre URL only when the calendar has no real-team fixture
  // yet (e.g. knockout placeholders); the URL itself can be stale from an earlier bad sync.
  if (candidates.length === 0) return parseMatchCentreIds(match.details?.fifaMatchCentreUrl);

  // The same pairing can occur more than once across a tournament; pick the fixture closest
  // to this match's kickoff when we have a timestamp to disambiguate.
  const kickoff = match.kickoffAt ? Date.parse(match.kickoffAt) : NaN;
  const entry = Number.isFinite(kickoff)
    ? candidates.reduce((best, result) => {
        const diff = Math.abs(Date.parse(result.Date) - kickoff);
        const bestDiff = Math.abs(Date.parse(best.Date) - kickoff);
        return Number.isFinite(diff) && (!Number.isFinite(bestDiff) || diff < bestDiff) ? result : best;
      })
    : candidates[0];

  return {
    competitionId: entry.IdCompetition ?? WC26_COMPETITION,
    seasonId: entry.IdSeason ?? WC26_SEASON,
    stageId: entry.IdStage!,
    matchId: entry.IdMatch!,
  };
}

function buildPenaltyText(result: FifaCalendarResult): string | undefined {
  const homePens = result.HomeTeamPenaltyScore;
  const awayPens = result.AwayTeamPenaltyScore;
  if (homePens === null || homePens === undefined || awayPens === null || awayPens === undefined) {
    return undefined;
  }
  const homeWon = homePens > awayPens;
  const winnerName = text(homeWon ? result.Home?.TeamName : result.Away?.TeamName);
  const high = Math.max(homePens, awayPens);
  const low = Math.min(homePens, awayPens);
  return `${winnerName ?? 'Đội thắng'} thắng ${high}-${low} luân lưu`;
}

function mapHistoryMatch(result: FifaCalendarResult): HistoryMatch {
  const stadiumName = text(result.Stadium?.Name);
  const stadiumCity = text(result.Stadium?.CityName);
  return {
    matchId: result.IdMatch,
    date: result.Date,
    competition: text(result.CompetitionName),
    stageName: text(result.StageName),
    groupName: text(result.GroupName),
    stadium: [stadiumName, stadiumCity].filter(Boolean).join(', ') || undefined,
    homeTeam: text(result.Home?.TeamName) ?? 'TBD',
    awayTeam: text(result.Away?.TeamName) ?? 'TBD',
    homeFlag: flagUrl(result.Home?.IdCountry),
    awayFlag: flagUrl(result.Away?.IdCountry),
    homeScore: result.Home?.Score ?? undefined,
    awayScore: result.Away?.Score ?? undefined,
    homePens: result.HomeTeamPenaltyScore ?? undefined,
    awayPens: result.AwayTeamPenaltyScore ?? undefined,
    penaltyText: buildPenaltyText(result),
  };
}

function isPlayed(result: FifaCalendarResult) {
  return result.MatchStatus === 0 && result.Home?.Score !== null && result.Away?.Score !== null;
}

async function fetchTeamHistory(idTeam: string): Promise<FifaCalendarResult[]> {
  const url = `${FIFA_CALENDAR_URL}?idTeam=${idTeam}&count=${HISTORY_COUNT}&language=en`;
  const data = await fetchFifaJson<{ Results?: FifaCalendarResult[] }>(url);
  // FIFA returns ascending by date; newest last.
  return [...(data.Results ?? [])].sort((a, b) => a.Date.localeCompare(b.Date));
}

function outcomeFromScore(homeScore?: number, awayScore?: number, isHome?: boolean): 'W' | 'D' | 'L' {
  if (homeScore === undefined || awayScore === undefined || homeScore === awayScore) return 'D';
  const teamScore = isHome ? homeScore : awayScore;
  const oppScore = isHome ? awayScore : homeScore;
  return teamScore > oppScore ? 'W' : 'L';
}

function buildForm(history: FifaCalendarResult[], idTeam: string, beforeIso: string): FormEntry[] {
  const before = new Date(beforeIso).getTime();
  return history
    .filter((result) => isPlayed(result) && new Date(result.Date).getTime() < before)
    .slice(-FORM_LIMIT)
    .reverse()
    .map((result) => {
      const isHome = result.Home?.IdTeam === idTeam;
      return {
        match: mapHistoryMatch(result),
        isHome,
        outcome: outcomeFromScore(result.Home?.Score ?? undefined, result.Away?.Score ?? undefined, isHome),
      };
    });
}

function buildHeadToHead(homeHistory: FifaCalendarResult[], awayTeamId: string, beforeIso: string): HistoryMatch[] {
  const before = new Date(beforeIso).getTime();
  return homeHistory
    .filter((result) => {
      const ids = [result.Home?.IdTeam, result.Away?.IdTeam];
      return ids.includes(awayTeamId) && isPlayed(result) && new Date(result.Date).getTime() < before;
    })
    .slice(-H2H_LIMIT)
    .reverse()
    .map(mapHistoryMatch);
}

const POSITION_LABELS: Array<LineupPlayer['position']> = ['GK', 'DF', 'MF', 'FW'];

interface LineupContext {
  bookings: Map<string, 'yellow' | 'red'>;
  subOffById: Map<string, { minute?: string; playerName: string; playerNumber?: number }>;
  subOnById: Map<string, string | undefined>;
}

function mapPlayer(player: FifaLivePlayer, ctx: LineupContext): LineupPlayer {
  const positionOrder = player.Position ?? 99;
  const id = player.IdPlayer;
  return {
    id,
    name: text(player.ShortName) ?? text(player.PlayerName) ?? `#${id}`,
    shirtNumber: player.ShirtNumber,
    position: POSITION_LABELS[positionOrder] ?? '',
    positionOrder,
    isCaptain: Boolean(player.Captain),
    card: id ? ctx.bookings.get(id) : undefined,
    photoUrl: player.PlayerPicture?.PictureUrl || undefined,
    subOff: id ? ctx.subOffById.get(id) : undefined,
    subOnMinute: id ? ctx.subOnById.get(id) : undefined,
  };
}

function byPositionThenShirt(a: LineupPlayer, b: LineupPlayer) {
  if (a.positionOrder !== b.positionOrder) return a.positionOrder - b.positionOrder;
  return (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99);
}

function mapLineup(team: FifaLiveTeam | undefined): TeamLineup | undefined {
  const players = team?.Players ?? [];
  if (players.length === 0) return undefined;

  const bookings = new Map<string, 'yellow' | 'red'>();
  (team?.Bookings ?? []).forEach((booking) => {
    if (!booking.IdPlayer) return;
    bookings.set(booking.IdPlayer, booking.Card === 1 ? 'yellow' : 'red');
  });

  const shirtById = new Map<string, number | undefined>(
    players.map((player) => [player.IdPlayer ?? '', player.ShirtNumber]),
  );
  const subOffById = new Map<string, { minute?: string; playerName: string; playerNumber?: number }>();
  const subOnById = new Map<string, string | undefined>();
  (team?.Substitutions ?? []).forEach((sub) => {
    if (sub.IdPlayerOff) {
      subOffById.set(sub.IdPlayerOff, {
        minute: sub.Minute,
        playerName: text(sub.PlayerOnName) ?? '',
        playerNumber: sub.IdPlayerOn ? shirtById.get(sub.IdPlayerOn) : undefined,
      });
    }
    if (sub.IdPlayerOn) subOnById.set(sub.IdPlayerOn, sub.Minute);
  });

  const ctx: LineupContext = { bookings, subOffById, subOnById };
  const starters: LineupPlayer[] = [];
  const bench: LineupPlayer[] = [];
  players.forEach((player) => {
    (player.Status === 1 ? starters : bench).push(mapPlayer(player, ctx));
  });
  starters.sort(byPositionThenShirt);
  bench.sort(byPositionThenShirt);

  const substitutions: SubstitutionEvent[] = (team?.Substitutions ?? []).map((sub) => ({
    playerOff: text(sub.PlayerOffName) ?? '',
    playerOn: text(sub.PlayerOnName) ?? '',
    minute: sub.Minute,
  }));

  return {
    formation: team?.Tactics || undefined,
    coach: text(team?.Coaches?.[0]?.Name),
    starters,
    bench,
    substitutions,
  };
}

function topLeader(
  players: FdhPowerRankingPlayer[],
  category: PowerRankingLeader['category'],
  scoreKey: 'attackingScore' | 'creativityScore' | 'defensiveScore',
): PowerRankingLeader | undefined {
  let best: FdhPowerRankingPlayer | undefined;
  players.forEach((player) => {
    if (typeof player[scoreKey] !== 'number') return;
    if (!best || (player[scoreKey] ?? 0) > (best[scoreKey] ?? 0)) best = player;
  });
  if (!best) return undefined;
  return {
    category,
    playerName: fdhText(best.playerName) ?? 'Cầu thủ',
    teamName: fdhText(best.teamName),
    teamFlag: fillFlagTemplate(best.teamFlag),
    photoUrl: best.playerPicture?.pictureUrl || undefined,
    score: best[scoreKey] as number,
  };
}

async function fetchPowerRanking(idIfes: string): Promise<PowerRankingLeader[]> {
  const data = await fetchFifaJson<FdhPowerRanking>(`${FDH_API_PREFIX}/powerranking/match/${idIfes}.json`);
  const players = data.outfieldPlayers ?? [];
  return [
    topLeader(players, 'attacking', 'attackingScore'),
    topLeader(players, 'creativity', 'creativityScore'),
    topLeader(players, 'defending', 'defensiveScore'),
  ].filter((leader): leader is PowerRankingLeader => Boolean(leader));
}

// Curated subset of the FIFA "Live Statistics" rows, mirroring the match-centre layout.
const STAT_GROUPS: Array<{ title: string; rows: Array<{ label: string; key: string }> }> = [
  {
    title: 'Dứt điểm',
    rows: [
      { label: 'Tổng dứt điểm', key: 'AttemptAtGoal' },
      { label: 'Trúng đích', key: 'AttemptAtGoalOnTarget' },
    ],
  },
  {
    title: 'Bàn thắng',
    rows: [
      { label: 'Tổng', key: 'Goals' },
      { label: 'Bị thủng lưới', key: 'GoalsConceded' },
      { label: 'Trong vòng cấm', key: 'GoalsInsideThePenaltyArea' },
      { label: 'Ngoài vòng cấm', key: 'GoalsOutsideThePenaltyArea' },
      { label: 'Kiến tạo', key: 'Assists' },
    ],
  },
];

async function fetchMatchStats(idIfes: string, homeTeamId?: string, awayTeamId?: string): Promise<MatchStats | undefined> {
  if (!homeTeamId || !awayTeamId) return undefined;
  const data = await fetchFifaJson<FdhTeamStats>(`${FDH_API_PREFIX}/stats/match/${idIfes}/teams.json`);
  const homeStats = new Map((data[homeTeamId] ?? []).map((row) => [row[0], row[1]]));
  const awayStats = new Map((data[awayTeamId] ?? []).map((row) => [row[0], row[1]]));
  if (homeStats.size === 0 && awayStats.size === 0) return undefined;

  const homePossession = Math.round((homeStats.get('Possession') ?? 0) * 100);
  const awayPossession = Math.round((awayStats.get('Possession') ?? 0) * 100);

  const groups: StatGroup[] = STAT_GROUPS.map((group) => ({
    title: group.title,
    rows: group.rows.map((row) => ({
      label: row.label,
      home: homeStats.get(row.key) ?? 0,
      away: awayStats.get(row.key) ?? 0,
    })),
  }));

  return {
    homePossession,
    awayPossession,
    contestPossession: Math.max(0, 100 - homePossession - awayPossession),
    groups,
  };
}

export async function fetchMatchInsights(match: Match): Promise<MatchInsights> {
  const ids = await resolveFifaIds(match);
  if (!ids) throw new Error('Không tìm thấy mã trận FIFA để tải lịch sử.');

  const liveUrl = `${FIFA_LIVE_PREFIX}/${ids.competitionId}/${ids.seasonId}/${ids.stageId}/${ids.matchId}?language=en`;
  const live = await fetchFifaJson<FifaLiveMatch>(liveUrl);

  const homeTeamId = live.HomeTeam?.IdTeam;
  const awayTeamId = live.AwayTeam?.IdTeam;
  const idIfes = live.Properties?.IdIFES;
  const beforeIso = match.kickoffAt ?? new Date().toISOString();

  const [homeHistory, awayHistory, powerRanking, stats] = await Promise.all([
    homeTeamId ? fetchTeamHistory(homeTeamId).catch(() => []) : Promise.resolve([]),
    awayTeamId ? fetchTeamHistory(awayTeamId).catch(() => []) : Promise.resolve([]),
    idIfes ? fetchPowerRanking(idIfes).catch(() => []) : Promise.resolve([]),
    idIfes ? fetchMatchStats(idIfes, homeTeamId, awayTeamId).catch(() => undefined) : Promise.resolve(undefined),
  ]);

  return {
    headToHead: homeTeamId && awayTeamId ? buildHeadToHead(homeHistory, awayTeamId, beforeIso) : [],
    homeForm: homeTeamId ? buildForm(homeHistory, homeTeamId, beforeIso) : [],
    awayForm: awayTeamId ? buildForm(awayHistory, awayTeamId, beforeIso) : [],
    homeLineup: mapLineup(live.HomeTeam),
    awayLineup: mapLineup(live.AwayTeam),
    powerRanking,
    stats,
  };
}
