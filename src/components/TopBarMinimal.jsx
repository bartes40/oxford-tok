import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
  Search,
  Compass,
  Check,
  Zap,
  Flame
} from 'lucide-react';
import { playTap } from '../utils/sound';
import StarGlint from './StarGlint';

export default function TopBarMinimal({
  currentFilter,
  onFilterChange,
  soundOn,
  onToggleSound,
  onOpenBrowser,
  onOpenQuiz,
  onOpenStats
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filters = [
    { id: 'all', label: 'Wszystkie poziomy', code: 'ALL' },
    { id: 'a1_a2', label: 'Poziom A1–A2 (Podstawowy)', code: 'A1-A2' },
    { id: 'b1_b2', label: 'Poziom B1–C1 (Zaawansowany)', code: 'B1-C1' },
    { id: 'favorites', label: 'Zapisane słówka', code: 'SAVED' }
  ];

  return (
    <>
      {/* High-Fashion Noir Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-30 px-3 sm:px-6 pt-safe-top pb-2 flex items-center justify-between pointer-events-none select-none">
        
        {/* Left: Słówka (Catalog Oxford 3000™) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => {
              playTap();
              if (onOpenBrowser) onOpenBrowser();
            }}
            className="group flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-1.5 bg-black/80 hover:bg-black/95 text-white rounded-full border border-white/20 backdrop-blur-2xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8)] active:scale-95 transition-all"
            title="Katalog słówek Oxford 3000™"
          >
            <Compass className="w-3.5 h-3.5 text-white/90" />
            <span className="font-tech-mono text-[11px] sm:text-xs font-bold text-white tracking-wider">
              SŁÓWKA
            </span>
            <span className="font-tech-mono text-[9px] sm:text-[10px] text-neutral-400 bg-white/10 px-1.5 py-0.5 rounded font-semibold">
              4979
            </span>
            <Search className="w-3 h-3 text-neutral-400 group-hover:text-white transition-colors ml-0.5" />
          </button>
        </div>

        {/* Right: Quiz, Streak, Sound & Filter Triggers */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {onOpenQuiz && (
            <button
              type="button"
              onClick={() => {
                playTap();
                onOpenQuiz();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/35 backdrop-blur-2xl shadow-xs active:scale-95 transition-all text-[11px] font-tech-mono font-bold"
              title="Szybki Quiz (+25 XP)"
            >
              <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
              <span className="hidden xs:inline">QUIZ</span>
            </button>
          )}

          {onOpenStats && (
            <button
              type="button"
              onClick={() => {
                playTap();
                onOpenStats();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-white/[0.08] hover:bg-white/[0.16] text-white rounded-full border border-white/20 backdrop-blur-2xl shadow-xs active:scale-95 transition-all text-[11px] font-tech-mono font-bold"
              title="Statystyki i Dni Streaka"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400 animate-pulse" />
              <span className="hidden xs:inline">STREAK</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => {
              playTap();
              onToggleSound();
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/75 hover:bg-black/90 text-neutral-200 hover:text-white border border-white/20 backdrop-blur-2xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8)] flex items-center justify-center transition-all active:scale-95"
            title={soundOn ? 'Dźwięk aktywny' : 'Wyciszono'}
          >
            {soundOn ? (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500" />
            )}
          </button>

          {/* Level Filter Trigger */}
          <button
            onClick={() => {
              playTap();
              setDrawerOpen(true);
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/75 hover:bg-black/90 text-neutral-200 hover:text-white border border-white/20 backdrop-blur-2xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.8)] flex items-center justify-center transition-all active:scale-95"
            title="Filtruj poziom"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Obsidian High-Fashion Filter Drawer */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[85vw] max-w-xs h-full bg-[#05070c] border-l border-white/15 px-5 pt-safe-top pb-safe-bottom shadow-2xl flex flex-col justify-between"
          >
            <div className="pt-2">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <StarGlint className="w-3.5 h-3.5 text-white animate-star-glint" />
                  <span className="font-tech-mono font-bold text-xs uppercase tracking-widest text-neutral-300">
                    FILTR SŁÓWEK // LEVEL
                  </span>
                </div>
                <button
                  onClick={() => {
                    playTap();
                    setDrawerOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Options */}
              <div className="space-y-2">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      playTap();
                      onFilterChange(f.id);
                      setDrawerOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl text-xs font-tech-mono transition-all flex items-center justify-between border ${
                      currentFilter === f.id
                        ? 'bg-white text-black font-bold border-white shadow-lg'
                        : 'bg-white/[0.04] text-neutral-300 border-white/10 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="text-[10px] opacity-75 font-bold">
                      {currentFilter === f.id ? <Check className="w-3.5 h-3.5 inline" /> : f.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Open Full Dictionary Button */}
            <button
              onClick={() => {
                setDrawerOpen(false);
                if (onOpenBrowser) onOpenBrowser();
              }}
              className="w-full py-3.5 px-4 mb-2 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-tech-mono text-xs font-semibold flex items-center justify-center gap-2 border border-white/20 transition-all shadow-md active:scale-95"
            >
              <Compass className="w-4 h-4 text-cyan-300" />
              <span>KATALOG OXFORD 3000™</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}