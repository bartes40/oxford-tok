import React from 'react';
import { X, Trophy, Flame, Brain, BarChart3, RefreshCcw, BookOpen } from 'lucide-react';
import { playTap } from '../utils/sound';
import StarGlint from './StarGlint';

export default function StatsModal({ stats, onClose, onResetProgress }) {
  if (!stats) return null;

  const { profile, srs, cefr } = stats;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-2xl flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#05070c] text-white w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] border-t sm:border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col"
      >
        
        {/* Header */}
        <div className="relative px-5 pt-4 pb-3 border-b border-white/15 flex items-center justify-between shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2 sm:hidden" />
          <div className="flex items-center gap-2">
            <StarGlint className="w-3.5 h-3.5 text-white animate-star-glint" />
            <span className="font-tech-mono font-bold text-xs uppercase tracking-widest text-neutral-300 truncate">
              STATYSTYKI & PAMIĘĆ SRS
            </span>
          </div>
          <button
            onClick={() => {
              playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center transition-all active:scale-95 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-5 sm:p-6 pb-safe-bottom overflow-y-auto no-scrollbar space-y-5 overscroll-contain">
          
          {/* Profile Overview Card */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/15 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-tech-mono uppercase text-neutral-400 tracking-wider">
                Poziom profilu
              </span>
              <h3 className="chrome-text-silver font-sans font-black text-2xl text-white mt-0.5">
                LVL {profile.level}: {profile.title}
              </h3>
              <p className="text-xs font-tech-mono text-neutral-400 mt-1">
                {profile.xp} XP • Cel dnia: {profile.words_studied_today} / {profile.daily_goal}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-2 rounded-xl border border-white/15">
              <Flame className="w-4 h-4 text-white fill-current" />
              <div className="text-right">
                <div className="text-[9px] font-tech-mono text-neutral-400 uppercase">Streak</div>
                <div className="font-tech-mono font-bold text-sm text-white">{profile.streak_days} DNI</div>
              </div>
            </div>
          </div>

          {/* SM-2 Spaced Repetition (SRS) Status Matrix */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-tech-mono font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              <Brain className="w-3.5 h-3.5 text-neutral-400" />
              Rozkład Pamięci Interwałowej (SM-2)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/10 text-center">
                <div className="text-[10px] font-tech-mono text-neutral-400 uppercase">Nowe</div>
                <div className="text-2xl font-bold font-sans text-neutral-100 mt-0.5">{srs?.new_words || 0}</div>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/10 text-center">
                <div className="text-[10px] font-tech-mono text-neutral-300 uppercase">Utrwalane</div>
                <div className="text-2xl font-bold font-sans text-white mt-0.5">{srs?.learning || 0}</div>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/10 text-center">
                <div className="text-[10px] font-tech-mono text-neutral-400 uppercase">Powtórki</div>
                <div className="text-2xl font-bold font-sans text-neutral-200 mt-0.5">{srs?.review || 0}</div>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/10 text-center">
                <div className="text-[10px] font-tech-mono text-white uppercase font-bold">Opanowane</div>
                <div className="text-2xl font-bold font-sans text-white mt-0.5">{srs?.mastered || 0}</div>
              </div>
            </div>
          </div>

          {/* CEFR Level Breakdown */}
          {cefr && cefr.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-tech-mono font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                Baza Oxford 3000 wg poziomów CEFR
              </div>
              <div className="space-y-2">
                {cefr.map(c => {
                  const percent = Math.round(((c.in_progress || 0) / (c.total || 1)) * 100);
                  return (
                    <div key={c.cefr_level} className="bg-white/[0.03] p-2.5 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between text-xs font-tech-mono mb-1.5">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-200">
                          <span className="bg-white text-black px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {c.cefr_level}
                          </span>
                          <span>Poziom {c.cefr_level}</span>
                        </span>
                        <span className="text-neutral-400">
                          {c.in_progress} / {c.total} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reset / Fresh start */}
          <div className="pt-2 border-t border-white/10">
            <button
              onClick={onResetProgress}
              className="text-xs font-tech-mono text-neutral-500 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Zresetuj postępy powtórek (dla testów)
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
