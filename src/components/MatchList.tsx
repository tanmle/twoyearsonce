import { useState, FormEvent } from 'react';
import { Player, Match, Prediction } from '../types';
import { Search, Calendar, Lock, AlertTriangle, Check, Star } from 'lucide-react';
import { formatHandicap, parseHandicapInput } from '../domain/handicap';
import { sortMatchesForFixtures } from '../domain/matches';
import { isPredictionLocked } from '../domain/predictionLock';

const getVietnamDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

const isTodayOrTomorrowInVietnam = (match: Match) => {
  if (!match.kickoffAt) return false;

  const kickoff = new Date(match.kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return false;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const kickoffKey = getVietnamDateKey(kickoff);
  return kickoffKey === getVietnamDateKey(now) || kickoffKey === getVietnamDateKey(tomorrow);
};

interface MatchListProps {
  currentPlayer: Player;
  predictionPlayer: Player;
  players: Player[];
  matches: Match[];
  predictions: Prediction[];
  onTogglePrediction: (matchId: string, choice: 'HOME' | 'AWAY') => void;
  onToggleHopeStar: (matchId: string) => void;
  onOverridePredictions: (matchId: string, playerIds: string[], choice: 'HOME' | 'AWAY') => void;
  onOpenMatchDetails: (match: Match) => void;
  onUpdateMatchHandicap: (matchId: string, handicap: number) => void;
}

export default function MatchList({
  currentPlayer,
  predictionPlayer,
  players,
  matches,
  predictions,
  onTogglePrediction,
  onToggleHopeStar,
  onOverridePredictions,
  onOpenMatchDetails,
  onUpdateMatchHandicap,
}: MatchListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'UPCOMING' | 'FINISHED' | 'ALL'>('UPCOMING');

  // Filter matches based on search term and selected status filter
  const filteredMatches = sortMatchesForFixtures(matches.filter((match) => {
    const matchesSearch =
      match.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.league.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'UPCOMING') {
      return match.status === 'UPCOMING' || match.status === 'LIVE';
    } else if (selectedFilter === 'FINISHED') {
      return match.status === 'FINISHED';
    }
    return true; // ALL
  }));

  const handleHandicapOverride = (e: FormEvent<HTMLFormElement>, matchId: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawValue = String(formData.get('handicap') ?? '');

    try {
      onUpdateMatchHandicap(matchId, parseHandicapInput(rawValue));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Handicap không hợp lệ');
    }
  };


  return (
    <div className="space-y-8 font-sans">
      {/* Search & Filter Controls Header */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
              BeerCup • Lịch đấu
            </span>
            <h2 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1">
              lịch thi đấu & tỉ số
            </h2>
            <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
              World Cup 2026 • Kèo đang mở
            </p>
          </div>

        </div>


        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input block */}
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm đội bóng, giải đấu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A1622] border border-white/10 rounded-none pl-10 pr-4 py-3 text-sm text-white focus:border-brand-primary outline-none transition-all placeholder:text-text-muted/60"
            />
          </div>

          {/* Desktop Filter tabs */}
          <div className="flex bg-[#0A1622] p-1 rounded-none border border-white/10 self-start">
            <button
              onClick={() => setSelectedFilter('UPCOMING')}
              className={`px-4 py-2.5 rounded-none text-[10px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
                selectedFilter === 'UPCOMING'
                  ? 'bg-brand-primary text-black'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              Sắp diễn ra
            </button>
            <button
              onClick={() => setSelectedFilter('FINISHED')}
              className={`px-4 py-2.5 rounded-none text-[10px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
                selectedFilter === 'FINISHED'
                  ? 'bg-brand-primary text-black'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              Đã kết thúc
            </button>
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`px-4 py-2.5 rounded-none text-[10px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
                selectedFilter === 'ALL'
                  ? 'bg-brand-primary text-black'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              Tất cả
            </button>
          </div>
        </div>
      </section>

      {/* Grid List of Matches */}
      {filteredMatches.length === 0 ? (
        <div className="bg-[#121212] border border-white/10 rounded-none p-12 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-status-lose mx-auto" />
          <h3 className="font-display italic text-xl text-white">Không tìm thấy trận đấu</h3>
          <p className="text-xs text-text-muted font-mono uppercase tracking-wider">
            Vui lòng thử tìm kiếm với từ khóa khác hoặc chuyển bộ lọc trạng thái.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMatches.map((match) => {
            const hasPredicted = predictions.find(
              (p) => p.playerId === predictionPlayer.id && p.matchId === match.id
            );
            const predictionLocked = isPredictionLocked(match);
            const matchPredictions = predictions.filter((prediction) => prediction.matchId === match.id);
            const getPlayerPrediction = (playerId: string) =>
              matchPredictions.find((prediction) => prediction.playerId === playerId);
            const getPlayerChoice = (playerId: string): 'HOME' | 'AWAY' => getPlayerPrediction(playerId)?.choice ?? 'HOME';
            const playersByChoice = (choice: 'HOME' | 'AWAY') =>
              players.filter((player) => getPlayerChoice(player.id) === choice);
            const shouldShowSelectionGroups =
              match.status === 'FINISHED' || match.status === 'LIVE' || isTodayOrTomorrowInVietnam(match);
            const showPredictionSummary = currentPlayer.role !== 'admin' && shouldShowSelectionGroups;
            const showAdminQuickEditor = currentPlayer.role === 'admin' && shouldShowSelectionGroups;
            return (
              <div
                key={match.id}
                className={`bg-[#0A1622] border rounded-none p-5 hover:border-brand-primary transition-all relative overflow-hidden group flex flex-col justify-between h-full ${
                  match.status === 'LIVE' ? 'border-brand-primary' : 'border-white/10'
                }`}
              >
                {/* Micro-interaction dot indicator */}
                {match.status === 'LIVE' && (
                  <div className="absolute top-0 right-0 py-1 px-3 bg-[#e53935] text-white flex items-center gap-1.5 leading-none">
                    <span className="w-1.5 h-1.5 bg-white animate-pulse"></span>
                    <span className="font-mono text-[9px] font-bold tracking-wider">{match.liveTimeText || 'TRỰC TIẾP'}</span>
                  </div>
                )}

                {/* Card Header metadata */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-1.5 select-none">
                      <span className="w-1 h-1 bg-brand-primary"></span>
                      <span className="font-mono text-[9px] font-bold text-brand-primary uppercase tracking-widest">
                        {match.league}
                      </span>
                    </div>

                    {match.status === 'UPCOMING' && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-none text-text-muted border border-white/5">
                        <Calendar className="w-3 h-3 text-brand-primary" />
                        <span className="font-mono text-[9px] tracking-widest uppercase">{match.time}</span>
                      </div>
                    )}

                    {match.status === 'FINISHED' && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-none text-text-muted border border-white/5">
                        <Lock className="w-3 h-3 text-brand-primary" />
                        <span className="font-mono text-[9px] uppercase tracking-widest font-bold">ĐÃ KHÓA</span>
                      </div>
                    )}
                  </div>

                  {/* Scorers / Box section clickable to review consensus details */}
                  <div 
                    onClick={() => onOpenMatchDetails(match)}
                    className="flex justify-between items-center bg-[#040D17] p-3 border border-white/5 hover:border-brand-primary/20 transition-all cursor-pointer group/box mt-3"
                  >
                    {/* Chủ nhà Side */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePrediction(match.id, 'HOME');
                      }}
                      disabled={predictionLocked}
                      className={`flex items-center gap-3 flex-1 min-w-0 p-2 border transition-all text-left ${
                        hasPredicted?.choice === 'HOME'
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-transparent text-white hover:border-brand-primary/40 hover:bg-white/5'
                      } ${predictionLocked ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                    >
                      <div className="w-10 h-10 rounded-none bg-white/5 p-1 flex items-center justify-center border border-white/10 group-hover/box:border-brand-primary/30">
                        <img
                          src={match.homeLogo}
                          alt={match.homeTeam}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                      <span className="font-sans uppercase tracking-wider font-bold text-xs text-current truncate transition-colors flex items-center gap-1">
                        {hasPredicted?.choice === 'HOME' && <Check className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />}
                        {match.homeTeam}
                      </span>
                    </button>

                    {/* VS score indicator columns */}
                    <div className="flex flex-col items-center justify-center px-4">
                      {match.status === 'FINISHED' ? (
                        <span className="font-mono font-black text-xl text-brand-primary">
                          {match.homeGoals} - {match.awayGoals}
                        </span>
                      ) : match.status === 'LIVE' ? (
                        <span className="font-mono font-black text-xl text-brand-primary animate-pulse">
                          {match.homeGoals} - {match.awayGoals}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-text-muted uppercase tracking-widest select-none">vs</span>
                      )}
                    </div>

                    {/* Đội khách Side */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePrediction(match.id, 'AWAY');
                      }}
                      disabled={predictionLocked}
                      className={`flex items-center justify-end gap-3 flex-1 text-right min-w-0 p-2 border transition-all ${
                        hasPredicted?.choice === 'AWAY'
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-transparent text-white hover:border-brand-primary/40 hover:bg-white/5'
                      } ${predictionLocked ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                    >
                      <span className="font-sans uppercase tracking-wider font-bold text-xs text-current truncate transition-colors flex items-center gap-1">
                        {hasPredicted?.choice === 'AWAY' && <Check className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />}
                        {match.awayTeam}
                      </span>
                      <div className="w-10 h-10 rounded-none bg-white/5 p-1 flex items-center justify-center border border-white/10 group-hover/box:border-brand-primary/30">
                        <img
                          src={match.awayLogo}
                          alt={match.awayTeam}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                    </button>
                  </div>

                  {((match.homeScorers && match.homeScorers.length > 0) || (match.awayScorers && match.awayScorers.length > 0)) && (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[9px] font-mono text-text-muted">
                      <div className="space-y-1 text-left">
                        {match.homeScorers?.map((scorer) => (
                          <div key={scorer} className="truncate">⚽ {scorer}</div>
                        ))}
                      </div>
                      <div className="space-y-1 text-right">
                        {match.awayScorers?.map((scorer) => (
                          <div key={scorer} className="truncate">⚽ {scorer}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Handicap badge & Chủ nhà / Đội khách buttons */}
                <div className="mt-5 pt-4 border-t border-white/5 space-y-4">
                  <div className="flex justify-between items-center gap-3 text-xs font-mono">
                    <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                      kèo chấp:
                    </span>
                    <span className="bg-brand-primary/10 text-brand-primary px-3 py-0.5 text-[9px] uppercase tracking-widest font-bold border border-brand-primary/20 select-none">
                      Kèo {formatHandicap(match.handicap)}
                    </span>
                  </div>

                  {match.matchType && match.matchType !== 'group' && !predictionLocked && (
                    <button
                      type="button"
                      onClick={() => onToggleHopeStar(match.id)}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 border font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                        hasPredicted?.hopeStar
                          ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300'
                          : 'border-white/10 text-text-muted hover:border-yellow-400/60 hover:text-yellow-300'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${hasPredicted?.hopeStar ? 'fill-yellow-300' : ''}`} />
                      Ngôi sao hy vọng
                    </button>
                  )}

                  {currentPlayer.role === 'admin' && (
                    <form onSubmit={(event) => handleHandicapOverride(event, match.id)} className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        name="handicap"
                        defaultValue={formatHandicap(match.handicap)}
                        aria-label="Ghi đè handicap"
                        placeholder="0:3/4"
                        className="bg-[#102133] border border-white/10 rounded-none px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-primary font-mono"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 bg-brand-primary text-black font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-white transition-colors"
                      >
                        Lưu kèo
                      </button>
                    </form>
                  )}

                  {predictionLocked && match.status !== 'FINISHED' && (
                    <div className="bg-[#040D17] border border-white/5 rounded-none p-3.5 text-center select-none text-[9px] text-text-muted font-mono uppercase tracking-widest">
                      Đã khóa lựa chọn trước giờ bóng lăn 1 tiếng
                    </div>
                  )}

                  {showAdminQuickEditor && (
                    <div className="space-y-3 bg-[#040D17] border border-yellow-400/20 p-3 rounded-none">
                      <div>
                        <div className="text-[9px] text-yellow-300 font-mono uppercase tracking-widest font-bold mb-1">
                          Sửa nhanh lựa chọn
                        </div>
                        <p className="text-[8px] text-text-muted font-mono uppercase tracking-widest">
                          Bấm dấu × trên tag để chuyển người chơi sang đội còn lại
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-mono">
                        {(['HOME', 'AWAY'] as const).map((choice) => {
                          const teamName = choice === 'HOME' ? match.homeTeam : match.awayTeam;
                          const targetChoice = choice === 'HOME' ? 'AWAY' : 'HOME';
                          const targetTeamName = targetChoice === 'HOME' ? match.homeTeam : match.awayTeam;
                          const choicePlayers = playersByChoice(choice);

                          return (
                            <div key={choice} className="bg-[#07111C] border border-white/5 p-3 rounded-none min-h-24">
                              <div className="text-brand-primary uppercase tracking-widest font-bold mb-2 truncate">
                                {teamName}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {choicePlayers.map((player) => {
                                  const playerPrediction = getPlayerPrediction(player.id);

                                  return (
                                    <button
                                      key={player.id}
                                      type="button"
                                      title={`Chuyển ${player.name} sang ${targetTeamName}`}
                                      onClick={() => onOverridePredictions(match.id, [player.id], targetChoice)}
                                      className="group/tag inline-flex items-center gap-1.5 border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white hover:border-yellow-300 hover:text-yellow-300 transition-colors"
                                    >
                                      <span>{player.name}{playerPrediction?.hopeStar ? ' ⭐' : ''}</span>
                                      <span className="text-text-muted group-hover/tag:text-yellow-300 font-bold">×</span>
                                    </button>
                                  );
                                })}
                                {choicePlayers.length === 0 && (
                                  <span className="text-text-muted italic">Chưa ai chọn</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {match.status === 'FINISHED' && (
                    <div className="space-y-3">
                      <div className="bg-[#040D17] border border-white/5 rounded-none p-3.5 flex justify-between items-center select-none text-xs font-mono">
                        <span className="text-text-muted flex items-center gap-1.5 uppercase tracking-widest font-bold">
                          <Lock className="w-3.5 h-3.5" /> DỰ ĐOÁN ĐÃ KHOÁ:
                        </span>
                        <span className="font-bold text-brand-primary uppercase tracking-widest">
                          {hasPredicted
                            ? hasPredicted.choice === 'HOME'
                              ? `Chủ nhà (${match.homeTeam})`
                              : `Đội khách (${match.awayTeam})`
                            : 'Không tham gia'}
                        </span>
                      </div>

                    </div>
                  )}

                  {showPredictionSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-mono">
                      <div className="bg-[#040D17] border border-white/5 p-3 rounded-none">
                        <div className="text-brand-primary uppercase tracking-widest font-bold mb-2 truncate">
                          Chọn {match.homeTeam}
                        </div>
                        <div className="text-text-muted leading-relaxed">
                          {playersByChoice('HOME').length > 0
                            ? playersByChoice('HOME').map((player) => {
                                const playerPrediction = getPlayerPrediction(player.id);
                                return `${player.name}${playerPrediction?.hopeStar ? ' ⭐' : ''}`;
                              }).join(', ')
                            : 'Chưa ai chọn'}
                        </div>
                      </div>
                      <div className="bg-[#040D17] border border-white/5 p-3 rounded-none">
                        <div className="text-brand-primary uppercase tracking-widest font-bold mb-2 truncate">
                          Chọn {match.awayTeam}
                        </div>
                        <div className="text-text-muted leading-relaxed">
                          {playersByChoice('AWAY').length > 0
                            ? playersByChoice('AWAY').map((player) => {
                                const playerPrediction = getPlayerPrediction(player.id);
                                return `${player.name}${playerPrediction?.hopeStar ? ' ⭐' : ''}`;
                              }).join(', ')
                            : 'Chưa ai chọn'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div 
                  onClick={() => onOpenMatchDetails(match)}
                  className="mt-4 text-center text-[9px] font-mono text-text-muted uppercase tracking-widest hover:text-brand-primary transition-colors cursor-pointer border-t border-white/5 pt-3"
                >
                  Báo cáo tổng hợp lựa chọn →
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
