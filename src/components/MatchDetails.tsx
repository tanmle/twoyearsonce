import { useEffect, useState } from 'react';
import { Player, Match, Prediction, MatchInsights, HistoryMatch, FormEntry, TeamLineup, LineupPlayer, PowerRankingLeader, MatchStats } from '../types';
import { Calendar, CheckCircle2, XCircle, Users, BarChart3, Minimize2, MapPin, Trophy, Clock, History, Swords, Shirt, Zap, Activity } from 'lucide-react';
import { formatHandicap } from '../domain/handicap';
import { settlePrediction } from '../domain/settlement';
import { FALLBACK_TEAM_LOGO } from '../domain/teamLogo';
import { formatBeerUnits } from '../domain/beerUnits';
import { formatLiveMatchTimestamp } from '../domain/matchClock';
import { fetchMatchInsights } from '../services/matchHistory';

interface MatchDetailsProps {
  currentPlayer: Player;
  players: Player[];
  match: Match;
  predictions: Prediction[];
  onClose: () => void;
}

function goalEventSuffix(type: string | undefined) {
  if (type === 'penalty') return ' (P)';
  if (type === 'own_goal') return ' (OG)';
  return '';
}

function renderGoalLabel(event: { label?: string; minute?: number; stoppageMinute?: number }) {
  if (event.label) return event.label;
  if (event.minute === undefined) return undefined;
  return event.stoppageMinute ? `${event.minute}+${event.stoppageMinute}'` : `${event.minute}'`;
}

function renderScorerFallback(scorer: string) {
  return <div key={scorer}>⚽ {scorer}</div>;
}

function renderGoalEvent(event: NonNullable<Match['homeGoalEvents']>[number], index: number) {
  const minute = renderGoalLabel(event);
  return (
    <div key={`${event.playerName}-${minute ?? index}`}>
      ⚽ {minute ? `${minute} ` : ''}{event.playerName}{goalEventSuffix(event.type)}
    </div>
  );
}

function formatNumber(value: number | undefined) {
  return value === undefined || Number.isNaN(value) ? undefined : new Intl.NumberFormat('vi-VN').format(value);
}

function formatHistoryDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

const FORM_BADGE_STYLES: Record<FormEntry['outcome'], string> = {
  W: 'bg-status-not-lose/15 text-status-not-lose border-status-not-lose/40',
  D: 'bg-white/10 text-white/70 border-white/20',
  L: 'bg-status-lose/15 text-status-lose border-status-lose/40',
};

const FORM_BADGE_LABEL: Record<FormEntry['outcome'], string> = { W: 'T', D: 'H', L: 'B' };

function HistoryTeamCell({ name, flag, alignRight }: { name: string; flag?: string; alignRight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${alignRight ? 'flex-row-reverse text-right' : ''}`}>
      <img
        src={flag || FALLBACK_TEAM_LOGO}
        alt={name}
        onError={(event) => { event.currentTarget.src = FALLBACK_TEAM_LOGO; }}
        className="w-5 h-4 object-cover border border-white/10 shrink-0"
      />
      <span className="text-[11px] text-white font-semibold truncate">{name}</span>
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryMatch }) {
  const meta = [item.stageName, item.groupName, formatHistoryDate(item.date), item.stadium].filter(Boolean).join(' • ');
  return (
    <div className="bg-[#040D17] border border-white/5 p-3 hover:border-white/15 transition-colors">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <HistoryTeamCell name={item.homeTeam} flag={item.homeFlag} alignRight />
        <div className="font-mono font-black text-sm text-white whitespace-nowrap px-2">
          {item.homeScore ?? '-'} <span className="text-white/30">:</span> {item.awayScore ?? '-'}
        </div>
        <HistoryTeamCell name={item.awayTeam} flag={item.awayFlag} />
      </div>
      {(meta || item.penaltyText) && (
        <div className="mt-2 text-center text-[8px] font-mono uppercase tracking-widest text-text-muted">
          {meta}
          {item.penaltyText && <span className="text-brand-primary"> • {item.penaltyText}</span>}
        </div>
      )}
    </div>
  );
}

function FormColumn({ teamName, teamFlag, form }: { teamName: string; teamFlag?: string; form: FormEntry[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={teamFlag || FALLBACK_TEAM_LOGO}
            alt={teamName}
            onError={(event) => { event.currentTarget.src = FALLBACK_TEAM_LOGO; }}
            className="w-6 h-5 object-cover border border-white/10"
          />
          <span className="font-sans font-black text-[11px] uppercase tracking-wider text-white truncate">{teamName}</span>
        </div>
        <div className="flex gap-1 shrink-0">
          {form.length === 0 ? (
            <span className="text-[9px] font-mono text-text-muted uppercase">—</span>
          ) : (
            form.map((entry, index) => (
              <span
                key={entry.match.matchId ?? index}
                className={`w-5 h-5 flex items-center justify-center rounded-full border font-mono text-[9px] font-black ${FORM_BADGE_STYLES[entry.outcome]}`}
                title={`${entry.match.homeTeam} ${entry.match.homeScore ?? '-'}-${entry.match.awayScore ?? '-'} ${entry.match.awayTeam}`}
              >
                {FORM_BADGE_LABEL[entry.outcome]}
              </span>
            ))
          )}
        </div>
      </div>
      <div className="space-y-2">
        {form.map((entry, index) => (
          <HistoryRow key={entry.match.matchId ?? index} item={entry.match} />
        ))}
      </div>
    </div>
  );
}

const POSITION_GROUPS: Array<{ key: LineupPlayer['position']; label: string }> = [
  { key: 'GK', label: 'Thủ môn' },
  { key: 'DF', label: 'Hậu vệ' },
  { key: 'MF', label: 'Tiền vệ' },
  { key: 'FW', label: 'Tiền đạo' },
];

function PlayerAvatar({ player }: { player: LineupPlayer }) {
  if (player.photoUrl) {
    return (
      <img
        src={player.photoUrl}
        alt={player.name}
        onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
        className="w-9 h-9 rounded-full object-cover object-top bg-[#102133] border border-white/10 shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#102133] border border-white/10 shrink-0 flex items-center justify-center">
      <Shirt className="w-4 h-4 text-text-muted" />
    </div>
  );
}

function LineupPlayerRow({ player }: { player: LineupPlayer }) {
  return (
    <div className="flex items-start gap-3 bg-[#040D17] border border-white/5 p-2.5">
      <PlayerAvatar player={player} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-text-muted w-5 shrink-0">{player.shirtNumber ?? ''}</span>
          <span className="text-[12px] text-white font-semibold uppercase tracking-wide truncate">{player.name}</span>
          {player.isCaptain && (
            <span className="text-[8px] font-mono text-brand-primary font-black border border-brand-primary/40 rounded-full w-4 h-4 flex items-center justify-center shrink-0">C</span>
          )}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {player.card && <span className={`w-2.5 h-3.5 rounded-sm ${player.card === 'yellow' ? 'bg-yellow-400' : 'bg-status-lose'}`} />}
            {player.subOff && (
              <span className="text-[9px] font-mono text-status-lose font-bold">↓{player.subOff.minute}</span>
            )}
            {player.subOnMinute && (
              <span className="text-[9px] font-mono text-status-not-lose font-bold">↑{player.subOnMinute}</span>
            )}
          </div>
        </div>
        {player.subOff?.playerName && (
          <div className="text-[9px] font-mono text-status-not-lose mt-0.5 pl-7 truncate">
            ↑ {player.subOff.playerNumber ?? ''} {player.subOff.playerName}
          </div>
        )}
      </div>
    </div>
  );
}

function LineupCard({ teamName, teamFlag, lineup, alignRight }: { teamName: string; teamFlag?: string; lineup: TeamLineup; alignRight?: boolean }) {
  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between gap-2 pb-2 border-b border-white/10 ${alignRight ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 min-w-0 ${alignRight ? 'flex-row-reverse' : ''}`}>
          <img
            src={teamFlag || FALLBACK_TEAM_LOGO}
            alt={teamName}
            onError={(event) => { event.currentTarget.src = FALLBACK_TEAM_LOGO; }}
            className="w-6 h-5 object-cover border border-white/10"
          />
          <span className="font-sans font-black text-[12px] uppercase tracking-wider text-white truncate">{teamName}</span>
        </div>
        {lineup.formation && (
          <span className="font-mono text-[11px] font-bold text-brand-primary border border-brand-primary/30 px-2 py-0.5">{lineup.formation}</span>
        )}
      </div>
      {lineup.coach && (
        <div className="text-[8px] font-mono uppercase tracking-widest text-text-muted">HLV: <span className="text-white/80">{lineup.coach}</span></div>
      )}
      {POSITION_GROUPS.map((group) => {
        const groupPlayers = lineup.starters.filter((player) => player.position === group.key);
        if (groupPlayers.length === 0) return null;
        return (
          <div key={group.key} className="space-y-1.5">
            <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted font-bold">{group.label}</div>
            {groupPlayers.map((player) => <LineupPlayerRow key={player.id ?? player.name} player={player} />)}
          </div>
        );
      })}
      {lineup.bench.length > 0 && (
        <div className="pt-2 border-t border-white/5">
          <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted font-bold mb-1">Dự bị</div>
          <div className="text-[10px] text-text-muted leading-relaxed">
            {lineup.bench.map((player) => player.name).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

const POWER_RANKING_LABELS: Record<PowerRankingLeader['category'], { title: string; scoreLabel: string }> = {
  attacking: { title: 'Tấn công', scoreLabel: 'Điểm tấn công' },
  creativity: { title: 'Sáng tạo', scoreLabel: 'Điểm sáng tạo' },
  defending: { title: 'Phòng ngự', scoreLabel: 'Điểm phòng ngự' },
};

function PowerRankingCard({ leader }: { leader: PowerRankingLeader }) {
  const labels = POWER_RANKING_LABELS[leader.category];
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted font-bold mb-2">{labels.title}</div>
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-primary/20 to-brand-primary/5 border border-brand-primary/30 p-4 min-h-[120px] flex flex-col justify-between">
        <div className="flex items-center gap-2 relative z-10">
          {leader.teamFlag && (
            <img
              src={leader.teamFlag}
              alt={leader.teamName}
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
              className="w-5 h-4 object-cover border border-white/10"
            />
          )}
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/80">{leader.teamName}</span>
        </div>
        <div className="relative z-10">
          <div className="font-display italic font-black text-2xl text-brand-primary leading-none">1st</div>
          <div className="font-sans font-black text-[13px] uppercase tracking-wide text-white mt-1 truncate">{leader.playerName}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono font-black text-lg text-white">{leader.score.toFixed(2)}</span>
            <span className="text-[8px] font-mono uppercase tracking-widest text-text-muted">{labels.scoreLabel}</span>
          </div>
        </div>
        {leader.photoUrl && (
          <img
            src={leader.photoUrl}
            alt={leader.playerName}
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
            className="absolute right-0 bottom-0 h-full w-auto object-contain object-bottom opacity-90 pointer-events-none"
          />
        )}
      </div>
    </div>
  );
}

function StatBarRow({ row }: { row: { label: string; home: number; away: number } }) {
  const total = row.home + row.away;
  const homePct = total > 0 ? (row.home / total) * 100 : 50;
  const awayPct = total > 0 ? (row.away / total) * 100 : 50;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
        <span className="text-white font-bold w-8 text-left">{row.home}</span>
        <span className="text-text-muted uppercase tracking-widest text-[9px] text-center flex-1">{row.label}</span>
        <span className="text-white font-bold w-8 text-right">{row.away}</span>
      </div>
      <div className="flex items-center gap-1 h-1.5">
        <div className="flex-1 flex justify-end bg-white/5 rounded-full overflow-hidden">
          <div className="h-1.5 bg-white/60 rounded-full" style={{ width: `${homePct}%` }} />
        </div>
        <div className="flex-1 flex justify-start bg-white/5 rounded-full overflow-hidden">
          <div className="h-1.5 bg-brand-primary rounded-full" style={{ width: `${awayPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function LiveStatistics({ stats, homeTeam, awayTeam, homeFlag, awayFlag }: { stats: MatchStats; homeTeam: string; awayTeam: string; homeFlag?: string; awayFlag?: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={homeFlag || FALLBACK_TEAM_LOGO} alt={homeTeam} onError={(e) => { e.currentTarget.src = FALLBACK_TEAM_LOGO; }} className="w-6 h-5 object-cover border border-white/10" />
          <span className="font-sans font-black text-[12px] uppercase tracking-wider text-white truncate">{homeTeam}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
          <img src={awayFlag || FALLBACK_TEAM_LOGO} alt={awayTeam} onError={(e) => { e.currentTarget.src = FALLBACK_TEAM_LOGO; }} className="w-6 h-5 object-cover border border-white/10" />
          <span className="font-sans font-black text-[12px] uppercase tracking-wider text-white truncate">{awayTeam}</span>
        </div>
      </div>

      {/* Possession */}
      <div>
        <div className="text-center text-[9px] font-mono uppercase tracking-widest text-text-muted mb-2">Kiểm soát bóng</div>
        <div className="flex items-center justify-between text-[13px] font-mono font-black text-white mb-1">
          <span>{stats.homePossession}%</span>
          <span>{stats.awayPossession}%</span>
        </div>
        <div className="flex h-2.5 rounded-full overflow-hidden">
          <div className="bg-white/60" style={{ width: `${stats.homePossession}%` }} />
          <div className="bg-yellow-400/70" style={{ width: `${stats.contestPossession}%` }} />
          <div className="bg-brand-primary" style={{ width: `${stats.awayPossession}%` }} />
        </div>
        {stats.contestPossession > 0 && (
          <div className="text-center text-[8px] font-mono uppercase tracking-widest text-text-muted mt-1">{stats.contestPossession}% tranh chấp</div>
        )}
      </div>

      {stats.groups.map((group) => (
        <div key={group.title} className="space-y-3">
          <div className="text-center font-display italic font-bold text-white text-sm">{group.title}</div>
          {group.rows.map((row) => <StatBarRow key={row.label} row={row} />)}
        </div>
      ))}
    </div>
  );
}

export default function MatchDetails({
  currentPlayer,
  players,
  match,
  predictions,
  onClose,
}: MatchDetailsProps) {
  const [insights, setInsights] = useState<MatchInsights | null>(null);
  const [insightsStatus, setInsightsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setInsightsStatus('loading');
    setInsights(null);
    fetchMatchInsights(match)
      .then((data) => {
        if (cancelled) return;
        setInsights(data);
        setInsightsStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Failed to load match insights:', error);
        setInsightsStatus('error');
      });
    return () => { cancelled = true; };
  }, [match.id]);

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
    const settlement = match.status === 'FINISHED' ? settlePrediction(match, pred) : null;

    return {
      playerId: pred.playerId,
      name: player ? player.name : 'Người chơi không rõ',
      avatar: player ? player.avatar : '',
      choice: pred.choice,
      timestamp: pred.timestamp,
      hopeStar: pred.hopeStar,
      settlementStatus: settlement?.status ?? 'SETTLE_PENDING',
      penaltyVnd: settlement?.penaltyVnd ?? 0,
    };
  });

  // Calculate user outcome using the shared settlement rules
  const currentUserPred = matchPredictions.find((p) => p.playerId === currentPlayer.id);
  const isFinished = match.status === 'FINISHED';
  const userSettlement = currentUserPred ? settlePrediction(match, currentUserPred) : null;
  const outcomeStatus = userSettlement?.status === 'SETTLE_PENDING' || !userSettlement ? 'CHỜ' : userSettlement.status;
  const penaltyVndAccrued = userSettlement?.penaltyVnd ?? 0;
  const statusLabel = match.status === 'FINISHED' ? 'ĐÃ KẾT THÚC' : match.status === 'LIVE' ? 'ĐANG ĐÁ' : 'SẮP DIỄN RA';
  const homeGoalEvents = match.homeGoalEvents ?? [];
  const awayGoalEvents = match.awayGoalEvents ?? [];
  const detailsRows = [
    ['Kì đấu', match.details?.seasonName ?? match.details?.tournamentName],
    ['Vòng', match.details?.stageName],
    ['Bảng', match.details?.groupName ?? match.matchGroup],
    ['Mã trận FIFA', match.details?.fifaMatchId],
    ['Số trận', match.details?.matchNumber ? `#${match.details.matchNumber}` : undefined],
    ['Sân', match.details?.venueName ?? match.stadium],
    ['Thành phố', match.details?.venueCity],
    ['Trọng tài', match.details?.referee],
    ['Khán giả', formatNumber(match.details?.attendance)],
    ['Đồng bộ chi tiết', match.details?.lastDetailSyncedAt ? new Date(match.details.lastDetailSyncedAt).toLocaleString('vi-VN') : undefined],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className="space-y-8 font-sans">
      {/* Detail header box wrapper close trigger */}
      <div className="flex justify-between items-end bg-[#0A1622] border-b border-white/10 pb-6 p-1">
        <div>
          <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
            BeerCup • Chi tiết trận đấu
          </span>
          <h3 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1">
            chi tiết kì đấu
          </h3>
          <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
            Tổng hợp lựa chọn & báo cáo trận
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
      <section className="relative overflow-hidden rounded-none border border-white/10 bg-[#0A1622] p-4 sm:p-8">
        <div className="flex flex-row justify-between items-center gap-3 sm:gap-8 relative z-10">
          
          {/* Chủ nhà team */}
          <div className="flex flex-col items-center md:items-end flex-1 min-w-0 text-center md:text-right">
            <div className="w-11 h-11 sm:w-16 sm:h-16 bg-[#040D17] border border-white/10 rounded-none flex items-center justify-center mb-2 sm:mb-4 p-1">
              <img
                src={match.homeLogo || FALLBACK_TEAM_LOGO}
                alt={match.homeTeam}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_TEAM_LOGO;
                }}
                className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
              />
            </div>
            <h2 className="font-sans font-black text-[11px] sm:text-xl text-white uppercase tracking-wider truncate max-w-full">{match.homeTeam}</h2>
            <span className="hidden sm:block text-[8px] font-mono text-text-muted mt-1 uppercase tracking-widest font-bold select-none">CHỦ NHÀ</span>
            {((homeGoalEvents.length > 0) || (match.homeScorers && match.homeScorers.length > 0)) && (
              <div className="mt-2 space-y-1 text-[9px] font-mono text-brand-primary text-center md:text-right">
                {homeGoalEvents.length > 0
                  ? homeGoalEvents.map(renderGoalEvent)
                  : match.homeScorers?.map(renderScorerFallback)}
              </div>
            )}
          </div>

          {/* Scores indicator */}
          <div className="flex flex-col items-center justify-center gap-2">
            <div className={`font-mono text-[9px] px-3.5 py-1 rounded-none font-bold select-none tracking-widest ${
              match.status === 'FINISHED' ? 'bg-[#222] text-white border border-white/15' : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 animate-pulse'
            }`}>
              {statusLabel}
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
              KÈO CHẤP: {formatHandicap(match.handicap)}
            </div>
            {match.status === 'LIVE' && (
              <div className="font-mono text-[9px] text-status-lose bg-status-lose/10 px-3.5 py-1 rounded-none mt-2 border border-status-lose/20 select-none tracking-widest font-bold animate-pulse">
                {formatLiveMatchTimestamp(match) || 'TRỰC TIẾP'}
              </div>
            )}
          </div>

          {/* Đội khách Team */}
          <div className="flex flex-col items-center md:items-start flex-1 min-w-0 text-center md:text-left">
            <div className="w-11 h-11 sm:w-16 sm:h-16 bg-[#040D17] border border-white/10 rounded-none flex items-center justify-center mb-2 sm:mb-4 p-1">
              <img
                src={match.awayLogo || FALLBACK_TEAM_LOGO}
                alt={match.awayTeam}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_TEAM_LOGO;
                }}
                className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
              />
            </div>
            <h2 className="font-sans font-black text-[11px] sm:text-xl text-white uppercase tracking-wider truncate max-w-full">{match.awayTeam}</h2>
            <span className="hidden sm:block text-[8px] font-mono text-text-muted mt-1 uppercase tracking-widest font-bold select-none">ĐỘI KHÁCH</span>
            {((awayGoalEvents.length > 0) || (match.awayScorers && match.awayScorers.length > 0)) && (
              <div className="mt-2 space-y-1 text-[9px] font-mono text-brand-primary text-center md:text-left">
                {awayGoalEvents.length > 0
                  ? awayGoalEvents.map(renderGoalEvent)
                  : match.awayScorers?.map(renderScorerFallback)}
              </div>
            )}
          </div>

        </div>

        {/* Sân & Time metadata details footer block */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-text-muted font-medium select-none uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-brand-primary" />
            <span className="font-mono text-white text-[10px]">{match.league}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-white" />
            <span className="text-white text-[10px]">{match.stadium || "Sân vận động"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-primary" />
            <span className="text-white text-[10px]">{match.date} • {match.status === 'FINISHED' ? 'Đã kết thúc' : match.time}</span>
          </div>
          {match.status === 'LIVE' && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-status-lose" />
              <span className="text-white text-[10px]">{formatLiveMatchTimestamp(match) || 'TRỰC TIẾP'}</span>
            </div>
          )}
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
                const isLoser = isFinished && predict.settlementStatus !== 'WIN' && predict.settlementStatus !== 'SETTLE_PENDING';
                const resultLabel =
                  predict.settlementStatus === 'WIN'
                    ? 'KHÔNG THUA'
                    : predict.settlementStatus === 'LOSE_DOUBLE'
                    ? 'THUA ĐÔI'
                    : predict.settlementStatus === 'LOSE_HALF'
                    ? 'THUA NỬA'
                    : predict.settlementStatus === 'LOSE'
                    ? 'THUA'
                    : 'CHƯA TÍNH';
                
                return (
                  <div
                    key={predict.playerId || index}
                    className={`flex items-center justify-between p-4 rounded-none border transition-all ${
                       isLoser
                        ? 'border-status-lose/50 bg-status-lose/10'
                        : isCurrentUserRow
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
                        {predict.choice === 'HOME' ? 'CHỦ NHÀ' : 'ĐỘI KHÁCH'}{predict.hopeStar ? ' ⭐' : ''}
                      </span>
                      
                      <div className="text-right min-w-[70px]">
                        <div className="font-mono text-[8px] text-text-muted uppercase tracking-widest font-bold">
                          {isFinished ? 'TRẠNG THÁI' : 'CHỜ'}
                        </div>
                        <div className={`font-mono text-[10px] font-bold uppercase ${
                          isLoser ? 'text-status-lose' : isFinished ? 'text-status-not-lose' : 'text-brand-primary'
                        }`}>
                          {isFinished ? resultLabel : 'ĐÃ KHÓA'}
                        </div>
                        {isLoser && (
                          <div className="font-mono text-[8px] text-status-lose uppercase tracking-widest mt-0.5">
                            {formatBeerUnits(predict.penaltyVnd)}
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

        {/* Right Side (4-cols): Consensus analysis & Personal Outcome card */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Consensus Analysis Card */}
          <div className="bg-[#0A1622] border border-white/10 p-5 rounded-none">
            <h3 className="font-display italic font-bold text-lg text-white mb-4 flex items-center gap-2 select-none">
              <BarChart3 className="w-4 h-4 text-brand-primary" />
              thống kê lựa chọn
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
                  <span className="text-text-muted mt-1 uppercase tracking-widest text-[9px]">CHỦ NHÀ ({homeCount})</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-white text-base font-extrabold">{awayPercent}%</span>
                  <span className="text-text-muted mt-1 uppercase tracking-widest text-[9px]">ĐỘI KHÁCH ({awayCount})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Outcome results card */}
          {currentUserPred ? (
            <div className={`rounded-none p-5 border select-none ${
              outcomeStatus === 'WIN'
                ? 'border-brand-primary/30 bg-[#00F06A]/5'
                : outcomeStatus === 'CHỜ'
                ? 'border-white/20 bg-white/5'
                : 'border-status-lose/30 bg-status-lose/5'
            }`}>
              <h3 className="font-display italic font-bold text-lg text-white mb-4 flex items-center gap-1 uppercase tracking-widest">
                Kết quả của bạn
              </h3>
              
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`w-12 h-12 rounded-none flex items-center justify-center p-2 border ${
                  outcomeStatus === 'WIN'
                    ? 'bg-status-not-lose/10 text-status-not-lose border-status-not-lose/20'
                    : outcomeStatus === 'CHỜ'
                    ? 'bg-white/5 text-white border-white/25'
                    : 'bg-status-lose/10 text-status-lose border-status-lose/25'
                }`}>
                  {outcomeStatus === 'WIN' ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : outcomeStatus === 'CHỜ' ? (
                    <Users className="w-5 h-5 text-white" />
                  ) : (
                    <XCircle className="w-7 h-7 text-status-lose animate-pulse" />
                  )}
                </div>

                <div>
                  <div className={`font-mono text-xs font-black uppercase tracking-widest ${
                    outcomeStatus === 'WIN'
                      ? 'text-status-not-lose'
                      : outcomeStatus === 'CHỜ'
                      ? 'text-brand-primary'
                      : 'text-status-lose'
                  }`}>
                    {outcomeStatus === 'WIN'
                      ? 'KHÔNG THUA'
                      : outcomeStatus === 'CHỜ'
                      ? 'CHƯA TÍNH'
                      : outcomeStatus === 'LOSE_DOUBLE'
                      ? 'THUA ĐÔI'
                      : outcomeStatus === 'LOSE_HALF'
                      ? 'THUA NỬA'
                      : 'THUA'}
                  </div>
                  <p className="text-[9px] text-text-muted font-mono tracking-widest uppercase mt-1">
                    Lựa chọn: {currentUserPred.choice === 'HOME' ? 'Chủ nhà' : 'Đội khách'}{currentUserPred.hopeStar ? ' ⭐ Ngôi sao hy vọng' : ''}
                  </p>
                </div>

                <div className="w-full pt-4 border-t border-white/5 flex justify-between text-[10px] font-mono uppercase tracking-widest">
                  <span className="text-text-muted">Tỉ số cuối</span>
                  <span className="text-white font-bold">
                    {isFinished ? `${match.homeGoals} - ${match.awayGoals}` : '--'}
                  </span>
                </div>

                <div className="w-full flex justify-between text-[10px] font-mono pt-1 uppercase tracking-widest">
                  <span className="text-text-muted">Beer phạt</span>
                  <span className={`font-bold ${outcomeStatus === 'WIN' ? 'text-status-not-lose' : 'text-status-lose'}`}>
                    {isFinished ? formatBeerUnits(penaltyVndAccrued) : '0 🍺'}
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

      {(detailsRows.length > 0 || match.details?.fifaMatchCentreUrl) && (
        <section className="bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-display italic font-bold text-lg text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-brand-primary" />
              thông tin trận từ FIFA
            </h3>
            {match.details?.fifaMatchCentreUrl && (
              <a
                href={match.details.fifaMatchCentreUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[9px] font-mono uppercase tracking-widest text-brand-primary border border-brand-primary/30 px-3 py-1 hover:bg-brand-primary hover:text-black transition-colors"
              >
                Match Centre
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {detailsRows.map(([label, value]) => (
              <div key={label} className="bg-[#040D17] border border-white/5 p-3">
                <div className="text-[8px] font-mono text-text-muted uppercase tracking-widest font-bold">{label}</div>
                <div className="mt-1 text-[11px] text-white font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FIFA match history: head-to-head, recent form, lineups */}
      {insightsStatus === 'loading' && (
        <section className="bg-[#0A1622] border border-white/10 rounded-none p-8 text-center text-[10px] font-mono uppercase tracking-widest text-text-muted animate-pulse">
          Đang tải lịch sử đối đầu & phong độ từ FIFA…
        </section>
      )}

      {insightsStatus === 'ready' && insights && (
        <>
          {insights.powerRanking.length > 0 && (
            <section className="bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Zap className="w-4 h-4 text-brand-primary" />
                <h3 className="font-display italic font-bold text-lg text-white">power rankings</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {insights.powerRanking.map((leader) => (
                  <PowerRankingCard key={leader.category} leader={leader} />
                ))}
              </div>
            </section>
          )}

          {insights.stats && (
            <section className="bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Activity className="w-4 h-4 text-brand-primary" />
                <h3 className="font-display italic font-bold text-lg text-white">thống kê trận đấu</h3>
              </div>
              <LiveStatistics
                stats={insights.stats}
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                homeFlag={match.homeLogo}
                awayFlag={match.awayLogo}
              />
            </section>
          )}

          {insights.headToHead.length > 0 && (
            <section className="bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Swords className="w-4 h-4 text-brand-primary" />
                <h3 className="font-display italic font-bold text-lg text-white">lịch sử đối đầu</h3>
              </div>
              <div className="space-y-2">
                {insights.headToHead.map((item, index) => (
                  <HistoryRow key={item.matchId ?? index} item={item} />
                ))}
              </div>
            </section>
          )}

          {(insights.homeForm.length > 0 || insights.awayForm.length > 0) && (
            <section className="bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <History className="w-4 h-4 text-brand-primary" />
                <h3 className="font-display italic font-bold text-lg text-white">phong độ gần đây</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormColumn teamName={match.homeTeam} teamFlag={match.homeLogo} form={insights.homeForm} />
                <FormColumn teamName={match.awayTeam} teamFlag={match.awayLogo} form={insights.awayForm} />
              </div>
            </section>
          )}

          {(insights.homeLineup || insights.awayLineup) && (
            <section className="bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Shirt className="w-4 h-4 text-brand-primary" />
                <h3 className="font-display italic font-bold text-lg text-white">đội hình ra sân</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {insights.homeLineup && <LineupCard teamName={match.homeTeam} teamFlag={match.homeLogo} lineup={insights.homeLineup} />}
                {insights.awayLineup && <LineupCard teamName={match.awayTeam} teamFlag={match.awayLogo} lineup={insights.awayLineup} alignRight />}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
