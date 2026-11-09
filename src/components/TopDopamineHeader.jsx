import React, { useState } from 'react';
import { Flame, Trophy, Volume2, VolumeX, BarChart3, Filter, Target, Zap } from 'lucide-react';
import { playTap } from '../utils/sound';

export default function TopDopamineHeader({
  stats,
  currentFilter,
  onFilterChange,
  soundOn,
  onToggleSound,
  onOpenStats,
  onOpenStreakModal
}) {
  const profile = stats?.profile || {
    xp: 0,
    level: 1,
    title: 'Word Spark',
    streak_days: 1,
    words_studied_today: 0,
    daily_goal: 20,
    progressPercent: 20
  };

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const filters = [
    { id: 'all', label: 'Smart Feed (SRS + New)' },
    { id: 'due', label: 'Due Reviews Only' },
    { id: 'favorites', label: 'Bookmarked Words' },
    { id: 'a1_a2', label: 'Oxford A1-A2 Foundation' },
    { id: 'b1_b2', label: 'Oxford B1-B2 Advanced' },
    { id: 'mastered', label: 'Mastered Words' }
  ];

  const currentFilterLabel = filters.find(f => f.id === currentFilter)?.label || 'Smart Feed';

  return (
    <header className="w-full max-w-xl mx-auto px-4 pt-3 pb-2 z-30 select-none">
      <div className="flex items-center justify-between gap-3 bg-neutral-900/80 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl text-white">
        
        {/* 1. Streak Indicator */}
        <button
          onClick={() => {
            playTap();
            onOpenStreakModal();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/20 industrial-button"
          title="Twój nieprzerwany streak nauki"
        >
          <Flame className="w-4 h-4 fill-current text-amber-400" />
          <span className="font-mono-code font-bold text-xs tracking-wide">
            {profile.streak_days} {profile.streak_days === 1 ? 'DZIEŃ' : 'DNI'}
          </span>
        </button>

        {/* 2. Level & XP Progress Meter */}
        <div className="flex-1 max-w-[170px] md:max-w-[210px]">
          <div className="flex items-center justify-between text-[10px] font-mono-code mb-1">
            <span className="text-neutral-300 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e575]" /> LVL {profile.level}
            </span>
            <span className="text-neutral-400">
              {profile.xp} XP
            </span>
          </div>
          {/* Progress bar line */}
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-[#00e575] transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, profile.progressPercent || 20)}%` }}
            />
          </div>
        </div>

        {/* 3. Daily Target Pill */}
        <div
          className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10 text-xs font-mono-code text-neutral-300"
          title={`Cel dnia: ${profile.words_studied_today} z ${profile.daily_goal}`}
        >
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold">
            {profile.words_studied_today}/{profile.daily_goal}
          </span>
        </div>

        {/* 4. Controls: Stats & Sound */}
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
          <button
            onClick={() => {
              playTap();
              onOpenStats();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Statystyki SRS"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              playTap();
              onToggleSound();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title={soundOn ? 'Dźwięk aktywny' : 'Dźwięk wyciszony'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-[#00e575]" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
          </button>
        </div>
      </div>

      {/* Mode Selector Pill */}
      <div className="relative mt-2 flex items-center justify-between px-1">
        <button
          onClick={() => setFilterMenuOpen(!filterMenuOpen)}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/15 text-neutral-200 rounded-full border border-white/10 backdrop-blur-md text-xs font-mono-code transition-colors industrial-button"
        >
          <Filter className="w-3 h-3 text-cyan-400" />
          <span>{currentFilterLabel}</span>
          <span className="text-neutral-400 text-[10px]">▾</span>
        </button>

        <span className="text-[10px] font-mono-code tracking-wider uppercase text-neutral-400">
          OXFORD 3000™ • SM-2 ENGINE
        </span>

        {/* Dropdown Menu */}
        {filterMenuOpen && (
          <div className="absolute top-9 left-1 w-64 bg-neutral-900/95 border border-white/15 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-2xl animate-fade-in">
            <div className="text-[10px] font-mono-code font-semibold text-neutral-400 uppercase px-2 py-1 tracking-wider">
              Wybierz tryb nauki:
            </div>
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => {
                  playTap();
                  onFilterChange(f.id);
                  setFilterMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono-code transition-colors flex items-center justify-between ${
                  currentFilter === f.id
                    ? 'bg-white/15 text-white font-bold'
                    : 'text-neutral-300 hover:bg-white/5'
                }`}
              >
                <span>{f.label}</span>
                {currentFilter === f.id && <span className="text-[#00e575]">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
