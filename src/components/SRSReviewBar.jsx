import React from 'react';
import { playAgain, playGood, playEasy, playTap } from '../utils/sound';

export default function SRSReviewBar({ word, onRate, disabled = false }) {
  const intervals = word.intervals || {
    again: '1m',
    hard: '1d',
    good: '3d',
    easy: '6d'
  };

  const handleRate = (rating) => {
    if (disabled) return;
    if (rating === 1) playAgain();
    else if (rating === 2) playTap();
    else if (rating === 3) playGood();
    else if (rating === 4) playEasy();

    onRate(word.id, rating);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 pb-3 pt-1">
      <div className="bg-neutral-900/70 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-xl grid grid-cols-4 gap-1.5">
        {/* Rating 1: Again */}
        <button
          onClick={() => handleRate(1)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/5 hover:bg-rose-500/15 text-neutral-200 hover:text-white rounded-xl border border-white/5 hover:border-rose-500/30 industrial-button disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="font-mono-code font-bold text-[10px] tracking-wider uppercase text-rose-400">
              AGAIN
            </span>
          </div>
          <div className="text-[10px] font-mono-code text-neutral-400">
            +{intervals.again} <span className="opacity-50">[1]</span>
          </div>
        </button>

        {/* Rating 2: Hard */}
        <button
          onClick={() => handleRate(2)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/5 hover:bg-amber-500/15 text-neutral-200 hover:text-white rounded-xl border border-white/5 hover:border-amber-500/30 industrial-button disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="font-mono-code font-bold text-[10px] tracking-wider uppercase text-amber-300">
              HARD
            </span>
          </div>
          <div className="text-[10px] font-mono-code text-neutral-400">
            +{intervals.hard} <span className="opacity-50">[2]</span>
          </div>
        </button>

        {/* Rating 3: Good */}
        <button
          onClick={() => handleRate(3)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/5 hover:bg-emerald-500/15 text-neutral-200 hover:text-white rounded-xl border border-white/5 hover:border-emerald-500/30 industrial-button disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono-code font-bold text-[10px] tracking-wider uppercase text-emerald-400">
              GOOD
            </span>
          </div>
          <div className="text-[10px] font-mono-code text-neutral-400">
            +{intervals.good} <span className="opacity-50">[3]</span>
          </div>
        </button>

        {/* Rating 4: Easy */}
        <button
          onClick={() => handleRate(4)}
          disabled={disabled}
          className="group relative flex flex-col items-center justify-center py-2 px-1 bg-white/5 hover:bg-cyan-500/15 text-neutral-200 hover:text-white rounded-xl border border-white/5 hover:border-cyan-500/30 industrial-button disabled:opacity-40"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="font-mono-code font-bold text-[10px] tracking-wider uppercase text-cyan-300">
              EASY
            </span>
          </div>
          <div className="text-[10px] font-mono-code text-neutral-400">
            +{intervals.easy} <span className="opacity-50">[4]</span>
          </div>
        </button>
      </div>
    </div>
  );
}
