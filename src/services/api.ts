import { Match } from '../types';

// We use the open-source worldcup26.ir API which doesn't require an API key
const API_BASE_URL = 'https://worldcup26.ir/get';
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY;

interface WC26Team {
  id: string;
  name_en: string;
  flag: string;
}

interface WC26Game {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_label: string;
  away_team_label: string;
  home_score: string;
  away_score: string;
  home_scorers: string;
  away_scorers: string;
  local_date: string; // M/D/YYYY HH:mm in stadium local time
  stadium_id: string;
  finished: string; // "TRUE" or "FALSE"
  time_elapsed: string;
  type: string;
}

interface WC26Stadium {
  id: string;
  name_en: string;
  city_en: string;
  country_en: string;
  region: string;
}

// Aliases to map worldcup26.ir names to Odds API names
const TEAM_ALIASES: Record<string, string> = {
  'bosniaandherzegovina': 'bosniaherzegovina',
  'democraticrepublicofthecongo': 'drcongo',
  'unitedstates': 'usa',
};

// Helper to normalize team names for robust matching between APIs
const normalizeName = (name: string) => {
  const clean = name.toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[clean] || clean;
};

const VIETNAM_TIME_ZONE = 'Asia/Bangkok';

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
    Number(values.second)
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
    .split(/","|",|,"/)
    .map((scorer) => scorer.replace(/^"|"$/g, '').trim())
    .filter(Boolean);
}

export async function fetchWorldCupMatches(): Promise<Match[]> {
  try {
    // 1. Fetch Teams to map IDs to Names/Logos
    const teamsPromise = fetch(`${API_BASE_URL}/teams`).then(r => r.json());
    
    // 2. Fetch Games and Stadiums
    const gamesPromise = fetch(`${API_BASE_URL}/games`).then(r => r.json());
    const stadiumsPromise = fetch(`${API_BASE_URL}/stadiums`).then(r => r.json());

    // 3. Fetch Odds (if API key is available)
    let oddsPromise = Promise.resolve(null);
    if (ODDS_API_KEY) {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_API_KEY}&regions=eu,us&markets=spreads`;
      oddsPromise = fetch(oddsUrl)
        .then(r => r.ok ? r.json() : null)
        .catch(err => {
          console.error("Failed to fetch odds:", err);
          return null;
        });
    }

    // Await all fetches concurrently
    const [teamsData, gamesData, stadiumsData, oddsData] = await Promise.all([teamsPromise, gamesPromise, stadiumsPromise, oddsPromise]);

    // Parse Teams
    const teamsList: WC26Team[] = teamsData.teams || [];
    const teamMap = new Map<string, WC26Team>();
    teamsList.forEach(team => {
      teamMap.set(team.id, team);
    });

    // Parse Games and Stadiums
    const gamesList: WC26Game[] = gamesData.games || [];
    const stadiumsList: WC26Stadium[] = stadiumsData.stadiums || [];
    const stadiumMap = new Map<string, WC26Stadium>();
    stadiumsList.forEach((stadium) => {
      stadiumMap.set(stadium.id, stadium);
    });

    // Parse Odds and map them by match
    const oddsMap = new Map<string, number>();
    if (oddsData && Array.isArray(oddsData)) {
      oddsData.forEach((event: any) => {
        if (event.bookmakers && event.bookmakers.length > 0) {
          const bookmaker = event.bookmakers[0]; // Take first available bookmaker
          const spreadsMarket = bookmaker.markets.find((m: any) => m.key === 'spreads');
          
          if (spreadsMarket && spreadsMarket.outcomes) {
            // Find the outcome that corresponds to the home team
            const homeOutcome = spreadsMarket.outcomes.find((o: any) => normalizeName(o.name) === normalizeName(event.home_team));
            
            if (homeOutcome) {
              const homeKey = normalizeName(event.home_team);
              const awayKey = normalizeName(event.away_team);
              // Store both combinations to ensure robust matching even if teams are swapped
              oddsMap.set(`${homeKey}_${awayKey}`, homeOutcome.point);
              oddsMap.set(`${awayKey}_${homeKey}`, -homeOutcome.point);
            }
          }
        }
      });
    }

    const syncedAt = new Date().toISOString();
    const oddsUpdatedAt = oddsData ? syncedAt : undefined;

    // 4. Map to our Match interface
    const matches: Match[] = gamesList.map(apiGame => {
      const stadium = stadiumMap.get(apiGame.stadium_id);
      const stadiumTimeZone = getStadiumTimeZone(stadium);

      // Parse API dates as stadium-local time and display them in Vietnam time (GMT+7).
      let fixtureDate = parseApiDateInTimeZone(apiGame.local_date, stadiumTimeZone);
      
      // Fallback if parsing fails
      if (isNaN(fixtureDate.getTime())) {
        fixtureDate = new Date();
      }

      const isFinished = apiGame.finished === "TRUE" || apiGame.time_elapsed === "finished";
      const isLive = !isFinished && apiGame.time_elapsed !== "notstarted";
      const isUpcoming = !isFinished && !isLive;

      let status: 'UPCOMING' | 'LIVE' | 'FINISHED' = 'UPCOMING';
      if (isLive) status = 'LIVE';
      if (isFinished) status = 'FINISHED';

      // Format date/time in GMT+7.
      const formattedDate = formatDateGmt7(fixtureDate);
      const formattedTime = formatTimeGmt7(fixtureDate);

      // Resolve teams (Handle TBD "0" case)
      const homeTeamObj = teamMap.get(apiGame.home_team_id);
      const awayTeamObj = teamMap.get(apiGame.away_team_id);

      const homeTeamName = homeTeamObj ? homeTeamObj.name_en : apiGame.home_team_label || 'TBD';
      const awayTeamName = awayTeamObj ? awayTeamObj.name_en : apiGame.away_team_label || 'TBD';
      
      // Default flag for unknown teams
      const fallbackLogo = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/FIFA_World_Cup_2026_Logo.svg/512px-FIFA_World_Cup_2026_Logo.svg.png';
      const homeLogo = homeTeamObj ? homeTeamObj.flag : fallbackLogo;
      const awayLogo = awayTeamObj ? awayTeamObj.flag : fallbackLogo;

      // Parse scores and scorers
      const homeGoals = apiGame.home_score && apiGame.home_score !== "null" ? parseInt(apiGame.home_score, 10) : undefined;
      const awayGoals = apiGame.away_score && apiGame.away_score !== "null" ? parseInt(apiGame.away_score, 10) : undefined;
      const homeScorers = parseScorers(apiGame.home_scorers);
      const awayScorers = parseScorers(apiGame.away_scorers);

      // Resolve handicap by cross-referencing oddsMap
      const matchKey = `${normalizeName(homeTeamName)}_${normalizeName(awayTeamName)}`;
      const handicap = oddsMap.get(matchKey) || 0.0;

      return {
        id: `wc26_${apiGame.id}`,
        externalId: apiGame.id,
        league: 'WORLD CUP',
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeLogo: homeLogo,
        awayLogo: awayLogo,
        handicap: handicap,
        time: status === 'FINISHED' ? 'FINISHED' : formattedTime,
        date: formattedDate,
        kickoffAt: fixtureDate.toISOString(),
        stadium: stadium?.name_en || 'Sân ' + apiGame.id,
        status: status,
        homeGoals: isNaN(homeGoals as any) ? undefined : homeGoals,
        awayGoals: isNaN(awayGoals as any) ? undefined : awayGoals,
        homeScorers,
        awayScorers,
        liveTimeText: isLive ? `TRỰC TIẾP ${apiGame.time_elapsed}'` : undefined,
        isHot: status === 'LIVE' || status === 'UPCOMING',
        lastSyncedAt: syncedAt,
        oddsUpdatedAt,
        matchType: apiGame.type,
      };
    });

    return matches;
  } catch (error) {
    console.error("Failed to fetch world cup matches from open source API:", error);
    throw error;
  }
}
