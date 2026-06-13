import { useState } from 'react';
import { Match, Player, Prediction, Settlement } from '../types';
import { Trophy, Download, TrendingDown, X } from 'lucide-react';
import { formatHandicap } from '../domain/handicap';
import { settlePrediction } from '../domain/settlement';
import { sortMatchesChronologically } from '../domain/matches';
import { formatBeerUnits } from '../domain/beerUnits';
import { getFormEmoji, getPlayerStreakSummary } from '../domain/streaks';
import { formatMatchStage } from '../domain/matchStage';

interface LeaderboardProps {
  currentPlayer: Player;
  players: Player[];
  matches: Match[];
  predictions: Prediction[];
  settlements: Settlement[];
}

export default function Leaderboard({
  currentPlayer,
  players,
  matches,
  predictions,
  settlements,
}: LeaderboardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedStreak, setSelectedStreak] = useState<{ player: Player; kind: 'WIN' | 'LOSE' } | null>(null);
  // Ranks are calculated by ordering players by aggregate penalty descending (lowest is Rank 1!)
  const sortedPlayers = [...players].sort((a, b) => a.totalPenaltyVnd - b.totalPenaltyVnd);

  const totalPenaltyPool = players.reduce((sum, player) => sum + player.totalPenaltyVnd, 0);
  const streakByPlayerId = new Map(players.map((player) => [
    player.id,
    getPlayerStreakSummary(player.id, matches, settlements),
  ]));

  // Identify podium stars
  const rank1 = sortedPlayers[0];
  const rank2 = sortedPlayers[1];
  const rank3 = sortedPlayers[2];

  const selectedPlayerPredictions = selectedPlayer
    ? sortMatchesChronologically(
        matches.filter((match) => (
          match.status === 'FINISHED' &&
          settlements.some((settlement) => settlement.playerId === selectedPlayer.id && settlement.matchId === match.id)
        ))
      ).map((match) => ({
        match,
        prediction: predictions.find((prediction) => prediction.playerId === selectedPlayer.id && prediction.matchId === match.id),
      }))
    : [];

  const getStreakMatches = (player: Player, kind: 'WIN' | 'LOSE') => {
    const playerSettlements = new Map(
      settlements
        .filter((settlement) => settlement.playerId === player.id)
        .map((settlement) => [settlement.matchId, settlement])
    );
    const results = sortMatchesChronologically(matches)
      .map((match) => {
        const settlement = playerSettlements.get(match.id);
        if (!settlement) return null;
        const settlementKind = settlement.status === 'WIN' ? 'WIN' : 'LOSE';
        return { match, settlement, kind: settlementKind };
      })
      .filter((result): result is NonNullable<typeof result> => Boolean(result));

    let bestRun: typeof results = [];
    let currentRun: typeof results = [];

    results.forEach((result) => {
      if (result.kind === kind) {
        currentRun = [...currentRun, result];
      } else {
        if (currentRun.length > bestRun.length) bestRun = currentRun;
        currentRun = [];
      }
    });

    return currentRun.length > bestRun.length ? currentRun : bestRun;
  };

  const renderStreakBadges = (player: Player) => {
    const summary = streakByPlayerId.get(player.id) ?? getPlayerStreakSummary(player.id, matches, settlements);

    return (
      <span className="ml-2 inline-flex gap-1 align-middle">
        {summary.bestWinStreak >= 2 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedStreak({ player, kind: 'WIN' });
            }}
            className="inline-flex px-2 py-0.5 border border-brand-primary/40 text-brand-primary bg-brand-primary/10 text-[9px] font-mono font-bold hover:bg-brand-primary/20"
          >
            🔥 x{summary.bestWinStreak}
          </button>
        )}
        {summary.worstLoseStreak >= 2 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedStreak({ player, kind: 'LOSE' });
            }}
            className="inline-flex px-2 py-0.5 border border-status-lose/40 text-status-lose bg-status-lose/10 text-[9px] font-mono font-bold hover:bg-status-lose/20"
          >
            🍺 x{summary.worstLoseStreak}
          </button>
        )}
      </span>
    );
  };

  const formatSettlementLabel = (match: Match, prediction?: Prediction) => {
    if (!prediction || match.status !== 'FINISHED') return 'Chưa tính';
    const settlement = settlePrediction(match, prediction);
    switch (settlement.status) {
      case 'WIN':
        return 'Không thua';
      case 'LOSE_HALF':
        return 'Thua nửa';
      case 'LOSE':
        return 'Thua';
      case 'LOSE_DOUBLE':
        return 'Thua đôi';
      case 'SETTLE_PENDING':
        return 'Chưa tính';
    }
  };

  // Download Leaderboard action - triggers real CSV file download!
  const triggerDownloadCSV = () => {
    const headers = ['Hạng', 'Người chơi', 'Tổng dự đoán', 'Không thua', 'Thua nửa', 'Thua', 'Thua đôi', 'Tổng beer phạt'];
    const rows = sortedPlayers.map((player, index) => [
      index + 1,
      player.name,
      player.totalPredictionsCount,
      player.notLoseCount,
      player.loseHalfCount,
      player.loseCount,
      player.loseDoubleCount,
      formatBeerUnits(player.totalPenaltyVnd)
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BeerCup_BangXepHang_WorldCup2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const streakMatches = selectedStreak ? getStreakMatches(selectedStreak.player, selectedStreak.kind) : [];

  return (
    <div className="space-y-8 font-sans">
      {selectedStreak && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelectedStreak(null)}>
          <div
            onClick={(event) => event.stopPropagation()}
            className={`w-full max-w-2xl bg-[#0A1622] border rounded-none p-5 space-y-4 ${
              selectedStreak.kind === 'WIN' ? 'border-brand-primary/50' : 'border-status-lose/50'
            }`}
          >
            <div className="flex justify-between items-start gap-4 border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display italic text-2xl text-white">
                  {selectedStreak.kind === 'WIN' ? '🔥 Chuỗi không thua' : '🍺 Chuỗi uống beer'} • {selectedStreak.player.name}
                </h3>
                <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest mt-1">
                  {streakMatches.length} trận liên tiếp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStreak(null)}
                className="border border-white/10 text-text-muted hover:text-white px-3 py-2 text-xs"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {streakMatches.map(({ match, settlement }) => (
                <div
                  key={match.id}
                  className={`border p-3 rounded-none ${
                    selectedStreak.kind === 'WIN'
                      ? 'border-brand-primary/25 bg-brand-primary/5'
                      : 'border-status-lose/25 bg-status-lose/5'
                  }`}
                >
                  <div className="flex justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="text-white font-bold uppercase tracking-wider truncate">
                        {match.homeTeam} vs {match.awayTeam}
                      </div>
                      <div className="text-[9px] text-text-muted font-mono uppercase tracking-widest mt-1">
                        {match.date} • {formatMatchStage(match)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 font-mono">
                      <div className={selectedStreak.kind === 'WIN' ? 'text-brand-primary' : 'text-status-lose'}>
                        {settlement.status.replace('LOSE_HALF', 'THUA NỬA').replace('LOSE_DOUBLE', 'THUA ĐÔI').replace('LOSE', 'THUA').replace('WIN', 'KHÔNG THUA')}
                      </div>
                      <div className="text-[9px] text-text-muted mt-1">
                        {formatBeerUnits(settlement.penaltyVnd)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
            BeerCup • Bảng tổng sắp
          </span>
          <h1 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1">
            bảng xếp hạng tổng world cup
          </h1>
          <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
            Vòng Chung Kết World Cup 2026 • CẬP NHẬT THEO THỜI GIAN THỰC
          </p>
        </div>

        {/* Legend status details caps */}
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-[#0A1622] px-4 py-2.5 rounded-none border border-white/10 text-[9px] font-mono tracking-widest uppercase">
            <TrendingDown className="w-3.5 h-3.5 text-brand-primary" />
            <span className="text-white">THỜI GIAN THỰC</span>
          </div>
          <div className="flex items-center gap-2 bg-[#0A1622] px-4 py-2.5 rounded-none border border-status-lose/30 text-[9px] font-mono tracking-widest uppercase select-none">
            <span className="text-text-muted">TỔNG BEER PHẠT</span>
            <span className="text-status-lose font-bold">{formatBeerUnits(totalPenaltyPool)}</span>
          </div>
        </div>
      </div>

      {/* Podium Display (Visual Bento Boxes) with animations and colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
        
        {/* RANK 2 Podium card */}
        {rank2 && (
          <div 
            onClick={() => setSelectedPlayer(rank2)}
            className="bg-[#0A1622] hover:bg-[#102133] border border-white/10 rounded-none p-6 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer transition-all duration-300 md:order-1"
          >
            <div className="relative mb-4">
              <img
                src={rank2.avatar}
                alt={rank2.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-none border-2 border-brand-primary p-0.5 object-cover"
              />
              <div className="absolute -bottom-1 -right-1 bg-brand-primary text-black w-6 h-6 rounded-none flex items-center justify-center font-bold text-xs font-mono">
                2
              </div>
            </div>
            <h3 className="font-sans uppercase tracking-widest font-black text-xs text-white group-hover:text-brand-primary transition-colors">
              {rank2.name}{renderStreakBadges(rank2)}
            </h3>
            <p className="text-brand-primary font-mono text-sm font-bold mt-1 tracking-widest">
              {formatBeerUnits(rank2.totalPenaltyVnd)}
            </p>
            {rank2.id === currentPlayer.id && (
              <span className="text-[8px] font-mono bg-white/5 border border-white/10 text-white px-2.5 py-0.5 rounded-none mt-3 uppercase tracking-widest font-bold">Đang đăng nhập</span>
            )}
            <span className="text-[8px] text-text-muted mt-3 font-mono uppercase tracking-widest">xem hồ sơ →</span>
          </div>
        )}

        {/* RANK 1 Top Podium card */}
        {rank1 && (
          <div 
            onClick={() => setSelectedPlayer(rank1)}
            className="bg-[#1A180E] hover:bg-[#232012] border-2 border-brand-primary rounded-none p-8 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer shadow-xl transition-all duration-300 md:scale-105 z-10 md:order-2"
          >
            <div className="relative mb-5">
              <img
                src={rank1.avatar}
                alt={rank1.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-none border-4 border-brand-primary p-0.5 object-cover"
              />
              <div className="absolute -bottom-1.5 -right-1.5 bg-brand-primary text-black w-8 h-8 rounded-none flex items-center justify-center font-bold text-sm border-2 border-[#1c120c]">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
            <h3 className="font-sans uppercase tracking-widest font-black text-sm text-white group-hover:text-brand-primary transition-colors">
              {rank1.name}{renderStreakBadges(rank1)}
            </h3>
            <p className="text-brand-primary font-mono text-lg font-black mt-1 tracking-widest">
              {formatBeerUnits(rank1.totalPenaltyVnd)}
            </p>
            
            <div className="mt-3 flex gap-2">
              <span className="bg-brand-primary text-black px-3.5 py-1 text-[8px] font-mono font-bold tracking-widest uppercase animate-pulse">
                DẪN ĐẦU TUẦN
              </span>
            </div>
            {rank1.id === currentPlayer.id && (
              <span className="text-[8px] font-mono bg-white/10 border border-white/20 text-white px-2.5 py-0.5 rounded-none mt-3 uppercase tracking-widest font-bold">Đang đăng nhập</span>
            )}
            <span className="text-[8px] text-brand-primary mt-3 font-mono uppercase tracking-widest">xem hồ sơ →</span>
          </div>
        )}

        {/* RANK 3 Podium card */}
        {rank3 && (
          <div 
            onClick={() => setSelectedPlayer(rank3)}
            className="bg-[#0A1622] hover:bg-[#102133] border border-white/10 rounded-none p-6 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] md:order-3"
          >
            <div className="relative mb-4">
              <img
                src={rank3.avatar}
                alt={rank3.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-none border-2 border-[#ff9e3b]/40 p-0.5 object-cover"
              />
              <div className="absolute -bottom-1 -right-1 bg-[#ff9e3b] text-black w-6 h-6 rounded-none flex items-center justify-center font-bold text-xs font-mono">
                3
              </div>
            </div>
            <h3 className="font-sans uppercase tracking-widest font-black text-xs text-white group-hover:text-[#ff9e3b] transition-colors">
              {rank3.name}{renderStreakBadges(rank3)}
            </h3>
            <p className="text-[#ff9e3b] font-mono text-sm font-bold mt-1 tracking-widest">
              {formatBeerUnits(rank3.totalPenaltyVnd)}
            </p>
            {rank3.id === currentPlayer.id && (
              <span className="text-[8px] font-mono bg-white/5 border border-white/10 text-white px-2.5 py-0.5 rounded-none mt-3 uppercase tracking-widest font-bold">Đang đăng nhập</span>
            )}
            <span className="text-[8px] text-text-muted mt-3 font-mono uppercase tracking-widest">xem hồ sơ →</span>
          </div>
        )}

      </div>



      {/* Leaderboard */}
      <div className="bg-[#0A1622] border border-white/10 rounded-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-white/10 bg-[#040D17] text-text-muted text-[9px] font-mono tracking-widest uppercase">
                <th className="px-5 py-4 w-12 text-center select-none">Hạng</th>
                <th className="px-5 py-4 w-[200px]">Người chơi</th>
                <th className="px-5 py-4 text-center select-none w-28">Tổng dự đoán</th>
                <th className="px-4 py-4 text-center select-none text-status-not-lose">Không thua</th>
                <th className="px-4 py-4 text-center select-none text-status-lose-half">Thua nửa</th>
                <th className="px-4 py-4 text-center select-none text-status-lose">Thua</th>
                <th className="px-4 py-4 text-center select-none text-[#cf2424]">Thua đôi</th>
                <th className="px-5 py-4 text-right w-36">Tổng beer phạt</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-white/5">
              {sortedPlayers.map((player, index) => {
                const rankNum = index + 1;
                const isUser = player.id === currentPlayer.id;

                return (
                  <tr
                    key={player.id}
                    onClick={() => setSelectedPlayer(player)}
                    className={`cursor-pointer transition-all duration-150 select-none ${
                      isUser
                        ? 'bg-brand-primary/5 border-l-2 border-brand-primary'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Rank Number */}
                    <td className="px-5 py-4 text-center font-mono text-sm text-white select-all">
                      <span className={`${isUser ? 'text-brand-primary font-bold' : ''}`}>
                        {rankNum}
                      </span>
                    </td>

                    {/* Player Info Row */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={player.avatar}
                          alt={player.name}
                          className="w-8 h-8 rounded-none object-cover border border-white/10"
                        />
                        <div className="min-w-0">
                          <div className={`flex flex-wrap items-center gap-y-1 text-xs uppercase tracking-wider text-white ${isUser ? 'font-bold text-brand-primary' : 'font-medium'}`}>
                            <span className="truncate max-w-[90px] sm:max-w-[120px]">{player.name}</span>{renderStreakBadges(player)}
                          </div>
                          {isUser && (
                            <span className="text-[7px] font-mono bg-brand-primary/10 text-brand-primary px-1 tracking-widest uppercase select-none">
                              BẠN
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Statistics counters */}
                    <td className="px-5 py-4 text-center font-mono text-xs font-bold text-white">
                      {player.totalPredictionsCount}
                    </td>

                    <td className="px-4 py-4 text-center font-mono text-xs font-bold text-status-not-lose">
                      {player.notLoseCount}
                    </td>

                    <td className="px-4 py-4 text-center font-mono text-xs font-bold text-status-lose-half">
                      {player.loseHalfCount}
                    </td>

                    <td className="px-4 py-4 text-center font-mono text-xs font-bold text-status-lose">
                      {player.loseCount}
                    </td>

                    <td className="px-4 py-4 text-center font-mono text-xs font-bold text-status-lose-double">
                      {player.loseDoubleCount}
                    </td>

                    {/* Aggregate total penalty column */}
                    <td className="px-5 py-4 text-right font-mono font-bold text-sm text-white">
                      <span className={`${isUser ? 'text-brand-primary text-base' : ''}`}>
                        {formatBeerUnits(player.totalPenaltyVnd)}
                      </span>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPlayer && (
        <div className="bg-[#0A1622] border border-brand-primary/30 rounded-none p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={selectedPlayer.avatar}
                alt={selectedPlayer.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-none object-cover border border-brand-primary/40"
              />
              <div className="min-w-0">
                <h3 className="font-display italic text-2xl text-white truncate">
                  chi tiết kết quả • {selectedPlayer.name}
                </h3>
                <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest mt-1">
                  {formatBeerUnits(selectedPlayer.totalPenaltyVnd)} • {selectedPlayer.totalPredictionsCount} lượt
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-lg">
                  {renderStreakBadges(selectedPlayer)}
                  {(streakByPlayerId.get(selectedPlayer.id)?.recentResults ?? []).map((result) => (
                    <span key={result.matchId} title={result.status}>{getFormEmoji(result.status)}</span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlayer(null)}
              className="border border-white/10 text-text-muted hover:text-white hover:border-white/30 p-2 transition-colors"
              aria-label="Đóng chi tiết người chơi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedPlayerPredictions.length === 0 ? (
            <div className="text-center text-xs text-text-muted font-mono uppercase tracking-widest py-8">
              Chưa có lựa chọn nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {selectedPlayerPredictions.map(({ match, prediction }) => {
                const settlement = prediction ? settlePrediction(match, prediction) : null;
                const isLoser = match.status === 'FINISHED' && settlement?.status !== 'WIN' && settlement?.status !== 'SETTLE_PENDING';
                const isWinner = match.status === 'FINISHED' && settlement?.status === 'WIN';

                return (
                  <div
                    key={match.id}
                    className={`border rounded-none p-3 bg-[#040D17] ${
                      isLoser
                        ? 'border-status-lose/40 bg-status-lose/10'
                        : isWinner
                        ? 'border-status-not-lose/30 bg-status-not-lose/5'
                        : 'border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[9px] font-mono uppercase tracking-widest text-text-muted mb-2">
                      <span>{formatMatchStage(match)}</span>
                      <span>{match.date} • {match.time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-white uppercase tracking-wider font-bold truncate">
                          {match.homeTeam} vs {match.awayTeam}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono uppercase tracking-widest mt-1">
                          Chọn: {prediction?.choice === 'AWAY' ? match.awayTeam : match.homeTeam}{prediction?.hopeStar ? ' ⭐' : ''} • Kèo {formatHandicap(match.handicap)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                          isLoser ? 'text-status-lose' : isWinner ? 'text-status-not-lose' : 'text-brand-primary'
                        }`}>
                          {formatSettlementLabel(match, prediction)}
                        </div>
                        <div className="text-[9px] text-text-muted font-mono mt-1">
                          {match.status === 'FINISHED' ? `${match.homeGoals} - ${match.awayGoals}` : match.status === 'LIVE' ? 'Đang đá' : 'Sắp đá'}
                        </div>
                        {match.status === 'FINISHED' && settlement && (
                          <div className={`text-[9px] font-mono font-bold mt-1 ${settlement.penaltyVnd > 0 ? 'text-status-lose' : 'text-status-not-lose'}`}>
                            {formatBeerUnits(settlement.penaltyVnd)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend & Footer details */}
      <div className="mt-8 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 text-[9px] font-mono font-bold tracking-widest uppercase select-none">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-status-not-lose"></span>
            <span className="text-text-muted">Không thua: 0 🍺</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-status-lose-half"></span>
            <span className="text-text-muted">Thua nửa: 5 🍺</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-status-lose"></span>
            <span className="text-text-muted">Thua: 10 🍺</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-status-lose-double"></span>
            <span className="text-text-muted">Thua đôi: 20 🍺</span>
          </div>
        </div>

        <button
          onClick={triggerDownloadCSV}
          className="flex items-center gap-2 bg-brand-primary text-black font-sans font-bold uppercase tracking-widest text-[10px] px-6 py-3.5 rounded-none hover:bg-white transition-all cursor-pointer select-none active:scale-95 duration-200"
        >
          <Download className="w-4 h-4" />
          <span>Tải bảng xếp hạng (CSV)</span>
        </button>
      </div>
    </div>
  );
}
