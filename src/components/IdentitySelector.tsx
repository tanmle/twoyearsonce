import { Player } from '../types';
import { UserCheck, ShieldCheck } from 'lucide-react';

interface IdentitySelectorProps {
  currentPlayer: Player;
  players: Player[];
  onSelectPlayer: (player: Player) => void;
}

export default function IdentitySelector({
  currentPlayer,
  players,
  onSelectPlayer,
}: IdentitySelectorProps) {
  // Sort players by total penalty descending to quickly calculate relative rankings
  const sortedPlayers = [...players].sort((a, b) => a.totalPenaltyVnd - b.totalPenaltyVnd);

  return (
    <div className="space-y-8 font-sans">
      {/* View Header */}
      <div className="border-white/10 border-b pb-6">
        <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
          FIFA Credentials Ledger • Stadium Entrance
        </span>
        <h2 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1 flex items-center gap-2 select-none">
          <ShieldCheck className="w-6 h-6 text-brand-primary animate-pulse" />
          nhận diện đấu thủ
        </h2>
        <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest leading-relaxed">
          Switch active identity to predict as different players and witness real-time FIFA rank reassignment!
        </p>
      </div>

      {/* Grid List of Players Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {players.map((player) => {
          const isSelected = player.id === currentPlayer.id;
          
          // Calculate individual rank
          const relativeRankIndex = sortedPlayers.findIndex((p) => p.id === player.id);
          const relativeRank = relativeRankIndex !== -1 ? relativeRankIndex + 1 : 4;

          return (
            <div
              key={player.id}
              onClick={() => onSelectPlayer(player)}
              className={`p-5 rounded-none cursor-pointer border transition-all duration-300 flex flex-col justify-between select-none relative group overflow-hidden ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]'
                  : 'border-white/10 bg-[#0A1622] hover:border-brand-primary/60 hover:bg-[#102133]'
              }`}
            >
              {/* Active selection ribbon badge */}
              {isSelected && (
                <div className="absolute top-0 right-0 py-1 px-3 bg-brand-primary text-black font-mono text-[8px] font-bold tracking-widest flex items-center gap-1 leading-none">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>ACTIVE PLAYER</span>
                </div>
              )}

              <div className="flex gap-4">
                {/* Avatar with relative rank capsule badge */}
                <div className="relative flex-shrink-0">
                  <img
                    src={player.avatar}
                    alt={player.name}
                    referrerPolicy="no-referrer"
                    className={`w-14 h-14 rounded-none object-cover border-2 ${
                      isSelected ? 'border-brand-primary' : 'border-white/10 group-hover:border-brand-primary/30'
                    }`}
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-none border border-black flex items-center justify-center font-display font-black text-[10px] bg-brand-primary text-black">
                    {relativeRank}
                  </span>
                </div>

                {/* Player textual details */}
                <div className="min-w-0 pr-4">
                  <h3 className="font-sans uppercase tracking-widest font-bold text-xs text-white group-hover:text-brand-primary transition-colors truncate">
                    {player.name}
                  </h3>
                  <p className="text-[9px] text-text-muted font-mono mt-1 font-bold uppercase tracking-widest">
                    Archives: {player.totalPredictionsCount}
                  </p>
                </div>
              </div>

              {/* Penalty information block */}
              <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
                <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest font-bold">
                  Penalty Accrued:
                </span>
                <span className={`font-mono font-bold ${
                  player.totalPenaltyVnd === 0 ? 'text-status-not-lose' : 'text-status-lose'
                }`}>
                  {player.totalPenaltyVnd === 0 ? '0 VND' : `${player.totalPenaltyVnd.toLocaleString('vi-VN')} VND`}
                </span>
              </div>
              
              <div className="text-center mt-3 text-[9px] font-mono uppercase tracking-widest text-brand-primary/60 group-hover:text-brand-primary transition-colors pt-2 border-t border-white/5">
                Switch Credentials →
              </div>

            </div>
          );
        })}
      </div>

      {/* Identity Selector Help Notes */}
      <div className="p-5 rounded-none border border-white/10 bg-[#0A1622] select-none text-xs text-text-muted leading-relaxed space-y-2">
        <h4 className="font-display italic font-bold text-brand-primary text-sm uppercase tracking-widest">Hướng dẫn thi đấu Sandbox:</h4>
        <p className="font-sans text-xs">
          Ứng dụng hỗ trợ thay đổi người chơi tức thời! Mỗi tài khoản sẽ có bảng dữ liệu cá nhân, thành tích phạt, và lịch sử dự đoán khác nhau. Khi bạn bấm cược hoặc dùng <strong>Sandbox mô phỏng kết quả</strong> trong Tab Match list, bảng xếp hạng Leaderboard sẽ tự động cập nhật thứ hạng và trật tự của toàn bộ người chơi.
        </p>
      </div>

    </div>
  );
}
