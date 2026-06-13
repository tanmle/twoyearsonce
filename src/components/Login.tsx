import { FormEvent, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Player } from '../types';

interface LoginProps {
  players: Player[];
  isLoading: boolean;
  onLogin: (player: Player) => void;
}

export default function Login({ players, isLoading, onLogin }: LoginProps) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const matchedPlayer = players.find((candidate) => candidate.name.toLowerCase() === name.trim().toLowerCase());
  const requiresAdminPin = matchedPlayer?.role === 'admin';
  const adminPin = import.meta.env.VITE_ADMIN_PIN || '2026';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim().toLowerCase();
    const player = players.find((candidate) => candidate.name.toLowerCase() === normalized);

    if (!player) {
      setError('Không tìm thấy người chơi. Nhập đúng tên trong danh sách BeerCup.');
      return;
    }

    if (player.role === 'admin' && pin.trim() !== adminPin) {
      setError('PIN quản trị viên không đúng.');
      return;
    }

    setError('');
    setPin('');
    onLogin(player);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0A1622] border border-white/10 p-8 rounded-none space-y-6">
        <div className="space-y-2 border-b border-white/10 pb-5">
          <span className="text-[10px] uppercase tracking-[0.4em] text-brand-primary font-bold">
            Đăng nhập BeerCup
          </span>
          <h1 className="font-display italic font-medium text-4xl text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-brand-primary" />
            vào kèo
          </h1>
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest leading-relaxed">
            Nhập tên người chơi để đăng nhập. Quản trị viên cần nhập thêm PIN.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest font-bold">
              Tên người chơi
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VD: Huy"
              disabled={isLoading}
              className="w-full bg-[#040D17] border border-white/10 rounded-none px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-primary placeholder:text-text-muted/50"
            />
          </div>

          {requiresAdminPin && (
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-text-muted uppercase tracking-widest font-bold">
                PIN quản trị viên
              </label>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="PIN admin"
                disabled={isLoading}
                type="password"
                inputMode="numeric"
                className="w-full bg-[#040D17] border border-white/10 rounded-none px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-primary placeholder:text-text-muted/50"
              />
            </div>
          )}

          {error && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-status-lose leading-relaxed">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || players.length === 0}
            className="w-full bg-brand-primary text-black font-sans uppercase tracking-widest font-bold text-xs py-3.5 rounded-none cursor-pointer hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Đang tải dữ liệu...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="border-t border-white/5 pt-4">
          <p className="text-[9px] font-mono uppercase tracking-widest text-text-muted mb-3">
            Người chơi hiện có
          </p>
          <div className="flex flex-wrap gap-2">
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => {
                  setName(player.name);
                  setPin('');
                  setError('');
                }}
                className="border border-white/10 bg-[#040D17] hover:border-brand-primary text-text-muted hover:text-brand-primary px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest"
              >
                {player.name}{player.role === 'admin' ? ' • admin' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
