import { useState, useEffect } from 'react';
import { Player, Match, Prediction, ActivityFeedItem, Settlement } from './types';
import { fetchWorldCupMatches } from './services/api';
import { getOutcomeKey, settlePrediction } from './domain/settlement';
import { applyPlayerStats } from './domain/playerStats';
import { isPredictionLocked } from './domain/predictionLock';
import { clearBeerCupLocalState, loadJson, LOCAL_STORAGE_KEYS, saveJson } from './storage/localStore';
import { isSupabaseConfigured } from './lib/supabase';
import {
  fetchActivitiesFromSupabase,
  fetchMatchesFromSupabase,
  fetchPlayersFromSupabase,
  fetchPredictionsFromSupabase,
  fetchSettlementsFromSupabase,
  insertActivityToSupabase,
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
  existingPredictions: Prediction[]
) {
  const defaults: Prediction[] = [];
  const openMatches = matches.filter((match) => match.status !== 'FINISHED');

  openMatches.forEach((match) => {
    players.forEach((player) => {
      const alreadyPredicted = existingPredictions.some(
        (prediction) => prediction.matchId === match.id && prediction.playerId === player.id
      );

      if (!alreadyPredicted) {
        defaults.push({
          matchId: match.id,
          playerId: player.id,
          choice: 'HOME',
          timestamp: 'Mặc định chọn chủ nhà',
          hopeStar: false,
        });
      }
    });
  });

  return defaults;
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
        status: settlement.status,
        penaltyVnd: settlement.penaltyVnd,
      }];
    });
  });
}

export default function App() {
  // Tab navigation state
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  
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

  // Sync to outer localStorage to persist sandbox changes reliably
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
        const [remotePlayers, remoteMatches, remotePredictions, remoteSettlements, remoteActivities] = await Promise.all([
          fetchPlayersFromSupabase(),
          fetchMatchesFromSupabase(),
          fetchPredictionsFromSupabase(),
          fetchSettlementsFromSupabase(),
          fetchActivitiesFromSupabase(),
        ]);

        if (!isMounted) return;

        const defaultPredictions = buildDefaultHomePredictions(remotePlayers, remoteMatches, remotePredictions);
        const predictionsWithDefaults = [...remotePredictions, ...defaultPredictions];

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

  // Find actualPlayer object
  const playersWithStats = applyPlayerStats(players, predictions, settlements);
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

  // Handler to reset application statistics
  const handleResetMatches = () => {
    clearBeerCupLocalState();
    
    setPlayers([]);
    setCurrentPlayerId('');
    setPredictionPlayerId('');
    setMatches([]);
    setPredictions([]);
    setActivities([]);
    setCurrentTab('dashboard');
    setActiveSelectedMatch(null);
  };

  const handleLogout = () => {
    setCurrentPlayerId('');
    setPredictionPlayerId('');
    setCurrentTab('dashboard');
    setActiveSelectedMatch(null);
  };

  // Handler to sync matches from API
  const handleSyncMatches = async () => {
    try {
      if (currentPlayer.role !== 'admin') {
        alert('Chỉ quản trị viên mới được đồng bộ kèo chấp.');
        return;
      }

      setIsSyncing(true);
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
      upsertMatchesToSupabase([updatedMatch]).catch((error) => {
        console.error('Failed to sync manual handicap override to Supabase', error);
      });
    }
  };

  // Sandbox result calculator. Uses shared settlement rules so the UI and backend can agree.
  const handleUpdateMatchStatus = (
    matchId: string,
    status: 'FINISHED',
    homeGoals: number,
    awayGoals: number
  ) => {
    const targetMatch = matches.find((m) => m.id === matchId);
    if (!targetMatch) return;

    const settledMatch: Match = {
      ...targetMatch,
      status,
      homeGoals,
      awayGoals,
    };

    setMatches(matches.map((m) => (m.id === matchId ? settledMatch : m)));

    if (isSupabaseConfigured) {
      upsertMatchesToSupabase([settledMatch])
        .then(async () => {
          const latestPredictions = await fetchPredictionsFromSupabase();
          const newSettlements = buildSettlementsForFinishedMatches([settledMatch], latestPredictions, { requirePredictionId: true });
          await upsertSettlementsToSupabase(newSettlements);
          setPredictions(latestPredictions);
          setSettlements(await fetchSettlementsFromSupabase());
        })
        .catch((error) => {
          console.error('Failed to sync manual match result settlement to Supabase', error);
        });
    } else {
      const newSettlements = buildSettlementsForFinishedMatches([settledMatch], predictions);
      setSettlements((prevSettlements) => [
        ...prevSettlements.filter((settlement) => settlement.matchId !== matchId),
        ...newSettlements,
      ]);
    }

    const matchPredictions = predictions.filter((p) => p.matchId === matchId);

    const brandNewLogs: ActivityFeedItem[] = matchPredictions.map((pred, i) => {
      const player = players.find((p) => p.id === pred.playerId);
      const settlement = settlePrediction(settledMatch, pred);
      const statusType = settlement.status === 'SETTLE_PENDING' ? 'WIN' : settlement.status;

      return {
        id: `sim_log_${Date.now()}_${i}`,
        playerName: player ? player.name : 'Người chơi',
        actionText: 'nhận kết quả dự đoán',
        targetText: getOutcomeKey(settlement.status).toUpperCase(),
        type: 'penalty',
        statusType,
        timeAgo: 'VỪA XONG',
      };
    });

    setActivities([...brandNewLogs, ...activities]);
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
          predictions={predictions}
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
            matches={matches}
            predictions={predictions}
            activities={activities}
            onSelectPredictionPlayer={setPredictionPlayerId}
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
            matches={matches}
            predictions={predictions}
            onSelectPredictionPlayer={setPredictionPlayerId}
            onTogglePrediction={handleTogglePrediction}
            onToggleHopeStar={handleToggleHopeStar}
            onOpenMatchDetails={setActiveSelectedMatch}
            onUpdateMatchStatus={handleUpdateMatchStatus}
            onUpdateMatchHandicap={handleUpdateMatchHandicap}
            onResetMatches={handleResetMatches}
          />
        );
      case 'leaderboard':
        return (
          <Leaderboard
            currentPlayer={currentPlayer}
            players={playersWithStats}
            onSelectPlayer={handleSelectPlayer}
          />
        );
      case 'profile':
        if (currentPlayer.role !== 'admin') return null;

        return (
          <IdentitySelector
            currentPlayer={currentPlayer}
            players={playersWithStats}
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
        {renderTabContent()}
      </main>
    </div>
  );
}
