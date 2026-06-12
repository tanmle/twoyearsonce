import { useState, FormEvent } from 'react';
import { Player, Match, Prediction } from '../types';
import { Search, Calendar, Lock, AlertTriangle, HelpCircle, Sparkles, Check, Flame } from 'lucide-react';

interface MatchListProps {
  currentPlayer: Player;
  players: Player[];
  matches: Match[];
  predictions: Prediction[];
  onTogglePrediction: (matchId: string, choice: 'HOME' | 'AWAY') => void;
  onOpenMatchDetails: (match: Match) => void;
  onUpdateMatchStatus: (matchId: string, status: 'FINISHED', homeGoals: number, awayGoals: number) => void;
  onResetMatches: () => void;
}

export default function MatchList({
  currentPlayer,
  players,
  matches,
  predictions,
  onTogglePrediction,
  onOpenMatchDetails,
  onUpdateMatchStatus,
  onResetMatches,
}: MatchListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'UPCOMING' | 'FINISHED' | 'ALL'>('UPCOMING');
  const [showSandbox, setShowSandbox] = useState(false);

  // Score simulator state
  const [sandboxMatchId, setSandboxMatchId] = useState('');
  const [sandboxHomeGoals, setSandboxHomeGoals] = useState(2);
  const [sandboxAwayGoals, setSandboxAwayGoals] = useState(1);

  // Filter matches based on search term and selected status filter
  const filteredMatches = matches.filter((match) => {
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
  });

  // Handle simulation trigger
  const handleSimulate = (e: FormEvent) => {
    e.preventDefault();
    if (!sandboxMatchId) return;
    onUpdateMatchStatus(sandboxMatchId, 'FINISHED', sandboxHomeGoals, sandboxAwayGoals);
    // Reset sandbox selection
    setSandboxMatchId('');
  };

  // Find non-finished matches for score simulation
  const openMatchesForSim = matches.filter((m) => m.status !== 'FINISHED');

  return (
    <div className="space-y-8 font-sans">
      {/* Search & Filter Controls Header */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
              FIFA Stadium Ledger • Arena Fixtures
            </span>
            <h2 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1">
              lịch thi đấu & tỉ số
            </h2>
            <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
              WORLD CUP 2026 STADIUM STANDS • ACTIVE HANDICAPS
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Simulation trigger */}
            <button
              onClick={() => setShowSandbox(!showSandbox)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-none border border-brand-primary text-brand-primary text-[10px] font-mono font-bold hover:bg-brand-primary hover:text-black transition-all cursor-pointer uppercase tracking-widest"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Mô phỏng kết quả
            </button>
          </div>
        </div>

        {/* Dynamic Sandbox Simulator UI block */}
        {showSandbox && (
          <div className="p-5 rounded-none border border-brand-primary/20 bg-[#0A1622] space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="font-mono text-[10px] font-bold text-brand-primary uppercase tracking-widest flex items-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4" />
                FIFA STADIUM SIMULATOR
              </span>
              <button 
                onClick={onResetMatches}
                className="text-[9px] font-mono text-status-lose uppercase tracking-widest hover:underline"
              >
                Reset dữ liệu
              </button>
            </div>
            {openMatchesForSim.length === 0 ? (
              <p className="text-xs text-text-muted italic">
                Tất cả các trận đấu hiện tại đã kết thúc! Bạn có thể Reset dữ liệu để mô phỏng lại.
              </p>
            ) : (
              <form onSubmit={handleSimulate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-text-muted uppercase tracking-widest">Trận đấu:</label>
                  <select
                    value={sandboxMatchId}
                    onChange={(e) => setSandboxMatchId(e.target.value)}
                    required
                    className="w-full bg-[#102133] border border-white/10 rounded-none p-2.5 text-xs text-white focus:outline-none focus:border-brand-primary cursor-pointer uppercase tracking-wide"
                  >
                    <option value="" className="bg-[#102133]">-- Chọn trận đấu --</option>
                    {openMatchesForSim.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#102133]">
                        {m.homeTeam} vs {m.awayTeam} (HDP {m.handicap})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-text-muted uppercase tracking-widest">Bàn Home:</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={sandboxHomeGoals}
                    onChange={(e) => setSandboxHomeGoals(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#102133] border border-white/10 rounded-none p-2.5 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-text-muted uppercase tracking-widest">Bàn Away:</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={sandboxAwayGoals}
                    onChange={(e) => setSandboxAwayGoals(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#102133] border border-white/10 rounded-none p-2.5 text-xs text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-brand-primary text-black font-sans uppercase tracking-widest font-bold text-xs py-3 rounded-none cursor-pointer hover:bg-white transition-all transform hover:-translate-y-0.5"
                >
                  Hoàn tất & Tính điểm
                </button>
              </form>
            )}
          </div>
        )}

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
              (p) => p.playerId === currentPlayer.id && p.matchId === match.id
            );

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
                    <span className="font-mono text-[9px] font-bold tracking-wider">LIVE {match.liveTimeText || "67'"}</span>
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
                        <span className="font-mono text-[9px] uppercase tracking-widest font-bold">LOCKED</span>
                      </div>
                    )}
                  </div>

                  {/* Scorers / Box section clickable to review consensus details */}
                  <div 
                    onClick={() => onOpenMatchDetails(match)}
                    className="flex justify-between items-center bg-[#040D17] p-3 border border-white/5 hover:border-brand-primary/20 transition-all cursor-pointer group/box mt-3"
                  >
                    {/* Home Side */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-none bg-white/5 p-1 flex items-center justify-center border border-white/10 group-hover/box:border-brand-primary/30">
                        <img
                          src={match.homeLogo}
                          alt={match.homeTeam}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                      <span className="font-sans uppercase tracking-wider font-bold text-xs text-white truncate group-hover/box:text-brand-primary transition-colors">
                        {match.homeTeam}
                      </span>
                    </div>

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

                    {/* Away Side */}
                    <div className="flex items-center justify-end gap-3 flex-1 text-right min-w-0">
                      <span className="font-sans uppercase tracking-wider font-bold text-xs text-white truncate group-hover/box:text-brand-primary transition-colors">
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
                    </div>
                  </div>
                </div>

                {/* Handicap badge & Home / Away buttons */}
                <div className="mt-5 pt-4 border-t border-white/5 space-y-4">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                      handicap:
                    </span>
                    <span className="bg-brand-primary/10 text-brand-primary px-3 py-0.5 text-[9px] uppercase tracking-widest font-bold border border-brand-primary/20 select-none">
                      HDP {match.handicap > 0 ? `+${match.handicap}` : match.handicap}
                    </span>
                  </div>

                  {match.status === 'UPCOMING' || match.status === 'LIVE' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => onTogglePrediction(match.id, 'HOME')}
                        className={`flex flex-col items-center justify-center py-3 px-3 rounded-none border font-bold transition-all cursor-pointer group ${
                          hasPredicted?.choice === 'HOME'
                            ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                            : 'border-white/10 bg-[#040D17] hover:bg-[#102133] hover:border-brand-primary/60 text-text-muted hover:text-white'
                        }`}
                      >
                        <span className="text-[8px] uppercase font-mono tracking-widest">
                          CHOOSE HOME
                        </span>
                        <span className="text-sm font-sans font-extrabold mt-1 tracking-wider flex items-center gap-1">
                          {hasPredicted?.choice === 'HOME' && <Check className="w-3.5 h-3.5 text-brand-primary" />}
                          PRO 1.95
                        </span>
                      </button>

                      <button
                        onClick={() => onTogglePrediction(match.id, 'AWAY')}
                        className={`flex flex-col items-center justify-center py-3 px-3 rounded-none border font-bold transition-all cursor-pointer group ${
                          hasPredicted?.choice === 'AWAY'
                            ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                            : 'border-white/10 bg-[#040D17] hover:bg-[#102133] hover:border-brand-primary/60 text-text-muted hover:text-white'
                        }`}
                      >
                        <span className="text-[8px] uppercase font-mono tracking-widest">
                          CHOOSE AWAY
                        </span>
                        <span className="text-sm font-sans font-extrabold mt-1 tracking-wider flex items-center gap-1">
                          {hasPredicted?.choice === 'AWAY' && <Check className="w-3.5 h-3.5 text-brand-primary" />}
                          PRO 1.82
                        </span>
                      </button>
                    </div>
                  ) : (
                    /* Display locked prediction outcome details */
                    <div className="bg-[#040D17] border border-white/5 rounded-none p-3.5 flex justify-between items-center select-none text-xs font-mono">
                      <span className="text-text-muted flex items-center gap-1.5 uppercase tracking-widest font-bold">
                        <Lock className="w-3.5 h-3.5" /> DỰ ĐOÁN ĐÃ KHOÁ:
                      </span>
                      <span className="font-bold text-brand-primary uppercase tracking-widest">
                        {hasPredicted
                          ? hasPredicted.choice === 'HOME'
                            ? `Home (${match.homeTeam})`
                            : `Away (${match.awayTeam})`
                          : 'Không tham gia'}
                      </span>
                    </div>
                  )}
                </div>

                <div 
                  onClick={() => onOpenMatchDetails(match)}
                  className="mt-4 text-center text-[9px] font-mono text-text-muted uppercase tracking-widest hover:text-brand-primary transition-colors cursor-pointer border-t border-white/5 pt-3"
                >
                  Báo cáo phân tích Consensus →
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
