import { useState, useEffect } from 'react';
import { Player, Match, Prediction, ActivityFeedItem } from './types';
import {
  INITIAL_PLAYERS,
  INITIAL_MATCHES,
  INITIAL_PREDICTIONS,
  INITIAL_FEED,
} from './data';
import { fetchWorldCupMatches } from './services/api';

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MatchList from './components/MatchList';
import Leaderboard from './components/Leaderboard';
import MatchDetails from './components/MatchDetails';
import IdentitySelector from './components/IdentitySelector';

export default function App() {
  // Tab navigation state
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  
  // Players state with persistent initialization
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('pred_league_players');
    return saved ? JSON.parse(saved) : INITIAL_PLAYERS;
  });

  // Current logged in user ID state with persistent initialization
  const [currentPlayerId, setCurrentPlayerId] = useState<string>(() => {
    const saved = localStorage.getItem('pred_league_current_player_id');
    return saved ? JSON.parse(saved) : 'huy'; // Default is 'huy' as in screenshots
  });

  // Matches state with persistent initialization
  const [matches, setMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem('pred_league_matches');
    return saved ? JSON.parse(saved) : INITIAL_MATCHES;
  });

  // Predictions state with persistent initialization
  const [predictions, setPredictions] = useState<Prediction[]>(() => {
    const saved = localStorage.getItem('pred_league_predictions');
    return saved ? JSON.parse(saved) : INITIAL_PREDICTIONS;
  });

  // Activity Feed state with persistent initialization
  const [activities, setActivities] = useState<ActivityFeedItem[]>(() => {
    const saved = localStorage.getItem('pred_league_activities');
    return saved ? JSON.parse(saved) : INITIAL_FEED;
  });

  // Active match for detail report popup overlay
  const [activeSelectedMatch, setActiveSelectedMatch] = useState<Match | null>(null);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync to outer localStorage to persist sandbox changes reliably
  useEffect(() => {
    localStorage.setItem('pred_league_players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('pred_league_current_player_id', JSON.stringify(currentPlayerId));
  }, [currentPlayerId]);

  useEffect(() => {
    localStorage.setItem('pred_league_matches', JSON.stringify(matches));
  }, [matches]);

  useEffect(() => {
    localStorage.setItem('pred_league_predictions', JSON.stringify(predictions));
  }, [predictions]);

  useEffect(() => {
    localStorage.setItem('pred_league_activities', JSON.stringify(activities));
  }, [activities]);

  // Find actualPlayer object
  const currentPlayer = players.find((p) => p.id === currentPlayerId) || players[0];

  // Handler to set prediction choice (Home/Away Voted)
  const handleTogglePrediction = (matchId: string, choice: 'HOME' | 'AWAY') => {
    const matchItem = matches.find((m) => m.id === matchId);
    if (!matchItem || matchItem.status === 'FINISHED') return;

    // Remove existing prediction for this player-match combo
    const filteredPreds = predictions.filter(
      (p) => !(p.matchId === matchId && p.playerId === currentPlayerId)
    );

    const newPrediction: Prediction = {
      matchId,
      playerId: currentPlayerId,
      choice,
      timestamp: 'Vừa xong',
    };

    setPredictions([...filteredPreds, newPrediction]);

    // Insert new timeline log item
    const logItem: ActivityFeedItem = {
      id: `act_${Date.now()}`,
      playerName: currentPlayer.name,
      actionText: 'changed prediction to',
      targetText: choice === 'HOME' ? matchItem.homeTeam : matchItem.awayTeam,
      type: 'change_prediction',
      timeAgo: 'VỪA XONG',
    };

    setActivities([logItem, ...activities]);
  };

  // Handler to switch player identity
  const handleSelectPlayer = (player: Player) => {
    setCurrentPlayerId(player.id);
    // When switching player, we stay on same view or transition directly
    setCurrentTab('dashboard');
  };

  // Handler to reset application statistics
  const handleResetMatches = () => {
    localStorage.removeItem('pred_league_players');
    localStorage.removeItem('pred_league_current_player_id');
    localStorage.removeItem('pred_league_matches');
    localStorage.removeItem('pred_league_predictions');
    localStorage.removeItem('pred_league_activities');
    
    setPlayers(INITIAL_PLAYERS);
    setCurrentPlayerId('huy');
    setMatches(INITIAL_MATCHES);
    setPredictions(INITIAL_PREDICTIONS);
    setActivities(INITIAL_FEED);
    setCurrentTab('dashboard');
    setActiveSelectedMatch(null);
  };

  // Handler to sync matches from API
  const handleSyncMatches = async () => {
    try {
      setIsSyncing(true);
      const apiMatches = await fetchWorldCupMatches();
      
      // Merge with existing matches but remove the initial dummy data and old 2022 test data
      setMatches((prevMatches) => {
        // Filter out dummy data ('m...') and old 2022 data ('wc_...'). Keep only 'wc26_'
        const realMatches = prevMatches.filter(m => m.id.startsWith('wc26_'));
        const merged = [...realMatches];
        
        apiMatches.forEach(apiMatch => {
          const existingIdx = merged.findIndex(m => m.id === apiMatch.id);
          if (existingIdx >= 0) {
            // Keep existing handicap if it's non-zero
            const existingMatch = merged[existingIdx];
            merged[existingIdx] = {
              ...apiMatch,
              handicap: apiMatch.handicap !== 0 ? apiMatch.handicap : existingMatch.handicap
            };
          } else {
            merged.push(apiMatch);
          }
        });
        return merged;
      });
      
      // Add activity log
      const logItem: ActivityFeedItem = {
        id: `act_${Date.now()}`,
        playerName: currentPlayer.name,
        actionText: 'synced',
        targetText: 'World Cup Matches',
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

  // Auto-sync matches on initial load
  useEffect(() => {
    // We can auto-sync since the open-source API has no strict rate limits
    // We only want to trigger it once on mount
    handleSyncMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highly robust result calculator for Sandbox simulator
  const handleUpdateMatchStatus = (
    matchId: string,
    status: 'FINISHED',
    homeGoals: number,
    awayGoals: number
  ) => {
    // 1. Update the match goals and status
    const updatedMatches = matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          status,
          homeGoals,
          awayGoals,
        };
      }
      return m;
    });

    setMatches(updatedMatches);

    // Get target match
    const targetMatch = matches.find((m) => m.id === matchId);
    if (!targetMatch) return;

    // Applied handicap calculations: Home Goals + Handicap vs Away Goals
    // E.g. home final = 2, handicap = -0.5 => 1.5. If away final = 1, home wins (1.5 > 1).
    const homeGoalsCorrected = homeGoals + targetMatch.handicap;
    const isHomeWin = homeGoalsCorrected > awayGoals;
    const isDraw = homeGoalsCorrected === awayGoals;

    // Find predictions for this match to compute penalties for players
    const matchPredictions = predictions.filter((p) => p.matchId === matchId);

    // Copy player entities to update stats
    const updatedPlayers = players.map((player) => {
      // Find what this player predicted
      const pPred = matchPredictions.find((pred) => pred.playerId === player.id);
      
      let revisedPlayer = { ...player };

      if (pPred?.choice) {
        // Increment prediction counts
        revisedPlayer.totalPredictionsCount += 1;

        if (pPred.choice === 'HOME') {
          if (isHomeWin) {
            revisedPlayer.notLoseCount += 1; // +0 Penalty
          } else if (isDraw) {
            revisedPlayer.loseHalfCount += 1; // Lose half (0.5 pts - 5,000 VND)
            revisedPlayer.totalPenaltyVnd += 5000;
          } else {
            revisedPlayer.loseCount += 1; // Lose standard (1.5 pts - 10,000 VND)
            revisedPlayer.totalPenaltyVnd += 10000;
          }
        } else if (pPred.choice === 'AWAY') {
          if (!isHomeWin && !isDraw) {
            revisedPlayer.notLoseCount += 1; // +0 Penalty
          } else if (isDraw) {
            revisedPlayer.loseHalfCount += 1; // Lose half (0.5 pts - 5,000 VND)
            revisedPlayer.totalPenaltyVnd += 5000;
          } else {
            // Away lose can be double risk if opposing handicap
            revisedPlayer.loseDoubleCount += 1; // Lose double (2.0 pts - 20,000 VND)
            revisedPlayer.totalPenaltyVnd += 20000;
          }
        }
      }
      
      return revisedPlayer;
    });

    setPlayers(updatedPlayers);

    // Generate neat activities report for each participant
    const brandNewLogs: ActivityFeedItem[] = matchPredictions.map((pred, i) => {
      const plyr = players.find((p) => p.id === pred.playerId);
      const name = plyr ? plyr.name : 'Người chơi';

      let penaltyLabel: 'WIN' | 'LOSE_HALF' | 'LOSE' | 'LOSE_DOUBLE' = 'WIN';
      let outcomeLabel = 'not_lose';

      if (pred.choice === 'HOME') {
        if (isHomeWin) {
          penaltyLabel = 'WIN';
          outcomeLabel = 'not_lose';
        } else if (isDraw) {
          penaltyLabel = 'LOSE_HALF';
          outcomeLabel = 'lose_half';
        } else {
          penaltyLabel = 'LOSE';
          outcomeLabel = 'lose';
        }
      } else if (pred.choice === 'AWAY') {
        if (!isHomeWin && !isDraw) {
          penaltyLabel = 'WIN';
          outcomeLabel = 'not_lose';
        } else if (isDraw) {
          penaltyLabel = 'LOSE_HALF';
          outcomeLabel = 'lose_half';
        } else {
          penaltyLabel = 'LOSE_DOUBLE';
          outcomeLabel = 'lose_double';
        }
      }

      return {
        id: `sim_log_${Date.now()}_${i}`,
        playerName: name,
        actionText: 'received prediction payout status',
        targetText: outcomeLabel.toUpperCase(),
        type: 'penalty',
        statusType: penaltyLabel,
        timeAgo: 'VỪA XONG',
      } as ActivityFeedItem;
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
          players={players}
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
            players={players}
            matches={matches}
            predictions={predictions}
            activities={activities}
            onTogglePrediction={handleTogglePrediction}
            onOpenMatchDetails={setActiveSelectedMatch}
            onSyncMatches={handleSyncMatches}
            isSyncing={isSyncing}
          />
        );
      case 'matches':
        return (
          <MatchList
            currentPlayer={currentPlayer}
            players={players}
            matches={matches}
            predictions={predictions}
            onTogglePrediction={handleTogglePrediction}
            onOpenMatchDetails={setActiveSelectedMatch}
            onUpdateMatchStatus={handleUpdateMatchStatus}
            onResetMatches={handleResetMatches}
          />
        );
      case 'leaderboard':
        return (
          <Leaderboard
            currentPlayer={currentPlayer}
            players={players}
            onSelectPlayer={handleSelectPlayer}
          />
        );
      case 'profile':
        return (
          <IdentitySelector
            currentPlayer={currentPlayer}
            players={players}
            onSelectPlayer={handleSelectPlayer}
          />
        );
      default:
        return null;
    }
  };

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
        onLogout={handleResetMatches}
      />

      {/* Main Content scrollable container, desktop with proper margins relative to sidebar */}
      <main className="flex-1 lg:ml-64 px-4 pt-16 pb-24 lg:pt-8 lg:pb-8 max-w-full overflow-x-hidden">
        {renderTabContent()}
      </main>
    </div>
  );
}
