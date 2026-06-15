import { Match } from '../types';
import { FALLBACK_TEAM_LOGO } from '../domain/teamLogo';

const FIFA_ROUNDS_URL = 'https://play.fifa.com/json/fantasy/rounds.json';
const FIFA_PLAYERS_URL = 'https://play.fifa.com/json/fantasy/players.json';
const FIFA_SQUADS_URL = 'https://play.fifa.com/json/fantasy/squads.json';
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY;

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

const TEAM_ALIASES: Record<string, string> = {
  'bosniaandherzegovina': 'bosniaherzegovina',
  'democraticrepublicofthecongo': 'drcongo',
  'unitedstates': 'usa',
};

const normalizeName = (name: string) => {
  const clean = name.toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[clean] || clean;
};

const VIETNAM_TIME_ZONE = 'Asia/Bangkok';

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

function teamBadge(abbr: string | undefined, name: string) {
  const label = (abbr || name.slice(0, 3) || 'TBD').toUpperCase();

  if (!label.trim()) return FALLBACK_TEAM_LOGO;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0A1622"/>
  <circle cx="32" cy="28" r="21" fill="#102133" stroke="#00F06A" stroke-width="3"/>
  <text x="32" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#00F06A">${label.replace(/[<&>]/g, '')}</text>
  <text x="32" y="57" text-anchor="middle" font-family="Arial, sans-serif" font-size="7" font-weight="700" fill="#ffffff">FIFA</text>
</svg>`);
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
  if (roundId > 3) return undefined;

  const homeGroup = squadGroups.get(game.homeSquadId);
  const awayGroup = squadGroups.get(game.awaySquadId);

  if (homeGroup && awayGroup && homeGroup !== awayGroup) return `${homeGroup}/${awayGroup}`;
  return homeGroup ?? awayGroup;
}

function mapFifaStatus(game: FifaTournament): 'UPCOMING' | 'LIVE' | 'FINISHED' {
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

async function fetchOddsHandicapMap() {
  const oddsMap = new Map<string, number>();
  if (!ODDS_API_KEY) return oddsMap;

  try {
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_API_KEY}&regions=eu,us&markets=spreads`;
    const oddsData = await fetch(oddsUrl).then((response) => response.ok ? response.json() : null);

    if (!Array.isArray(oddsData)) return oddsMap;

    oddsData.forEach((event: any) => {
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
  } catch (error) {
    console.error('Failed to fetch odds:', error);
  }

  return oddsMap;
}

export async function fetchWorldCupMatches(): Promise<Match[]> {
  try {
    const [roundsData, playersData, squadsData, oddsMap] = await Promise.all([
      fetch(FIFA_ROUNDS_URL).then((response) => {
        if (!response.ok) throw new Error(`FIFA rounds fetch failed: ${response.status}`);
        return response.json() as Promise<FifaRound[]>;
      }),
      fetch(FIFA_PLAYERS_URL).then((response) => {
        if (!response.ok) throw new Error(`FIFA players fetch failed: ${response.status}`);
        return response.json() as Promise<FifaPlayer[]>;
      }),
      fetch(FIFA_SQUADS_URL).then((response) => {
        if (!response.ok) throw new Error(`FIFA squads fetch failed: ${response.status}`);
        return response.json() as Promise<FifaSquad[]>;
      }),
      fetchOddsHandicapMap(),
    ]);

    const playerNames = buildPlayerNameMap(playersData ?? []);
    const squadGroups = buildSquadGroupMap(squadsData ?? []);
    const syncedAt = new Date().toISOString();
    const oddsUpdatedAt = oddsMap.size > 0 ? syncedAt : undefined;

    return (roundsData ?? []).flatMap((round) => (round.tournaments ?? []).map((game) => {
      const fixtureDate = new Date(game.date);
      const safeFixtureDate = Number.isNaN(fixtureDate.getTime()) ? new Date() : fixtureDate;
      const status = mapFifaStatus(game);
      const homeTeamName = game.homeSquadName || 'TBD';
      const awayTeamName = game.awaySquadName || 'TBD';
      const matchKey = `${normalizeName(homeTeamName)}_${normalizeName(awayTeamName)}`;
      const handicap = oddsMap.get(matchKey) ?? 0;

      return {
        id: `wc26_${game.id}`,
        externalId: String(game.id),
        league: 'WORLD CUP',
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeLogo: teamBadge(game.homeSquadAbbr, homeTeamName),
        awayLogo: teamBadge(game.awaySquadAbbr, awayTeamName),
        handicap,
        time: status === 'FINISHED' ? 'FINISHED' : formatTimeGmt7(safeFixtureDate),
        date: formatDateGmt7(safeFixtureDate),
        kickoffAt: safeFixtureDate.toISOString(),
        stadium: [game.venueName, game.venueCity].filter(Boolean).join(' • ') || `Sân ${game.id}`,
        status,
        homeGoals: game.homeScore ?? undefined,
        awayGoals: game.awayScore ?? undefined,
        homeScorers: parseGoalScorers(game.homeGoalScorersAssists, playerNames),
        awayScorers: parseGoalScorers(game.awayGoalScorersAssists, playerNames),
        liveTimeText: status === 'LIVE' ? formatLiveTime(game) : undefined,
        isHot: status === 'LIVE' || status === 'UPCOMING',
        lastSyncedAt: syncedAt,
        oddsUpdatedAt,
        matchType: getRoundMatchType(round.id),
        matchGroup: getMatchGroup(round.id, game, squadGroups),
        competitionId: 'worldcup-2026',
      };
    }));
  } catch (error) {
    console.error('Failed to fetch world cup matches from FIFA rounds API:', error);
    throw error;
  }
}
