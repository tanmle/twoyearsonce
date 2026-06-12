import { Player } from '../types';
import { LayoutGrid, ListTodo, Trophy, Users, LogOut, Bell } from 'lucide-react';

interface SidebarProps {
  currentPlayer: Player;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Sidebar({
  currentPlayer,
  currentTab,
  setCurrentTab,
  onLogout,
}: SidebarProps) {
  // Navigation tabs definition
  const tabs = [
    { id: 'dashboard', label: 'Trophy Dashboard', icon: LayoutGrid },
    { id: 'matches', label: 'Fixtures & Scores', icon: ListTodo },
    { id: 'leaderboard', label: 'World cup standings', icon: Trophy },
    { id: 'profile', label: 'Fan credentials', icon: Users },
  ];

  return (
    <>
      {/* Top Mobile Bar (Compact Branding) */}
      <header className="lg:hidden fixed top-0 w-full z-40 bg-brand-surface/90 backdrop-blur-md border-b border-white/10">
        <div className="flex justify-between items-center px-4 py-3">
          <div className="flex flex-col">
            <h1 className="font-display font-extrabold text-xl text-white tracking-tight">
              Pred<span className="text-brand-primary">Cup</span>
            </h1>
            <span className="text-[8px] uppercase tracking-[0.3em] text-brand-primary font-bold">
              United 2026 • Active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-brand-primary hover:bg-brand-surface-high rounded-none transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-status-lose rounded-full"></span>
            </button>
            <div 
              onClick={() => setCurrentTab('profile')}
              className="w-8 h-8 rounded-none border border-brand-primary cursor-pointer overflow-hidden transition-all hover:scale-105"
            >
              <img
                src={currentPlayer.avatar}
                alt={currentPlayer.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      {/* SideNavBar (Desktop Shell) */}
      <nav className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 bg-brand-surface-low border-r border-white/10 p-6 gap-3 z-30 font-sans">
        <div className="mb-8">
          <div className="flex flex-col gap-1 mb-8">
            <span className="text-[9px] uppercase tracking-[0.4em] text-brand-primary font-bold">United 2026</span>
            <span className="text-[8px] uppercase tracking-[0.3em] opacity-40">USA • CANADA • MEXICO</span>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="font-display font-extrabold text-4xl text-white tracking-tighter cursor-pointer lowercase" onClick={() => setCurrentTab('dashboard')}>
              pred<span className="text-brand-primary">cup</span>
            </h1>
          </div>
          
          {/* Identity Info Card */}
          <div 
            onClick={() => setCurrentTab('profile')}
            className="mt-6 p-4 rounded-none border border-white/10 bg-brand-surface/40 hover:bg-brand-surface hover:border-brand-primary/40 transition-all cursor-pointer flex items-center gap-3 group"
          >
            <div className="relative">
              <img
                src={currentPlayer.avatar}
                alt={currentPlayer.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-none border border-brand-primary object-cover"
              />
              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-status-not-lose border border-brand-surface"></span>
            </div>
            <div className="overflow-hidden">
              <p className="font-sans font-bold text-xs text-white truncate group-hover:text-brand-primary transition-colors uppercase tracking-wider">
                {currentPlayer.name}
              </p>
              <p className="text-[10px] text-text-muted italic">
                Rank #{currentPlayer.id === 'huy' ? 3 : currentPlayer.id === 'anhquoc' ? 1 : 4} Fan ID
              </p>
            </div>
          </div>
        </div>

        {/* Tab Items */}
        <div className="flex flex-col gap-2 flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                className={`w-full font-sans uppercase tracking-[0.2em] text-[11px] rounded-none px-4 py-3 flex items-center gap-3 transition-all duration-200 cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#102133] text-white border-l-2 border-brand-primary'
                    : 'text-text-muted hover:text-white hover:bg-[#0A1622]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-primary' : 'text-text-muted'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Footer Logout */}
        <div className="mt-auto border-t border-white/5 pt-4">
          <button
            onClick={onLogout}
            className="w-full text-[10px] font-sans uppercase tracking-widest text-text-muted hover:text-status-lose hover:bg-[#110808] transition-all px-4 py-2.5 rounded-none flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Reset credentials</span>
          </button>
        </div>
      </nav>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-2 border-t border-white/10 bg-brand-surface/95 backdrop-blur-lg lg:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 transition-all text-xs gap-1 cursor-pointer ${
                isActive
                  ? 'text-brand-primary border-t-2 border-brand-primary rounded-none bg-brand-surface-high/20'
                  : 'text-text-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-mono text-[8px] uppercase tracking-wider">
                {tab.id === 'profile' ? 'Profile' : tab.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
