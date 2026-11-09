import React from 'react';
import { playAgain, playGood, playEasy, playTap } from '../utils/sound';

export default function SRSReviewBar({ word, onRate, disabled = false }) {
  const intervals = word?.intervals || {
    again: '1m',
    hard: '1d',
    good: '3d',
    easy: '6d'
  };

  const handleRate = (e, rating) => {
    e.stopPropagation();
    if (disabled || !onRate) return;
    if (rating === 1) playAgain();
    else if (rating === 2) playTap();
    else if (rating === 3) playGood();
    else if (rating === 4) playEasy();

    onRate(word.id, rating);
  };

  return (
    <div className="w-full select-none pt-2">
      <div className="bg-black/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.8)] grid grid-cols-4 gap-1.5 sm:gap-2">
        {/* Rating 1: Again */}
        <button
          type="button"
          onClick={(e) => handleRate(e, 1)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/[0.04] hover:bg-rose-500/20 active:bg-rose-500/30 text-neutral-200 hover:text-white rounded-xl border border-white/10 hover:border-rose-500/50 transition-all active:scale-95 disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="font-tech-mono font-bold text-[10px] sm:text-[11px] tracking-wider uppercase text-rose-400">
              AGAIN
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-tech-mono text-neutral-400 mt-0.5">
            +{intervals.again} <span className="opacity-40">[1]</span>
          </span>
        </button>

        {/* Rating 2: Hard */}
        <button
          type="button"
          onClick={(e) => handleRate(e, 2)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/[0.04] hover:bg-amber-500/20 active:bg-amber-500/30 text-neutral-200 hover:text-white rounded-xl border border-white/10 hover:border-amber-500/50 transition-all active:scale-95 disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <span className="font-tech-mono font-bold text-[10px] sm:text-[11px] tracking-wider uppercase text-amber-300">
              HARD
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-tech-mono text-neutral-400 mt-0.5">
            +{intervals.hard} <span className="opacity-40">[2]</span>
          </span>
        </button>

        {/* Rating 3: Good */}
        <button
          type="button"
          onClick={(e) => handleRate(e, 3)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/[0.04] hover:bg-emerald-500/20 active:bg-emerald-500/30 text-neutral-200 hover:text-white rounded-xl border border-white/10 hover:border-emerald-500/50 transition-all active:scale-95 disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-tech-mono font-bold text-[10px] sm:text-[11px] tracking-wider uppercase text-emerald-400">
              GOOD
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-tech-mono text-neutral-400 mt-0.5">
            +{intervals.good} <span className="opacity-40">[3]</span>
          </span>
        </button>

        {/* Rating 4: Easy */}
        <button
          type="button"
          onClick={(e) => handleRate(e, 4)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/[0.04] hover:bg-cyan-500/20 active:bg-cyan-500/30 text-neutral-200 hover:text-white rounded-xl border border-white/10 hover:border-cyan-500/50 transition-all active:scale-95 disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="font-tech-mono font-bold text-[10px] sm:text-[11px] tracking-wider uppercase text-cyan-300">
              EASY
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-tech-mono text-neutral-400 mt-0.5">
            +{intervals.easy} <span className="opacity-40">[4]</span>
          </span>
        </button>
      </div>
    </div>
  );
}
