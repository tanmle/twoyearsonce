import { Player, Match, Prediction, ActivityFeedItem } from '../types';
import { Trophy, Coins, CheckSquare, Flame, CheckCircle, HelpCircle, Activity } from 'lucide-react';

interface DashboardProps {
  currentPlayer: Player;
  players: Player[];
  matches: Match[];
  predictions: Prediction[];
  activities: ActivityFeedItem[];
  onTogglePrediction: (matchId: string, choice: 'HOME' | 'AWAY') => void;
  onOpenMatchDetails: (match: Match) => void;
  onSyncMatches: () => void;
  isSyncing: boolean;
}

export default function Dashboard({
  currentPlayer,
  players,
  matches,
  predictions,
  activities,
  onTogglePrediction,
  onOpenMatchDetails,
  onSyncMatches,
  isSyncing,
}: DashboardProps) {
  // Find matches for today and tomorrow
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayAfterTomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  const upcomingMatches = matches.filter(m => {
    const d = new Date(m.date);
    return m.status !== 'FINISHED' && d >= todayStart && d < dayAfterTomorrowStart;
  });

  const displayMatches = upcomingMatches.length > 0
    ? upcomingMatches
    : matches.filter(m => m.status !== 'FINISHED').slice(0, 3);

  // Calculate ranks
  // Ranks are ordered by penalty VND ascending (lowest penalty is better, rank 1, 2, 3...)
  const sortedPlayers = [...players].sort((a, b) => a.totalPenaltyVnd - b.totalPenaltyVnd);
  const currentRankIndex = sortedPlayers.findIndex((p) => p.id === currentPlayer.id);
  const currentRank = currentRankIndex !== -1 ? currentRankIndex + 1 : 4;

  // Personal predictions count for current player
  const playerPredictions = predictions.filter((p) => p.playerId === currentPlayer.id);
  const predictionsCount = playerPredictions.length;

  return (
    <div className="space-y-8">
      {/* Welcome Header editorial-styled */}
      <div className="border-white/10 border-b pb-6 flex justify-between items-end">
        <div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
            FIFA World Cup 2026 • United Champions Glow
          </span>
          <h2 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1">
            chào mừng, <span className="text-brand-primary not-italic font-bold">{currentPlayer.name}</span>
          </h2>
          <p className="text-xs text-text-muted mt-2 font-mono uppercase tracking-widest">
            FIFA Stadium Ledger • Section 26 • Stadium Slip Center
          </p>
        </div>
        <button
          onClick={onSyncMatches}
          disabled={isSyncing}
          className="bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/30 px-4 py-2 rounded-none font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center space-x-2"
        >
          {isSyncing ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full" />
          ) : (
            <Activity className="w-4 h-4" />
          )}
          <span>{isSyncing ? 'SYNCING...' : 'SYNC DATA'}</span>
        </button>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Stats and Hot Match */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Stats Summary Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Rank Card */}
            <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none flex flex-col justify-between hover:border-brand-primary/50 transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-none">
                  <Trophy className="w-4.5 h-4.5" />
                </div>
                <span className="text-[9px] font-mono tracking-widest text-brand-primary uppercase">
                  world standing
                </span>
              </div>
              <div className="mt-6">
                <p className="font-mono text-[9px] text-text-muted uppercase tracking-widest">
                  TOURNAMENT STANDING
                </p>
                <p className="font-display italic font-black text-4xl text-white mt-1">
                  #{currentRank} <span className="text-[10px] font-mono not-italic tracking-normal text-text-muted">/ {players.length}</span>
                </p>
              </div>
            </div>

            {/* Penalty Card */}
            <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none flex flex-col justify-between hover:border-status-lose/50 transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-status-lose/10 text-status-lose rounded-none">
                  <Coins className="w-4.5 h-4.5" />
                </div>
                <span className="text-[9px] font-mono tracking-widest text-[#FF265B] uppercase">
                  penalty liabilities
                </span>
              </div>
              <div className="mt-6">
                <p className="font-mono text-[9px] text-text-muted uppercase tracking-widest">
                  STADIUM DEBTS ACCRUED
                </p>
                <p className="font-display font-bold text-2xl text-status-lose mt-1 tracking-tight">
                  {currentPlayer.totalPenaltyVnd.toLocaleString('vi-VN')}
                  <span className="text-[10px] font-mono ml-1 text-text-muted uppercase tracking-widest font-bold"> VND</span>
                </p>
              </div>
            </div>

            {/* Predictions Card */}
            <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none flex flex-col justify-between hover:border-white/30 transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-white/5 text-white rounded-none">
                  <CheckSquare className="w-4.5 h-4.5" />
                </div>
                <span className="text-[9px] font-mono tracking-widest text-text-muted uppercase">
                  ACTIVE SLIPS
                </span>
              </div>
              <div className="mt-6">
                <p className="font-mono text-[9px] text-text-muted uppercase tracking-widest">
                  COMMITTED PREDICTIONS
                </p>
                <p className="font-display italic font-black text-4xl text-white mt-1">
                  {predictionsCount} <span className="text-[10px] font-mono not-italic tracking-normal text-text-muted">Archives</span>
                </p>
              </div>
            </div>
          </div>

          {/* Matches List (Today/Tomorrow or Next Big Matches) */}
          {displayMatches.length > 0 ? (
            <div className="space-y-6">
              {displayMatches.map((match) => {
                const matchPrediction = predictions.find(
                  (p) => p.matchId === match.id && p.playerId === currentPlayer.id
                );

                return (
                  <div key={match.id} className="bg-[#0A1622] border border-white/10 rounded-none overflow-hidden hover:border-white/20 transition-all duration-300">
                    {/* Card Header banner */}
                    <div className="bg-[#102133] border-b border-white/10 p-4 flex justify-between items-center">
                      <span className="font-mono text-[10px] text-brand-primary tracking-widest font-bold flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-brand-primary animate-pulse" />
                        FIFA 2026 MATCH
                      </span>
                      <span className="font-mono text-[9px] text-text-muted bg-white/5 px-2 py-1 uppercase tracking-widest border border-white/5">
                        {match.time} • {match.date}
                      </span>
                    </div>

                    {/* Scoreboard Body */}
                    <div className="p-6 flex flex-col gap-6">
                      <div 
                        onClick={() => onOpenMatchDetails(match)}
                        className="flex flex-col sm:flex-row justify-around items-center cursor-pointer p-6 border border-white/5 bg-[#0a0a0a] hover:bg-[#151515] hover:border-brand-primary/20 transition-all duration-300 group gap-6"
                      >
                        {/* Home Team */}
                        <div className="flex flex-col items-center gap-3 flex-1">
                          <div className="w-16 h-16 rounded-none bg-white/5 p-1 flex items-center justify-center border border-white/10 group-hover:border-brand-primary/40 transition-colors">
                            <img
                              src={match.homeLogo}
                              alt={match.homeTeam}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 object-contain"
                            />
                          </div>
                          <span className="font-sans uppercase tracking-widest font-bold text-xs text-white text-center truncate w-full group-hover:text-brand-primary transition-colors">
                            {match.homeTeam}
                          </span>
                          <span className="text-[8px] font-mono text-text-muted tracking-widest uppercase">TEAM ONE [HOME]</span>
                        </div>

                        {/* VS & Handicap Information */}
                        <div className="flex flex-col items-center justify-center min-w-[120px] py-2">
                          <span className="text-[10px] font-mono tracking-widest text-brand-secondary uppercase font-bold">
                            HANDICAP RATIO
                          </span>
                          <span className="font-display italic font-black text-4xl text-white tracking-widest mt-1">
                            {match.handicap > 0 ? `+${match.handicap}` : match.handicap}
                          </span>
                          <p className="text-[9px] text-text-muted font-mono uppercase tracking-widest mt-2 border-b border-white/10 pb-0.5 group-hover:text-brand-primary transition-colors">
                            Inspect Match details →
                          </p>
                        </div>

                        {/* Away Team */}
                        <div className="flex flex-col items-center gap-3 flex-1">
                          <div className="w-16 h-16 rounded-none bg-white/5 p-1 flex items-center justify-center border border-white/10 group-hover:border-brand-primary/40 transition-colors">
                            <img
                              src={match.awayLogo}
                              alt={match.awayTeam}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 object-contain"
                            />
                          </div>
                          <span className="font-sans uppercase tracking-widest font-bold text-xs text-white text-center truncate w-full group-hover:text-brand-primary transition-colors">
                            {match.awayTeam}
                          </span>
                          <span className="text-[8px] font-mono text-text-muted tracking-widest uppercase">TEAM TWO [AWAY]</span>
                        </div>
                      </div>

                      {/* Prediction Toggles panel */}
                      <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
                        <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                          <HelpCircle className="w-4 h-4 text-brand-primary" />
                          <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest font-bold">
                            SUBMIT YOUR STADIUM SLIP:
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Pred HOME */}
                          <button
                            onClick={() => onTogglePrediction(match.id, 'HOME')}
                            className={`flex items-center justify-center gap-2 py-4 rounded-none border font-sans uppercase tracking-widest text-xs transition-all cursor-pointer ${
                              matchPrediction?.choice === 'HOME'
                                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary active-predict-glow scale-[1.01]'
                                : 'border-white/10 hover:border-brand-primary/60 text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {matchPrediction?.choice === 'HOME' && <CheckCircle className="w-3.5 h-3.5 text-brand-primary" />}
                            <span>{match.homeTeam} label</span>
                          </button>

                          {/* Pred AWAY */}
                          <button
                            onClick={() => onTogglePrediction(match.id, 'AWAY')}
                            className={`flex items-center justify-center gap-2 py-4 rounded-none border font-sans uppercase tracking-widest text-xs transition-all cursor-pointer ${
                              matchPrediction?.choice === 'AWAY'
                                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary active-predict-glow scale-[1.01]'
                                : 'border-white/10 hover:border-brand-primary/60 text-text-muted hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {matchPrediction?.choice === 'AWAY' && <CheckCircle className="w-3.5 h-3.5 text-brand-primary" />}
                            <span>{match.awayTeam} label</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#0A1622] border border-white/10 rounded-none p-8 flex items-center justify-center">
              <span className="text-text-muted font-mono uppercase tracking-widest text-xs">No matches found. Please sync data.</span>
            </div>
          )}

        </div>

        {/* Right Side: Leaderboard Preview & Recent Activities */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Rankings Preview */}
          <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
              <h3 className="font-display italic font-bold text-lg text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-brand-primary" />
                standings snippet
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {sortedPlayers.slice(0, 3).map((player, idx) => {
                const isUser = player.id === currentPlayer.id;
                
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-none transition-all ${
                      isUser
                        ? 'border border-brand-primary bg-brand-primary/5'
                        : 'border border-white/5 bg-[#040D17] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs w-4 text-center text-text-muted font-bold">
                        {idx + 1}
                      </span>
                      <img
                        src={player.avatar}
                        alt={player.name}
                        referrerPolicy="no-referrer"
                        className={`w-7 h-7 rounded-none border object-cover ${
                          idx === 0 ? 'border-brand-primary' : 'border-white/10'
                        }`}
                      />
                      <span className={`text-xs uppercase tracking-wider truncate ${isUser ? 'font-bold text-white' : 'text-text-muted'}`}>
                        {player.name} {isUser && <span className="text-[9px] font-mono text-brand-primary">(You)</span>}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-brand-primary">
                      {player.totalPenaltyVnd === 0 ? '0 VND' : `${player.totalPenaltyVnd.toLocaleString('vi-VN')} VND`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Timeline Feed */}
          <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-5 pb-2 border-b border-white/10">
                <h3 className="font-display italic font-bold text-lg text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-primary" />
                  stadia telegraphs
                </h3>
              </div>

              <div className="flex flex-col gap-4 relative pl-4 py-1">
                {/* Live Timeline Line overlay */}
                <div className="absolute left-[3px] top-2 bottom-2 w-px bg-white/10"></div>

                {activities.slice(0, 4).map((feedItem, index) => {
                  return (
                    <div key={feedItem.id || index} className="relative flex gap-3 z-10 select-none">
                      {/* Circle Bullet icon color code */}
                      <span className={`absolute -left-[16px] top-1.5 w-1.5 h-1.5 rounded-none  ${
                        feedItem.statusType === 'LOSE_DOUBLE'
                          ? 'bg-status-lose'
                          : feedItem.statusType === 'LOSE_HALF'
                          ? 'bg-status-lose-half'
                          : feedItem.type === 'change_prediction'
                          ? 'bg-brand-secondary'
                          : 'bg-brand-primary'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-xs text-text-muted leading-relaxed">
                          <span className="font-bold text-white pr-1 select-all">{feedItem.playerName}</span>
                          {feedItem.actionText}
                          <span className={`font-bold pl-1 ${
                            feedItem.statusType === 'LOSE_DOUBLE'
                              ? 'text-status-lose uppercase font-mono text-[10px]'
                              : feedItem.statusType === 'LOSE_HALF'
                              ? 'text-status-lose-half'
                              : 'text-brand-primary'
                          }`}>
                            {feedItem.targetText}
                          </span>
                        </p>
                        <p className="text-[8px] font-mono font-bold text-text-muted mt-1 uppercase select-none tracking-widest">
                          {feedItem.timeAgo}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 mt-6 flex items-center justify-between text-[10px] font-mono text-text-muted select-none">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-brand-primary animate-pulse"></span>
                STADIA BROADCAST
              </span>
              <span>UNITED 2026 • EDITION</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
