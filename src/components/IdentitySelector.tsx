import { FormEvent, useState } from 'react';
import { Player } from '../types';
import { UserCheck, ShieldCheck, Plus } from 'lucide-react';
import { formatBeerUnits } from '../domain/beerUnits';

interface IdentitySelectorProps {
  currentPlayer: Player;
  players: Player[];
  onAddPlayer: (name: string, avatar?: string) => void;
}

export default function IdentitySelector({
  currentPlayer,
  players,
  onAddPlayer,
}: IdentitySelectorProps) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerAvatar, setNewPlayerAvatar] = useState('');

  const handleAddPlayer = (event: FormEvent) => {
    event.preventDefault();
    onAddPlayer(newPlayerName, newPlayerAvatar || undefined);
    setNewPlayerName('');
    setNewPlayerAvatar('');
  };
  // Sort players by total penalty descending to quickly calculate relative rankings
  const sortedPlayers = [...players].sort((a, b) => a.totalPenaltyVnd - b.totalPenaltyVnd);

  return (
    <div className="space-y-8 font-sans">
      {/* View Header */}
      <div className="border-white/10 border-b pb-6">
        <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
          BeerCup • Tài khoản người chơi
        </span>
        <h2 className="font-display italic font-medium text-4xl text-white tracking-tight mt-1 flex items-center gap-2 select-none">
          <ShieldCheck className="w-6 h-6 text-brand-primary animate-pulse" />
          nhận diện đấu thủ
        </h2>
        <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest leading-relaxed">
          Switch active identity to predict as different players and witness real-time FIFA rank reassignment!
        </p>
      </div>

      <form onSubmit={handleAddPlayer} className="bg-[#0A1622] border border-white/10 rounded-none p-5 space-y-4">
        <div className="flex items-center gap-2 text-brand-primary">
          <Plus className="w-4 h-4" />
          <h3 className="font-display italic font-bold text-lg text-white">thêm người chơi</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-text-muted uppercase tracking-widest font-bold">
              Tên người chơi
            </label>
            <input
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
              placeholder="VD: Nam"
              className="w-full bg-[#040D17] border border-white/10 rounded-none px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary placeholder:text-text-muted/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-text-muted uppercase tracking-widest font-bold">
              Avatar URL (không bắt buộc)
            </label>
            <input
              value={newPlayerAvatar}
              onChange={(event) => setNewPlayerAvatar(event.target.value)}
              placeholder="Để trống sẽ tự tạo avatar"
              className="w-full bg-[#040D17] border border-white/10 rounded-none px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary placeholder:text-text-muted/50"
            />
          </div>
          <button
            type="submit"
            className="bg-brand-primary text-black font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-3 hover:bg-white transition-colors"
          >
            Thêm
          </button>
        </div>
      </form>

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
              className={`p-5 rounded-none border transition-all duration-300 flex flex-col justify-between select-none relative group overflow-hidden ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]'
                  : 'border-white/10 bg-[#0A1622]'
              }`}
            >
              {/* Active selection ribbon badge */}
              {isSelected && (
                <div className="absolute top-0 right-0 py-1 px-3 bg-brand-primary text-black font-mono text-[8px] font-bold tracking-widest flex items-center gap-1 leading-none">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>ĐANG CHỌN</span>
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
                    lượt: {player.totalPredictionsCount}
                  </p>
                </div>
              </div>

              {/* Penalty information block */}
              <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
                <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest font-bold">
                  Beer phạt:
                </span>
                <span className={`font-mono font-bold ${
                  player.totalPenaltyVnd === 0 ? 'text-status-not-lose' : 'text-status-lose'
                }`}>
                  {formatBeerUnits(player.totalPenaltyVnd)}
                </span>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
