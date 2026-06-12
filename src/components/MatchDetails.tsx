import { Player, Match, Prediction } from '../types';
import { Calendar, User, CheckCircle2, XCircle, Users, BarChart3, Minimize2, MapPin, Trophy } from 'lucide-react';

interface MatchDetailsProps {
  currentPlayer: Player;
  players: Player[];
  match: Match;
  predictions: Prediction[];
  onClose: () => void;
}

export default function MatchDetails({
  currentPlayer,
  players,
  match,
  predictions,
  onClose,
}: MatchDetailsProps) {
  // Find predictions for this match
  const matchPredictions = predictions.filter((p) => p.matchId === match.id);

  // Group home vs away prediction counts
  const homeCount = matchPredictions.filter((p) => p.choice === 'HOME').length;
  const awayCount = matchPredictions.filter((p) => p.choice === 'AWAY').length;
  const totalVotesCount = homeCount + awayCount;

  // Percentage calculations
  const homePercent = totalVotesCount > 0 ? Math.round((homeCount / totalVotesCount) * 100) : 50;
  const awayPercent = totalVotesCount > 0 ? 100 - homePercent : 50;

  // Filter a nice list of participants details
  const participantsList = matchPredictions.map((pred) => {
    const player = players.find((p) => p.id === pred.playerId);
    return {
      playerId: pred.playerId,
      name: player ? player.name : 'Unknown Player',
      avatar: player ? player.avatar : '',
      choice: pred.choice,
      timestamp: pred.timestamp,
    };
  });

  // Calculate user outcome if match is finished or live
  const currentUserPred = matchPredictions.find((p) => p.playerId === currentPlayer.id);
  const isFinished = match.status === 'FINISHED';
  
  // Decide prediction outcome
  let outcomeStatus: 'WIN' | 'LOSE_HALF' | 'LOSE' | 'LOSE_DOUBLE' | 'PENDING' = 'PENDING';
  let penaltyVndAccrued = 0;

  if (isFinished && match.homeGoals !== undefined && match.awayGoals !== undefined) {
    const homeGoalsCorrected = match.homeGoals + match.handicap; // Handicap is applied to home goals!
    const isHomeWin = homeGoalsCorrected > match.awayGoals;
    const isDraw = homeGoalsCorrected === match.awayGoals;

    if (currentUserPred?.choice) {
      if (currentUserPred.choice === 'HOME') {
        if (isHomeWin) {
          outcomeStatus = 'WIN';
          penaltyVndAccrued = 0;
        } else if (isDraw) {
          outcomeStatus = 'LOSE_HALF';
          penaltyVndAccrued = 5000;
        } else {
          outcomeStatus = 'LOSE';
          penaltyVndAccrued = 10000;
        }
      } else if (currentUserPred.choice === 'AWAY') {
        if (!isHomeWin && !isDraw) {
          outcomeStatus = 'WIN';
          penaltyVndAccrued = 0;
        } else if (isDraw) {
          outcomeStatus = 'LOSE_HALF';
          penaltyVndAccrued = 5000;
        } else {
          outcomeStatus = 'LOSE_DOUBLE';
          penaltyVndAccrued = 20000;
        }
      }
    }
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Detail header box wrapper close trigger */}
      <div className="flex justify-between items-end bg-[#0A1622] border-b border-white/10 pb-6 p-1">
        <div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
            FIFA Spec Sheet • Arena Match Details
          </span>
          <h3 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1">
            chi tiết kì đấu
          </h3>
          <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
            Consensus Dashboard & Match Report
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-5 py-3 rounded-none border border-brand-primary bg-[#102133] hover:bg-brand-primary text-brand-primary hover:text-black transition-all text-[10px] font-mono tracking-widest uppercase select-none cursor-pointer"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Đóng trang</span>
        </button>
      </div>

      {/* Match Score info Header cards */}
      <section className="relative overflow-hidden rounded-none border border-white/10 bg-[#0A1622] p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          
          {/* Home team */}
          <div className="flex flex-col items-center md:items-end flex-1 text-center md:text-right">
            <div className="w-16 h-16 bg-[#040D17] border border-white/10 rounded-none flex items-center justify-center mb-4 p-1">
              <img
                src={match.homeLogo}
                alt={match.homeTeam}
                className="w-12 h-12 object-contain"
              />
            </div>
            <h2 className="font-sans font-black text-xl text-white uppercase tracking-wider">{match.homeTeam}</h2>
            <span className="text-[8px] font-mono text-text-muted mt-1 uppercase tracking-widest font-bold select-none">HOME</span>
          </div>

          {/* Scores indicator */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className={`font-mono text-[9px] px-3.5 py-1 rounded-none font-bold select-none tracking-widest ${
              match.status === 'FINISHED' ? 'bg-[#222] text-white border border-white/15' : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 animate-pulse'
            }`}>
              {match.status === 'FINISHED' ? 'FINISHED' : match.status === 'LIVE' ? 'LIVE' : 'UPCOMING'}
            </div>
            
            <div className="flex items-center gap-5">
              <span className="font-display italic font-black text-5xl text-white tracking-widest">
                {match.status !== 'UPCOMING' ? match.homeGoals : '—'}
              </span>
              <span className="text-xl font-bold select-none text-white/45">:</span>
              <span className="font-display italic font-black text-5xl text-white tracking-widest">
                {match.status !== 'UPCOMING' ? match.awayGoals : '—'}
              </span>
            </div>

            <div className="font-mono text-[10px] text-brand-primary bg-brand-primary/10 px-3.5 py-1 rounded-none mt-2 border border-brand-primary/20 select-none tracking-widest font-bold">
              HANDICAP RATIO: {match.handicap > 0 ? `+${match.handicap}` : match.handicap}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center md:items-start flex-1 text-center md:text-left">
            <div className="w-16 h-16 bg-[#040D17] border border-white/10 rounded-none flex items-center justify-center mb-4 p-1">
              <img
                src={match.awayLogo}
                alt={match.awayTeam}
                className="w-12 h-12 object-contain"
              />
            </div>
            <h2 className="font-sans font-black text-xl text-white uppercase tracking-wider">{match.awayTeam}</h2>
            <span className="text-[8px] font-mono text-text-muted mt-1 uppercase tracking-widest font-bold select-none">AWAY</span>
          </div>

        </div>

        {/* Stadium & Time metadata details footer block */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-text-muted font-medium select-none uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-brand-primary" />
            <span className="font-mono text-white text-[10px]">{match.league}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-white" />
            <span className="text-white text-[10px]">{match.stadium || "PitchSide Elite Stadium"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-primary" />
            <span className="text-white text-[10px]">{match.date} • {match.status === 'FINISHED' ? 'Ended' : match.time}</span>
          </div>
        </div>
      </section>

      {/* Main split detail analytics columns */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Side (8-cols): Predictions list of friends */}
        <div className="md:col-span-8 bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-white/10 select-none">
            <h3 className="font-display italic font-bold text-lg text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-primary" />
              dự đoán của anh em
            </h3>
            <span className="bg-[#102133] border border-white/5 text-brand-primary px-3 py-1 font-mono text-[9px] uppercase tracking-widest font-bold">
              {matchPredictions.length} Predictions
            </span>
          </div>

          {participantsList.length === 0 ? (
            <div className="p-10 text-center text-text-muted text-xs italic font-serif">
              Chưa có ai đặt cược dự đoán cho trận đấu này! Trở thành người đầu tiên đặt cược ở Match List.
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {participantsList.map((predict, index) => {
                const isCurrentUserRow = predict.playerId === currentPlayer.id;
                
                return (
                  <div
                    key={predict.playerId || index}
                    className={`flex items-center justify-between p-4 rounded-none border transition-all ${
                       isCurrentUserRow
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-white/5 bg-[#040D17] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={predict.avatar}
                        alt={predict.name}
                        className="w-9 h-9 rounded-none object-cover border border-white/10"
                      />
                      <div className="min-w-0">
                        <div className="font-sans uppercase tracking-wider font-extrabold text-xs text-white">
                          {predict.name} {isCurrentUserRow && <span className="text-brand-primary"> (You)</span>}
                        </div>
                        <div className="text-[8px] font-mono text-text-muted mt-1 uppercase tracking-widest">
                          {predict.timestamp}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 select-none">
                      <span className={`font-mono text-[10px] font-bold px-3 py-1 border rounded-none ${
                        predict.choice === 'HOME'
                          ? 'bg-brand-primary/5 text-brand-primary border-brand-primary/45'
                          : 'bg-white/5 text-white border-white/20'
                      }`}>
                        {predict.choice === 'HOME' ? 'HOME' : 'AWAY'}
                      </span>
                      
                      <div className="text-right min-w-[70px]">
                        <div className="font-mono text-[8px] text-text-muted uppercase tracking-widest font-bold">
                          {isFinished ? 'STATUS' : 'PENDING'}
                        </div>
                        <div className={`font-mono text-[10px] font-bold ${
                          isFinished ? 'text-status-not-lose uppercase' : 'text-brand-primary'
                        }`}>
                          {isFinished ? 'SETTLED' : 'LOCKED'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side (4-cols): Consensus analysis & Personal Outcome card */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Consensus Analysis Card */}
          <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none">
            <h3 className="font-display italic font-bold text-lg text-white mb-4 flex items-center gap-2 select-none">
              <BarChart3 className="w-4 h-4 text-brand-primary" />
              consensus statistics
            </h3>
            
            <div className="space-y-4 select-none">
              {/* Dual progress bar */}
              <div className="relative h-4 bg-[#232323] rounded-none overflow-hidden flex">
                <div
                  className="h-full bg-brand-primary transition-all duration-1000 ease-out"
                  style={{ width: `${homePercent}%` }}
                ></div>
                <div
                  className="h-full bg-white/40 transition-all duration-1000 ease-out"
                  style={{ width: `${awayPercent}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center font-mono text-[10px] font-black uppercase tracking-wider">
                <div className="flex flex-col items-start">
                  <span className="text-brand-primary text-base font-extrabold">{homePercent}%</span>
                  <span className="text-text-muted mt-1 uppercase tracking-widest text-[9px]">HOME ({homeCount})</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-white text-base font-extrabold">{awayPercent}%</span>
                  <span className="text-text-muted mt-1 uppercase tracking-widest text-[9px]">AWAY ({awayCount})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Outcome results card */}
          {currentUserPred ? (
            <div className={`rounded-none p-5 border select-none ${
              outcomeStatus === 'WIN'
                ? 'border-brand-primary/30 bg-[#00F06A]/5'
                : outcomeStatus === 'PENDING'
                ? 'border-white/20 bg-white/5'
                : 'border-status-lose/30 bg-status-lose/5'
            }`}>
              <h3 className="font-display italic font-bold text-lg text-white mb-4 flex items-center gap-1 uppercase tracking-widest">
                Your Outcome
              </h3>
              
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`w-12 h-12 rounded-none flex items-center justify-center p-2 border ${
                  outcomeStatus === 'WIN'
                    ? 'bg-status-not-lose/10 text-status-not-lose border-status-not-lose/20'
                    : outcomeStatus === 'PENDING'
                    ? 'bg-white/5 text-white border-white/25'
                    : 'bg-status-lose/10 text-status-lose border-status-lose/25'
                }`}>
                  {outcomeStatus === 'WIN' ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : outcomeStatus === 'PENDING' ? (
                    <Users className="w-5 h-5 text-white" />
                  ) : (
                    <XCircle className="w-7 h-7 text-status-lose animate-pulse" />
                  )}
                </div>

                <div>
                  <div className={`font-mono text-xs font-black uppercase tracking-widest ${
                    outcomeStatus === 'WIN'
                      ? 'text-status-not-lose'
                      : outcomeStatus === 'PENDING'
                      ? 'text-brand-primary'
                      : 'text-status-lose'
                  }`}>
                    {outcomeStatus === 'WIN'
                      ? 'OFFICIAL_WIN'
                      : outcomeStatus === 'PENDING'
                      ? 'UNSOLVED'
                      : outcomeStatus === 'LOSE_DOUBLE'
                      ? 'LOSE_DOUBLE'
                      : outcomeStatus === 'LOSE_HALF'
                      ? 'LOSE_HALF'
                      : 'MATCH_LOSE'}
                  </div>
                  <p className="text-[9px] text-text-muted font-mono tracking-widest uppercase mt-1">
                    Prediction: {currentUserPred.choice === 'HOME' ? 'Home' : 'Away'}
                  </p>
                </div>

                <div className="w-full pt-4 border-t border-white/5 flex justify-between text-[10px] font-mono uppercase tracking-widest">
                  <span className="text-text-muted">Final Score</span>
                  <span className="text-white font-bold">
                    {isFinished ? `${match.homeGoals} - ${match.awayGoals}` : '--'}
                  </span>
                </div>

                <div className="w-full flex justify-between text-[10px] font-mono pt-1 uppercase tracking-widest">
                  <span className="text-text-muted">Penalty Accrued</span>
                  <span className={`font-bold ${outcomeStatus === 'WIN' ? 'text-status-not-lose' : 'text-status-lose'}`}>
                    {isFinished ? `${penaltyVndAccrued.toLocaleString('vi-VN')} VND` : '0 VND'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none text-center text-[10px] font-mono uppercase tracking-widest text-text-muted leading-relaxed">
              Bạn chưa cược dự đoán cho trận đấu này. Cược trong tab Match List.
            </div>
          )}

        </div>

      </section>
    </div>
  );
}
