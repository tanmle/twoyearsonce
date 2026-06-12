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
  local_date: string; // M/D/YYYY HH:mm
  finished: string; // "TRUE" or "FALSE"
  time_elapsed: string;
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

export async function fetchWorldCupMatches(): Promise<Match[]> {
  try {
    // 1. Fetch Teams to map IDs to Names/Logos
    const teamsPromise = fetch(`${API_BASE_URL}/teams`).then(r => r.json());
    
    // 2. Fetch Games
    const gamesPromise = fetch(`${API_BASE_URL}/games`).then(r => r.json());

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
    const [teamsData, gamesData, oddsData] = await Promise.all([teamsPromise, gamesPromise, oddsPromise]);

    // Parse Teams
    const teamsList: WC26Team[] = teamsData.teams || [];
    const teamMap = new Map<string, WC26Team>();
    teamsList.forEach(team => {
      teamMap.set(team.id, team);
    });

    // Parse Games
    const gamesList: WC26Game[] = gamesData.games || [];

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

    // 4. Map to our Match interface
    const matches: Match[] = gamesList.map(apiGame => {
      // Parse dates (Format: "M/D/YYYY HH:mm")
      let fixtureDate = new Date(apiGame.local_date);
      
      // Fallback if parsing fails
      if (isNaN(fixtureDate.getTime())) {
        fixtureDate = new Date();
      }

      // Parse timePart separately for display
      const [_, timePart] = apiGame.local_date ? apiGame.local_date.split(' ') : ['', ''];

      const isFinished = apiGame.finished === "TRUE" || apiGame.time_elapsed === "finished";
      const isLive = !isFinished && apiGame.time_elapsed !== "notstarted";
      const isUpcoming = !isFinished && !isLive;

      let status: 'UPCOMING' | 'LIVE' | 'FINISHED' = 'UPCOMING';
      if (isLive) status = 'LIVE';
      if (isFinished) status = 'FINISHED';

      // Format date like "11 Jun, 2026"
      const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      const formattedDate = fixtureDate.toLocaleDateString('en-GB', dateOptions);

      // Format time like "15:00"
      const formattedTime = timePart || 'TBD';

      // Resolve teams (Handle TBD "0" case)
      const homeTeamObj = teamMap.get(apiGame.home_team_id);
      const awayTeamObj = teamMap.get(apiGame.away_team_id);

      const homeTeamName = homeTeamObj ? homeTeamObj.name_en : apiGame.home_team_label || 'TBD';
      const awayTeamName = awayTeamObj ? awayTeamObj.name_en : apiGame.away_team_label || 'TBD';
      
      // Default flag for unknown teams
      const fallbackLogo = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/FIFA_World_Cup_2026_Logo.svg/512px-FIFA_World_Cup_2026_Logo.svg.png';
      const homeLogo = homeTeamObj ? homeTeamObj.flag : fallbackLogo;
      const awayLogo = awayTeamObj ? awayTeamObj.flag : fallbackLogo;

      // Parse scores
      const homeGoals = apiGame.home_score && apiGame.home_score !== "null" ? parseInt(apiGame.home_score, 10) : undefined;
      const awayGoals = apiGame.away_score && apiGame.away_score !== "null" ? parseInt(apiGame.away_score, 10) : undefined;

      // Resolve handicap by cross-referencing oddsMap
      const matchKey = `${normalizeName(homeTeamName)}_${normalizeName(awayTeamName)}`;
      const handicap = oddsMap.get(matchKey) || 0.0;

      return {
        id: `wc26_${apiGame.id}`,
        league: 'WORLD CUP' as any,
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeLogo: homeLogo,
        awayLogo: awayLogo,
        handicap: handicap,
        time: status === 'FINISHED' ? 'FINISHED' : formattedTime,
        date: formattedDate,
        stadium: 'Stadium ' + apiGame.id, // Simplify stadium for now
        status: status,
        homeGoals: isNaN(homeGoals as any) ? undefined : homeGoals,
        awayGoals: isNaN(awayGoals as any) ? undefined : awayGoals,
        liveTimeText: isLive ? `LIVE ${apiGame.time_elapsed}'` : undefined,
        isHot: status === 'LIVE' || status === 'UPCOMING',
      };
    });

    return matches;
  } catch (error) {
    console.error("Failed to fetch world cup matches from open source API:", error);
    throw error;
  }
}
