import { useMemo, useState } from 'react';
import { Match, Player, Prediction, Settlement } from '../types';
import { formatHandicap } from '../domain/handicap';
import { isPredictionLocked } from '../domain/predictionLock';
import { settlePrediction } from '../domain/settlement';
import { sortMatchesChronologically, sortMatchesForFixtures, sortMatchesRecentlyFinished } from '../domain/matches';
import { formatMatchStage } from '../domain/matchStage';

interface AdminBettingGridProps {
  players: Player[];
  matches: Match[];
  predictions: Prediction[];
  settlements: Settlement[];
  onOverridePredictions: (matchId: string, playerIds: string[], choice: 'HOME' | 'AWAY') => void;
  onOverrideHopeStar: (matchId: string, playerId: string, hopeStar: boolean) => void;
}

type Filter = 'UPCOMING' | 'FINISHED' | 'ALL';

function cellKey(matchId: string, playerId: string) {
  return `${matchId}:${playerId}`;
}

function formatPenalty(penaltyVnd: number) {
  if (penaltyVnd === 0) return '0';
  const sign = penaltyVnd > 0 ? '+' : '';
  return `${sign}${penaltyVnd.toLocaleString('vi-VN')}đ`;
}

function statusLabel(status: Settlement['status']) {
  switch (status) {
    case 'WIN':
      return 'WIN';
    case 'LOSE_HALF':
      return 'HALF';
    case 'LOSE':
      return 'LOSE';
    case 'LOSE_DOUBLE':
      return 'DOUBLE';
  }
}

function resultClass(status?: Settlement['status']) {
  switch (status) {
    case 'WIN':
      return 'border-status-not-lose/50 bg-status-not-lose/10 text-status-not-lose';
    case 'LOSE_HALF':
      return 'border-yellow-400/50 bg-yellow-400/10 text-yellow-300';
    case 'LOSE':
      return 'border-status-lose/50 bg-status-lose/10 text-status-lose';
    case 'LOSE_DOUBLE':
      return 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300';
    default:
      return 'border-white/10 bg-[#07111B] text-white';
  }
}

function getVietnamDateKey(date: Date) {
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
}

function isTodayOrTomorrowInVietnam(match: Match) {
  if (!match.kickoffAt) return false;

  const kickoff = new Date(match.kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return false;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const kickoffKey = getVietnamDateKey(kickoff);
  return kickoffKey === getVietnamDateKey(now) || kickoffKey === getVietnamDateKey(tomorrow);
}

export default function AdminBettingGrid({
  players,
  matches,
  predictions,
  settlements,
  onOverridePredictions,
  onOverrideHopeStar,
}: AdminBettingGridProps) {
  const [filter, setFilter] = useState<Filter>('UPCOMING');
  const [searchTerm, setSearchTerm] = useState('');
  const [unlockedCells, setUnlockedCells] = useState<Set<string>>(() => new Set());
  const [unlockedRows, setUnlockedRows] = useState<Set<string>>(() => new Set());

  const filteredMatches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchingMatches = matches.filter((match) => {
      const matchesSearch = !normalizedSearch || [
        match.homeTeam,
        match.awayTeam,
        match.league,
        match.matchGroup ? `bảng ${match.matchGroup}` : '',
        match.matchType ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) return false;
      if (filter === 'UPCOMING') {
        return (match.status === 'UPCOMING' || match.status === 'LIVE') && isTodayOrTomorrowInVietnam(match);
      }
      if (filter === 'FINISHED') return match.status === 'FINISHED';
      return true;
    });

    if (filter === 'FINISHED') return sortMatchesRecentlyFinished(matchingMatches);
    if (filter === 'ALL') return sortMatchesChronologically(matchingMatches);
    return sortMatchesForFixtures(matchingMatches);
  }, [filter, matches, searchTerm]);

  const toggleCellUnlock = (matchId: string, playerId: string) => {
    const key = cellKey(matchId, playerId);
    setUnlockedCells((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRowUnlock = (matchId: string) => {
    setUnlockedRows((previous) => {
      const next = new Set(previous);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const autoLockCell = (matchId: string, playerId: string) => {
    setUnlockedCells((previous) => {
      const next = new Set(previous);
      next.delete(cellKey(matchId, playerId));
      return next;
    });
  };

  const getPrediction = (matchId: string, playerId: string) =>
    predictions.find((prediction) => prediction.matchId === matchId && prediction.playerId === playerId);

  const getSettlement = (match: Match, prediction?: Prediction): Settlement | undefined => {
    if (!prediction) return undefined;
    const savedSettlement = settlements.find(
      (settlement) => settlement.matchId === match.id && settlement.playerId === prediction.playerId
    );
    if (savedSettlement) return savedSettlement;

    const calculated = settlePrediction(match, prediction);
    if (calculated.status === 'SETTLE_PENDING') return undefined;
    return {
      predictionId: prediction.id,
      matchId: match.id,
      playerId: prediction.playerId,
      competitionId: match.competitionId ?? prediction.competitionId,
      status: calculated.status,
      penaltyVnd: calculated.penaltyVnd,
    };
  };

  const setChoice = (match: Match, player: Player, choice: 'HOME' | 'AWAY') => {
    onOverridePredictions(match.id, [player.id], choice);
    if (isPredictionLocked(match)) autoLockCell(match.id, player.id);
  };

  const setHopeStar = (match: Match, player: Player, hopeStar: boolean) => {
    onOverrideHopeStar(match.id, player.id, hopeStar);
    if (isPredictionLocked(match)) autoLockCell(match.id, player.id);
  };

  return (
    <div className="space-y-6 font-sans">
      <section className="space-y-5 border-b border-white/10 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
            BeerCup • Admin
          </span>
          <h2 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1">
            đặt kèo
          </h2>
          <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
            Chọn đội giúp từng người chơi. Trận khóa/xong cần mở khóa trước khi sửa.
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
          <div className="flex bg-[#0A1622] p-1 rounded-none border border-white/10 self-start">
            {([
              ['UPCOMING', 'Sắp diễn ra'],
              ['FINISHED', 'Đã xong'],
              ['ALL', 'Tất cả'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-4 py-2.5 rounded-none text-[10px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
                  filter === id ? 'bg-brand-primary text-black' : 'text-text-muted hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-full xl:max-w-sm">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm trận, đội, bảng..."
              className="w-full bg-[#0A1622] border border-white/10 rounded-none px-4 py-3 text-sm text-white focus:border-brand-primary outline-none transition-all placeholder:text-text-muted/60"
            />
          </div>
        </div>
      </section>

      <div className="overflow-x-auto xl:overflow-x-visible border border-white/10 bg-[#050B12]">
        <table className="w-full min-w-[900px] xl:min-w-0 table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[170px] 2xl:w-[190px]" />
            {players.map((player) => (
              <col key={player.id} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-30 bg-[#102133]">
            <tr>
              <th className="sticky left-0 z-40 bg-[#102133] border-r border-b border-white/10 px-3 py-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-brand-primary">Trận</span>
              </th>
              {players.map((player) => (
                <th key={player.id} className="border-r border-b border-white/10 px-1.5 2xl:px-3 py-3">
                  <span className="block text-center text-[9px] 2xl:text-[10px] font-mono uppercase tracking-wider text-white truncate" title={player.name}>
                    {player.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMatches.map((match, index) => {
              const matchLocked = isPredictionLocked(match);
              const rowUnlocked = unlockedRows.has(match.id);
              const matchLabel = match.status === 'LIVE' ? 'LIVE' : formatMatchStage(match);

              return (
                <tr key={match.id} className="align-top hover:bg-white/[0.02]">
                  <td className="sticky left-0 z-20 bg-[#07111B] border-r border-b border-white/10 px-2 py-1.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-wider text-brand-primary">
                        <span className="bg-brand-primary text-black px-1 py-0.5 font-black">#{String(index + 1).padStart(2, '0')}</span>
                        <span className="truncate">{matchLabel}</span>
                        {matchLocked && (
                          <button
                            onClick={() => toggleRowUnlock(match.id)}
                            className={`border px-1 py-0.5 text-[9px] leading-none font-mono transition-colors ${
                              rowUnlocked
                                ? 'border-brand-primary text-brand-primary bg-brand-primary/10'
                                : 'border-yellow-300/40 text-yellow-300 hover:bg-yellow-300/10'
                            }`}
                            title={rowUnlocked ? 'Đã mở hàng' : 'Mở hàng'}
                          >
                            {rowUnlocked ? '🔓' : '🔒'}
                          </button>
                        )}
                      </div>

                      <div className="text-white font-bold uppercase tracking-wide text-[10px] leading-tight truncate" title={`${match.homeTeam} vs ${match.awayTeam}`}>
                        {match.homeTeam} - {match.awayTeam}
                      </div>

                      <div className="text-[8px] font-mono uppercase tracking-wider text-text-muted leading-none">
                        {(match.status === 'LIVE' || match.status === 'FINISHED') && (
                          <span className="text-brand-primary font-black">{match.homeGoals ?? 0}-{match.awayGoals ?? 0} • </span>
                        )}
                        {match.time === 'FINISHED' ? formatHandicap(match.handicap) : `${match.time} • ${formatHandicap(match.handicap)}`}
                      </div>
                    </div>
                  </td>

                  {players.map((player) => {
                    const prediction = getPrediction(match.id, player.id);
                    const choice = prediction?.choice ?? 'HOME';
                    const settlement = getSettlement(match, prediction ?? {
                      matchId: match.id,
                      playerId: player.id,
                      competitionId: match.competitionId,
                      choice,
                      timestamp: '',
                      hopeStar: false,
                    });
                    const canEdit = !matchLocked || rowUnlocked;
                    const canUseHopeStar = Boolean(match.matchType && match.matchType !== 'group');
                    const isHopeStar = prediction?.hopeStar ?? false;

                    return (
                      <td key={player.id} className={`border-r border-b border-white/10 px-1 py-1 align-middle ${resultClass(match.status === 'FINISHED' ? settlement?.status : undefined)}`}>
                        <div className="space-y-1">
                          {match.status === 'FINISHED' && settlement && (
                            <div className="text-[8px] font-mono uppercase tracking-wider font-black text-center">
                              {statusLabel(settlement.status)}
                            </div>
                          )}

                          {canEdit ? (
                            <div className="space-y-1">
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  onClick={() => setChoice(match, player, 'HOME')}
                                  className={`px-1 2xl:px-2 py-1 text-[8px] 2xl:text-[9px] font-mono uppercase tracking-wider 2xl:tracking-widest border transition-all truncate ${
                                    choice === 'HOME'
                                      ? 'bg-brand-primary text-black border-brand-primary font-black'
                                      : 'border-white/10 text-text-muted hover:text-white hover:border-brand-primary/40'
                                  }`}
                                  title={match.homeTeam}
                                >
                                  H
                                </button>
                                <button
                                  onClick={() => setChoice(match, player, 'AWAY')}
                                  className={`px-1 2xl:px-2 py-1 text-[8px] 2xl:text-[9px] font-mono uppercase tracking-wider 2xl:tracking-widest border transition-all truncate ${
                                    choice === 'AWAY'
                                      ? 'bg-brand-primary text-black border-brand-primary font-black'
                                      : 'border-white/10 text-text-muted hover:text-white hover:border-brand-primary/40'
                                  }`}
                                  title={match.awayTeam}
                                >
                                  A
                                </button>
                              </div>
                              {canUseHopeStar && (
                                <button
                                  onClick={() => setHopeStar(match, player, !isHopeStar)}
                                  className={`w-full inline-flex items-center justify-center gap-1 border px-1 2xl:px-2 py-0.5 text-[8px] 2xl:text-[9px] font-mono uppercase tracking-wider 2xl:tracking-widest transition-colors ${
                                    isHopeStar
                                      ? 'border-yellow-300 text-yellow-300 bg-yellow-300/10'
                                      : 'border-white/10 text-text-muted hover:text-yellow-300 hover:border-yellow-300/40'
                                  }`}
                                  title="Bật/tắt ngôi sao hy vọng"
                                >
                                  <span>{isHopeStar ? '★' : '☆'}</span>
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
