import { useState, useEffect } from 'react';
import { Player, Match, Prediction, ActivityFeedItem, Settlement, Competition } from './types';
import { fetchWorldCupMatches } from './services/api';
import { settlePrediction } from './domain/settlement';
import { applyPlayerStats } from './domain/playerStats';
import { isPredictionLocked } from './domain/predictionLock';
import { loadJson, LOCAL_STORAGE_KEYS, saveJson } from './storage/localStore';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  fetchActivitiesFromSupabase,
  fetchCompetitionsFromSupabase,
  fetchMatchesFromSupabase,
  fetchPlayersFromSupabase,
  fetchPredictionsFromSupabase,
  fetchSettlementsFromSupabase,
  insertActivityToSupabase,
  insertPlayerToSupabase,
  invokeWorldCupSync,
  upsertMatchesToSupabase,
  upsertPredictionToSupabase,
  upsertSettlementsToSupabase,
} from './services/supabaseData';

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MatchList from './components/MatchList';
import Leaderboard from './components/Leaderboard';
import MatchDetails from './components/MatchDetails';
import IdentitySelector from './components/IdentitySelector';
import Login from './components/Login';
import { createFootballerAvatar } from './domain/playerAvatar';

const EMPTY_PLAYER: Player = {
  id: '',
  name: 'Đang tải',
  avatar: 'https://ui-avatars.com/api/?name=BeerCup&background=00F06A&color=02090F&bold=true',
  totalPredictionsCount: 0,
  notLoseCount: 0,
  loseHalfCount: 0,
  loseCount: 0,
  loseDoubleCount: 0,
  totalPenaltyVnd: 0,
};

function buildDefaultHomePredictions(
  players: Player[],
  matches: Match[],
  existingPredictions: Prediction[],
  options: { includeFinished?: boolean } = {}
) {
  const defaults: Prediction[] = [];
  const eligibleMatches = options.includeFinished
    ? matches
    : matches.filter((match) => match.status !== 'FINISHED');

  eligibleMatches.forEach((match) => {
    players.forEach((player) => {
      const alreadyPredicted = existingPredictions.some(
        (prediction) => prediction.matchId === match.id && prediction.playerId === player.id
      );

      if (!alreadyPredicted) {
        defaults.push({
          matchId: match.id,
          playerId: player.id,
          competitionId: match.competitionId ?? 'worldcup-2026',
          choice: 'HOME',
          timestamp: 'Mặc định chọn chủ nhà',
          hopeStar: false,
        });
      }
    });
  });

  return defaults;
}

function createPlayerId(name: string, existingIds: string[]) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `player-${Date.now()}`;

  let id = base;
  let suffix = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function createDefaultAvatar(name: string) {
  return createFootballerAvatar(name);
}

function persistDefaultPredictions(defaultPredictions: Prediction[]) {
  if (!isSupabaseConfigured || defaultPredictions.length === 0) return;

  Promise.all(defaultPredictions.map((prediction) => upsertPredictionToSupabase(prediction))).catch((error) => {
    console.error('Failed to sync default home predictions to Supabase', error);
  });
}

function buildSettlementsForFinishedMatches(
  matches: Match[],
  predictions: Prediction[],
  options: { requirePredictionId?: boolean } = {}
): Settlement[] {
  return matches.flatMap((match) => {
    if (match.status !== 'FINISHED' || match.homeGoals === undefined || match.awayGoals === undefined) return [];

    return predictions.flatMap((prediction) => {
      if (prediction.matchId !== match.id || !prediction.choice) return [];
      if (options.requirePredictionId && !prediction.id) return [];

      const settlement = settlePrediction(match, prediction);
      if (settlement.status === 'SETTLE_PENDING') return [];

      return [{
        predictionId: prediction.id,
        matchId: match.id,
        playerId: prediction.playerId,
        competitionId: match.competitionId ?? prediction.competitionId ?? 'worldcup-2026',
        status: settlement.status,
        penaltyVnd: settlement.penaltyVnd,
      }];
    });
  });
}

export default function App() {
  // Tab navigation state
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  
  const [competitions, setCompetitions] = useState<Competition[]>([
    { id: 'worldcup-2026', name: 'World Cup 2026', year: 2026, status: 'active' },
  ]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('worldcup-2026');

  // Players state with persistent initialization
  const [players, setPlayers] = useState<Player[]>(() =>
    loadJson(LOCAL_STORAGE_KEYS.players, [])
  );

  // Current logged in user ID state with persistent initialization
  const [currentPlayerId, setCurrentPlayerId] = useState<string>(() =>
    loadJson(LOCAL_STORAGE_KEYS.currentPlayerId, '')
  );

  // Matches state with persistent initialization
  const [matches, setMatches] = useState<Match[]>(() =>
    loadJson(LOCAL_STORAGE_KEYS.matches, [])
  );

  // Predictions state with persistent initialization
  const [predictions, setPredictions] = useState<Prediction[]>(() =>
    loadJson(LOCAL_STORAGE_KEYS.predictions, [])
  );

  // Activity Feed state with persistent initialization
  const [activities, setActivities] = useState<ActivityFeedItem[]>(() =>
    loadJson(LOCAL_STORAGE_KEYS.activities, [])
  );
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  // Active match for detail report popup overlay
  const [activeSelectedMatch, setActiveSelectedMatch] = useState<Match | null>(null);
  const [predictionPlayerId, setPredictionPlayerId] = useState<string>('');

  // Syncing state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLoadingRealData, setIsLoadingRealData] = useState<boolean>(isSupabaseConfigured);

  // Keep local fallback state persisted when Supabase is unavailable
  useEffect(() => {
    saveJson(LOCAL_STORAGE_KEYS.players, players);
  }, [players]);

  useEffect(() => {
    saveJson(LOCAL_STORAGE_KEYS.currentPlayerId, currentPlayerId);
  }, [currentPlayerId]);

  useEffect(() => {
    saveJson(LOCAL_STORAGE_KEYS.matches, matches);
  }, [matches]);

  useEffect(() => {
    saveJson(LOCAL_STORAGE_KEYS.predictions, predictions);
  }, [predictions]);

  useEffect(() => {
    saveJson(LOCAL_STORAGE_KEYS.activities, activities);
  }, [activities]);

  // Load shared real data from Supabase when configured.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;

    async function loadRealData() {
      try {
        setIsLoadingRealData(true);
        const [remoteCompetitions, remotePlayers, remoteMatches, remotePredictions, remoteSettlements, remoteActivities] = await Promise.all([
          fetchCompetitionsFromSupabase(),
          fetchPlayersFromSupabase(),
          fetchMatchesFromSupabase(),
          fetchPredictionsFromSupabase(),
          fetchSettlementsFromSupabase(),
          fetchActivitiesFromSupabase(),
        ]);

        if (!isMounted) return;

        const defaultPredictions = buildDefaultHomePredictions(remotePlayers, remoteMatches, remotePredictions);
        const predictionsWithDefaults = [...remotePredictions, ...defaultPredictions];

        setCompetitions(remoteCompetitions.length > 0 ? remoteCompetitions : competitions);
        setPlayers(remotePlayers);
        setMatches(remoteMatches);
        setPredictions(predictionsWithDefaults);
        setSettlements(remoteSettlements);
        setActivities(remoteActivities);
        persistDefaultPredictions(defaultPredictions);

        if (currentPlayerId && !remotePlayers.some((player) => player.id === currentPlayerId)) {
          setCurrentPlayerId('');
        }
      } catch (error) {
        console.error('Failed to load real data from Supabase', error);
      } finally {
        if (isMounted) setIsLoadingRealData(false);
      }
    }

    loadRealData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Keep live scores, settlements, and cron sync activities fresh while the app is open.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    const refreshCronSyncedData = async () => {
      try {
        const [remoteMatches, remoteSettlements, remoteActivities] = await Promise.all([
          fetchMatchesFromSupabase(),
          fetchSettlementsFromSupabase(),
          fetchActivitiesFromSupabase(),
        ]);

        if (!isMounted) return;
        setMatches(remoteMatches);
        setSettlements(remoteSettlements);
        setActivities(remoteActivities);
      } catch (error) {
        console.warn('Failed to refresh cron-synced data', error);
      }
    };

    const intervalId = window.setInterval(refreshCronSyncedData, 60_000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  // Realtime DB updates for overview/dashboard, activities, scores, predictions, and player stats.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let isMounted = true;
    let refreshTimeoutId: number | undefined;

    const refreshSharedData = async () => {
      try {
        const [remotePlayers, remoteMatches, remotePredictions, remoteSettlements, remoteActivities] = await Promise.all([
          fetchPlayersFromSupabase(),
          fetchMatchesFromSupabase(),
          fetchPredictionsFromSupabase(),
          fetchSettlementsFromSupabase(),
          fetchActivitiesFromSupabase(),
        ]);

        if (!isMounted) return;

        const defaultPredictions = buildDefaultHomePredictions(remotePlayers, remoteMatches, remotePredictions);
        setPlayers(remotePlayers);
        setMatches(remoteMatches);
        setPredictions([...remotePredictions, ...defaultPredictions]);
        setSettlements(remoteSettlements);
        setActivities(remoteActivities);
        persistDefaultPredictions(defaultPredictions);
      } catch (error) {
        console.warn('Failed to refresh realtime data', error);
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimeoutId !== undefined) window.clearTimeout(refreshTimeoutId);
      refreshTimeoutId = window.setTimeout(() => {
        void refreshSharedData();
      }, 300);
    };

    const channel = supabase
      .channel('beercup-realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, scheduleRefresh)
      .subscribe();

    return () => {
      isMounted = false;
      if (refreshTimeoutId !== undefined) window.clearTimeout(refreshTimeoutId);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!activeSelectedMatch) return;
    const latestMatch = matches.find((match) => match.id === activeSelectedMatch.id);
    if (latestMatch && latestMatch !== activeSelectedMatch) setActiveSelectedMatch(latestMatch);
  }, [matches, activeSelectedMatch]);

  const selectedCompetition = competitions.find((competition) => competition.id === selectedCompetitionId) ?? competitions[0];
  const scopedMatches = matches.filter((match) => (match.competitionId ?? 'worldcup-2026') === selectedCompetitionId);
  const scopedPredictions = predictions.filter((prediction) => (prediction.competitionId ?? 'worldcup-2026') === selectedCompetitionId);
  const scopedSettlements = settlements.filter((settlement) => (settlement.competitionId ?? 'worldcup-2026') === selectedCompetitionId);

  // Find actualPlayer object
  const playersWithStats = applyPlayerStats(players, scopedPredictions, scopedSettlements);
  const currentPlayer = currentPlayerId
    ? playersWithStats.find((p) => p.id === currentPlayerId) || EMPTY_PLAYER
    : EMPTY_PLAYER;
  const predictionPlayer = predictionPlayerId
    ? playersWithStats.find((p) => p.id === predictionPlayerId) || currentPlayer
    : currentPlayer;

  // Handler to set prediction choice (Chủ nhà/Đội khách Voted)
  const handleTogglePrediction = (matchId: string, choice: 'HOME' | 'AWAY') => {
    const matchItem = matches.find((m) => m.id === matchId);
    if (!matchItem || !predictionPlayer.id) return;

    if (isPredictionLocked(matchItem)) {
      alert('Lựa chọn đã khóa trước giờ bóng lăn 1 tiếng.');
      return;
    }

    const existingPrediction = predictions.find(
      (p) => p.matchId === matchId && p.playerId === predictionPlayer.id
    );
    const filteredPreds = predictions.filter(
      (p) => !(p.matchId === matchId && p.playerId === predictionPlayer.id)
    );

    const newPrediction: Prediction = {
      ...existingPrediction,
      matchId,
      playerId: predictionPlayer.id,
      competitionId: matchItem.competitionId ?? selectedCompetitionId,
      choice,
      timestamp: 'Vừa xong',
      hopeStar: existingPrediction?.hopeStar ?? false,
    };

    setPredictions([...filteredPreds, newPrediction]);
    if (isSupabaseConfigured) {
      upsertPredictionToSupabase(newPrediction).catch((error) => {
        console.error('Failed to sync prediction to Supabase', error);
      });
    }

    // Insert new timeline log item
    const logItem: ActivityFeedItem = {
      id: `act_${Date.now()}`,
      playerName: predictionPlayer.name,
      actionText: currentPlayer.id === predictionPlayer.id ? 'đã chọn' : `được ${currentPlayer.name} chọn hộ`,
      targetText: choice === 'HOME' ? matchItem.homeTeam : matchItem.awayTeam,
      type: 'change_prediction',
      timeAgo: 'VỪA XONG',
    };

    setActivities([logItem, ...activities]);
    if (isSupabaseConfigured) {
      insertActivityToSupabase(logItem, predictionPlayer.id).catch((error) => {
        console.error('Failed to sync activity to Supabase', error);
      });
    }
  };

  const recalculateFinishedMatchSettlements = async (match: Match, fallbackPredictions: Prediction[]) => {
    if (match.status !== 'FINISHED') return;

    if (isSupabaseConfigured) {
      const latestPredictions = await fetchPredictionsFromSupabase();
      const recalculatedSettlements = buildSettlementsForFinishedMatches([match], latestPredictions, { requirePredictionId: true });
      await upsertSettlementsToSupabase(recalculatedSettlements);
      setPredictions(latestPredictions);
      setSettlements(await fetchSettlementsFromSupabase());
      return;
    }

    const recalculatedSettlements = buildSettlementsForFinishedMatches([match], fallbackPredictions);
    setSettlements((prevSettlements) => [
      ...prevSettlements.filter((settlement) => settlement.matchId !== match.id),
      ...recalculatedSettlements,
    ]);
  };

  const handleOverridePredictions = (matchId: string, playerIds: string[], choice: 'HOME' | 'AWAY') => {
    if (currentPlayer.role !== 'admin') {
      alert('Chỉ quản trị viên mới được sửa lựa chọn đã khóa.');
      return;
    }

    const matchItem = matches.find((match) => match.id === matchId);
    if (!matchItem || playerIds.length === 0) return;

    const updatedPredictions: Prediction[] = playerIds.map((playerId) => {
      const existingPrediction = predictions.find(
        (prediction) => prediction.matchId === matchId && prediction.playerId === playerId
      );

      return {
        ...existingPrediction,
        matchId,
        playerId,
        competitionId: matchItem.competitionId ?? selectedCompetitionId,
        choice,
        timestamp: 'Admin vừa sửa',
        hopeStar: existingPrediction?.hopeStar ?? false,
      };
    });

    const overriddenPlayerIds = new Set(playerIds);
    const nextPredictions = [
      ...predictions.filter(
        (prediction) => !(prediction.matchId === matchId && overriddenPlayerIds.has(prediction.playerId))
      ),
      ...updatedPredictions,
    ];

    setPredictions(nextPredictions);

    const syncOverride = async () => {
      if (isSupabaseConfigured) {
        await Promise.all(updatedPredictions.map((prediction) => upsertPredictionToSupabase(prediction)));
      }
      await recalculateFinishedMatchSettlements(matchItem, nextPredictions);
    };

    syncOverride().catch((error) => {
      console.error('Failed to sync admin prediction override', error);
    });
  };

  const handleToggleHopeStar = (matchId: string) => {
    const matchItem = matches.find((m) => m.id === matchId);
    if (!matchItem || !predictionPlayer.id) return;

    if (isPredictionLocked(matchItem)) {
      alert('Ngôi sao hy vọng đã khóa trước giờ bóng lăn 1 tiếng.');
      return;
    }

    if (matchItem.matchType === 'group') {
      alert('Ngôi sao hy vọng chỉ áp dụng từ vòng sau vòng bảng.');
      return;
    }

    const existingPrediction = predictions.find(
      (p) => p.matchId === matchId && p.playerId === predictionPlayer.id
    );

    const updatedPrediction: Prediction = {
      ...existingPrediction,
      matchId,
      playerId: predictionPlayer.id,
      competitionId: matchItem.competitionId ?? selectedCompetitionId,
      choice: existingPrediction?.choice ?? 'HOME',
      timestamp: 'Vừa xong',
      hopeStar: !(existingPrediction?.hopeStar ?? false),
    };

    setPredictions((prevPredictions) => [
      ...prevPredictions.filter((p) => !(p.matchId === matchId && p.playerId === predictionPlayer.id)),
      updatedPrediction,
    ]);

    if (isSupabaseConfigured) {
      upsertPredictionToSupabase(updatedPrediction).catch((error) => {
        console.error('Failed to sync hope star to Supabase', error);
      });
    }
  };

  // Handler to switch player identity
  const handleSelectPlayer = (player: Player) => {
    setCurrentPlayerId(player.id);
    setPredictionPlayerId(player.id);
    // When switching player, we stay on same view or transition directly
    setCurrentTab('dashboard');
  };


  const handleLogout = () => {
    setCurrentPlayerId('');
    setPredictionPlayerId('');
    setCurrentTab('dashboard');
    setActiveSelectedMatch(null);
  };

  const handleAddPlayer = (name: string, avatar?: string) => {
    if (currentPlayer.role !== 'admin') {
      alert('Chỉ quản trị viên mới được thêm người chơi.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Nhập tên người chơi.');
      return;
    }

    const alreadyExists = players.some((player) => player.name.toLowerCase() === trimmedName.toLowerCase());
    if (alreadyExists) {
      alert('Người chơi này đã tồn tại.');
      return;
    }

    const newPlayer: Player = {
      id: createPlayerId(trimmedName, players.map((player) => player.id)),
      name: trimmedName,
      avatar: avatar?.trim() || createDefaultAvatar(trimmedName),
      totalPredictionsCount: 0,
      notLoseCount: 0,
      loseHalfCount: 0,
      loseCount: 0,
      loseDoubleCount: 0,
      totalPenaltyVnd: 0,
      role: 'player',
    };

    const nextPlayers = [...players, newPlayer].sort((a, b) => a.name.localeCompare(b.name));
    const defaultPredictions = buildDefaultHomePredictions([newPlayer], scopedMatches, scopedPredictions, { includeFinished: true });
    const nextPredictions = [...predictions, ...defaultPredictions];
    const newSettlements = buildSettlementsForFinishedMatches(scopedMatches, defaultPredictions);

    setPlayers(nextPlayers);
    if (defaultPredictions.length > 0) {
      setPredictions(nextPredictions);
    }
    if (newSettlements.length > 0) {
      setSettlements((prevSettlements) => [...prevSettlements, ...newSettlements]);
    }

    const syncNewPlayer = async () => {
      if (!isSupabaseConfigured) return;

      await insertPlayerToSupabase(newPlayer);
      if (defaultPredictions.length > 0) {
        await Promise.all(defaultPredictions.map((prediction) => upsertPredictionToSupabase(prediction)));
      }

      const latestPredictions = await fetchPredictionsFromSupabase();
      const newPlayerSettlements = buildSettlementsForFinishedMatches(
        scopedMatches,
        latestPredictions.filter((prediction) => prediction.playerId === newPlayer.id && (prediction.competitionId ?? 'worldcup-2026') === selectedCompetitionId),
        { requirePredictionId: true }
      );
      if (newPlayerSettlements.length > 0) {
        await upsertSettlementsToSupabase(newPlayerSettlements);
      }

      setPlayers(await fetchPlayersFromSupabase());
      setPredictions(latestPredictions);
      setSettlements(await fetchSettlementsFromSupabase());
    };

    syncNewPlayer().catch((error) => {
      console.error('Failed to add player to Supabase', error);
      alert('Thêm người chơi thất bại. Kiểm tra quyền ghi bảng players trong Supabase.');
    });
  };

  // Handler to sync matches from API
  const handleSyncMatches = async () => {
    try {
      if (currentPlayer.role !== 'admin') {
        alert('Chỉ quản trị viên mới được đồng bộ kèo chấp.');
        return;
      }

      setIsSyncing(true);

      if (isSupabaseConfigured) {
        try {
          await invokeWorldCupSync();
          const [remotePlayers, remoteMatches, remotePredictions, remoteSettlements, remoteActivities] = await Promise.all([
            fetchPlayersFromSupabase(),
            fetchMatchesFromSupabase(),
            fetchPredictionsFromSupabase(),
            fetchSettlementsFromSupabase(),
            fetchActivitiesFromSupabase(),
          ]);
          const defaultPredictions = buildDefaultHomePredictions(remotePlayers, remoteMatches, remotePredictions);
          if (defaultPredictions.length > 0) {
            await Promise.all(defaultPredictions.map((prediction) => upsertPredictionToSupabase(prediction)));
          }
          setPlayers(remotePlayers);
          setMatches(remoteMatches);
          setPredictions(defaultPredictions.length > 0 ? await fetchPredictionsFromSupabase() : remotePredictions);
          setSettlements(remoteSettlements);
          setActivities(remoteActivities);
          return;
        } catch (error) {
          console.warn('Edge sync failed, falling back to browser sync', error);
        }
      }

      const apiMatches = await fetchWorldCupMatches();
      const existingMatchesById = new Map<string, Match>(matches.map((match) => [match.id, match]));
      const syncedMatches = apiMatches.map((apiMatch) => {
        const existingMatch = existingMatchesById.get(apiMatch.id);

        if (existingMatch?.handicapIsManual) {
          return {
            ...apiMatch,
            handicap: existingMatch.handicap,
            handicapIsManual: true,
            oddsUpdatedAt: existingMatch.oddsUpdatedAt,
          };
        }

        const shouldPreserveExistingHandicap =
          existingMatch &&
          existingMatch.handicap !== 0 &&
          (apiMatch.handicap === 0 || apiMatch.status === 'FINISHED');

        if (shouldPreserveExistingHandicap) {
          return {
            ...apiMatch,
            handicap: existingMatch.handicap,
            handicapIsManual: false,
            oddsUpdatedAt: existingMatch.oddsUpdatedAt,
          };
        }

        return {
          ...apiMatch,
          handicapIsManual: false,
        };
      });

      let latestPredictions = predictions;

      if (isSupabaseConfigured) {
        await upsertMatchesToSupabase(syncedMatches);

        latestPredictions = await fetchPredictionsFromSupabase();
        const defaultPredictions = buildDefaultHomePredictions(players, syncedMatches, latestPredictions);
        if (defaultPredictions.length > 0) {
          await Promise.all(defaultPredictions.map((prediction) => upsertPredictionToSupabase(prediction)));
          latestPredictions = await fetchPredictionsFromSupabase();
        }

        const syncedSettlements = buildSettlementsForFinishedMatches(syncedMatches, latestPredictions, { requirePredictionId: true });
        if (syncedSettlements.length > 0) {
          await upsertSettlementsToSupabase(syncedSettlements);
          setSettlements(await fetchSettlementsFromSupabase());
        }

        setPredictions(latestPredictions);
      }
      
      // Merge with existing real matches while preserving manual handicap overrides.
      setMatches((prevMatches) => {
        const realMatches = prevMatches.filter(m => m.id.startsWith('wc26_'));
        const merged = [...realMatches];
        
        syncedMatches.forEach(apiMatch => {
          const existingIdx = merged.findIndex(m => m.id === apiMatch.id);
          if (existingIdx >= 0) {
            merged[existingIdx] = apiMatch;
          } else {
            merged.push(apiMatch);
          }
        });

        if (!isSupabaseConfigured) {
          const defaultPredictions = buildDefaultHomePredictions(players, merged, predictions);
          if (defaultPredictions.length > 0) {
            setPredictions((prevPredictions) => [...prevPredictions, ...defaultPredictions]);
          }
        }

        return merged;
      });
      
      // Add activity log
      const logItem: ActivityFeedItem = {
        id: `act_${Date.now()}`,
        playerName: currentPlayer.name,
        actionText: 'synced',
        targetText: 'các trận World Cup',
        type: 'join_prediction',
        timeAgo: 'VỪA XONG',
      };
      setActivities(prev => [logItem, ...prev]);
    } catch (e) {
      console.error("Failed to sync matches", e);
      alert("Failed to sync matches. Check your API key or console for details.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateMatchHandicap = (matchId: string, handicap: number) => {
    if (currentPlayer.role !== 'admin') {
      alert('Chỉ quản trị viên mới được ghi đè kèo chấp.');
      return;
    }

    const targetMatch = matches.find((match) => match.id === matchId);
    if (!targetMatch) return;

    const updatedMatch: Match = {
      ...targetMatch,
      handicap,
      handicapIsManual: true,
      oddsUpdatedAt: new Date().toISOString(),
    };

    setMatches((prevMatches) => prevMatches.map((match) => (match.id === matchId ? updatedMatch : match)));

    if (isSupabaseConfigured) {
      upsertMatchesToSupabase([updatedMatch])
        .then(async () => {
          if (updatedMatch.status !== 'FINISHED') return;

          const latestPredictions = await fetchPredictionsFromSupabase();
          const recalculatedSettlements = buildSettlementsForFinishedMatches([updatedMatch], latestPredictions, { requirePredictionId: true });
          await upsertSettlementsToSupabase(recalculatedSettlements);
          setPredictions(latestPredictions);
          setSettlements(await fetchSettlementsFromSupabase());
        })
        .catch((error) => {
          console.error('Failed to sync manual handicap override to Supabase', error);
        });
    } else if (updatedMatch.status === 'FINISHED') {
      const recalculatedSettlements = buildSettlementsForFinishedMatches([updatedMatch], predictions);
      setSettlements((prevSettlements) => [
        ...prevSettlements.filter((settlement) => settlement.matchId !== matchId),
        ...recalculatedSettlements,
      ]);
    }
  };


  // Render subviews according to currently selected navigation tab
  const renderTabContent = () => {
    // If we have an active details match selected, we focus on the MatchDetails view!
    if (activeSelectedMatch) {
      return (
        <MatchDetails
          currentPlayer={currentPlayer}
          players={playersWithStats}
          match={activeSelectedMatch}
          predictions={scopedPredictions}
          onClose={() => setActiveSelectedMatch(null)}
        />
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            currentPlayer={currentPlayer}
            predictionPlayer={predictionPlayer}
            players={playersWithStats}
            matches={scopedMatches}
            predictions={scopedPredictions}
            activities={activities}
            onTogglePrediction={handleTogglePrediction}
            onToggleHopeStar={handleToggleHopeStar}
            onOpenMatchDetails={setActiveSelectedMatch}
            onSyncMatches={handleSyncMatches}
            isSyncing={isSyncing}
          />
        );
      case 'matches':
        return (
          <MatchList
            currentPlayer={currentPlayer}
            predictionPlayer={predictionPlayer}
            players={playersWithStats}
            matches={scopedMatches}
            predictions={scopedPredictions}
            onTogglePrediction={handleTogglePrediction}
            onToggleHopeStar={handleToggleHopeStar}
            onOverridePredictions={handleOverridePredictions}
            onOpenMatchDetails={setActiveSelectedMatch}
            onUpdateMatchHandicap={handleUpdateMatchHandicap}
          />
        );
      case 'leaderboard':
        return (
          <Leaderboard
            currentPlayer={currentPlayer}
            players={playersWithStats}
            matches={scopedMatches}
            predictions={scopedPredictions}
            settlements={scopedSettlements}
          />
        );
      case 'profile':
        if (currentPlayer.role !== 'admin') return null;

        return (
          <IdentitySelector
            currentPlayer={currentPlayer}
            players={playersWithStats}
            onAddPlayer={handleAddPlayer}
          />
        );
      default:
        return null;
    }
  };

  if (!currentPlayer.id) {
    return (
      <Login
        players={playersWithStats}
        isLoading={isLoadingRealData}
        onLogin={handleSelectPlayer}
      />
    );
  }

  return (
    <div className="flex max-w-[1240px] mx-auto min-h-screen relative">
      {/* Sidebar (Desktop Shell nav & Mobile Bottom nav included) */}
      <Sidebar
        currentPlayer={currentPlayer}
        currentTab={activeSelectedMatch ? 'matches' : currentTab}
        setCurrentTab={(tab) => {
          // Reset match details when switching main views
          setActiveSelectedMatch(null);
          setCurrentTab(tab);
        }}
        onLogout={handleLogout}
      />

      {/* Main Content scrollable container, desktop with proper margins relative to sidebar */}
      <main className="flex-1 lg:ml-64 px-4 pt-16 pb-24 lg:pt-8 lg:pb-8 max-w-full overflow-x-hidden">
        <div className="mb-6 flex justify-end">
          <label className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted">
            Mùa giải
            <select
              value={selectedCompetitionId}
              onChange={(event) => setSelectedCompetitionId(event.target.value)}
              className="bg-[#102133] border border-white/10 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary uppercase tracking-wider"
            >
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id} className="bg-[#102133]">
                  {competition.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {renderTabContent()}
      </main>
    </div>
  );
}
