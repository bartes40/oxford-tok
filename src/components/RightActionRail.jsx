import React, { useState } from 'react';
import { Volume2, Heart, BookOpen, RotateCw, Zap, Share2, Check, Flame } from 'lucide-react';
import { playTap, playGood, playFlip } from '../utils/sound';

export default function RightActionRail({
  word,
  onSpeak,
  onToggleFavorite,
  onOpenDeepDive,
  onToggleReveal,
  onOpenQuiz,
  onOpenStats,
  currentAccent,
  onToggleAccent
}) {
  const [isPopping, setIsPopping] = useState(false);
  const [copied, setCopied] = useState(false);
  const isFavorite = Boolean(word.is_favorite);

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    setIsPopping(true);
    playGood();
    if (onToggleFavorite) onToggleFavorite(word.id);
    setTimeout(() => setIsPopping(false), 500);
  };

  const handleCopyClick = (e) => {
    e.stopPropagation();
    playTap();
    const textToCopy = `${word.word} [${word.phonetic || ''}] - ${word.definition_pl || word.definition_en}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside
      aria-label="TikTok Actions"
      className="flex flex-col items-center gap-2.5 sm:gap-3 z-30 select-none py-2.5 px-1.5 rounded-full bg-black/60 sm:bg-black/45 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_-6px_rgba(0,0,0,0.9)] transition-all"
    >
      {/* 1. Sparky Avatar & Streak Pulse (Opens Stats) */}
      {onOpenStats && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playTap();
            onOpenStats();
          }}
          className="relative group w-11 h-11 rounded-full bg-linear-to-b from-white/20 to-white/5 border border-white/25 flex items-center justify-center text-white active:scale-95 transition-all shadow-md"
          title="Twój Profil & Statystyki SRS"
        >
          <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
          <span className="absolute -bottom-1 -right-0.5 px-1 py-0.2 bg-[#00e575] text-black font-tech-mono font-bold text-[8px] rounded-full shadow-xs">
            XP
          </span>
        </button>
      )}

      {/* 2. Like / Favorite (TikTok Heart with Pop Glow) */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={handleFavoriteClick}
          className={`w-11 h-11 rounded-full border backdrop-blur-xl flex items-center justify-center transition-all duration-200 active:scale-90 ${
            isPopping ? 'scale-125' : 'hover:scale-105'
          } ${
            isFavorite
              ? 'bg-[#fe2c55] border-[#fe2c55] text-white shadow-[0_0_24px_rgba(254,44,85,0.8)]'
              : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/20 text-white shadow-[0_4px_16px_rgba(0,0,0,0.6)]'
          }`}
          title={isFavorite ? 'W ulubionych' : 'Dodaj do ulubionych'}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current text-white' : 'text-white'}`} />
        </button>
        <span className="font-tech-mono text-[9px] text-neutral-300 font-semibold tracking-wider">
          {isFavorite ? 'SAVED' : 'SAVE'}
        </span>
      </div>

      {/* 3. Audio Pronunciation + Accent Tag */}
      <div className="relative flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playTap();
            if (onSpeak) onSpeak(word);
          }}
          className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/20 backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
          title="Odsłuchaj wymowę Oxford"
        >
          <Volume2 className="w-5 h-5 text-white" />
        </button>
        {onToggleAccent && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAccent();
            }}
            className="-mt-1.5 z-10 px-1.5 py-0.5 text-[8px] font-tech-mono font-bold bg-neutral-900 text-white rounded-full border border-white/30 shadow-xs hover:border-white/60 active:scale-90 transition-all"
            title="Przełącz akcent UK / US"
          >
            {currentAccent === 'en-GB' ? 'UK' : 'US'}
          </button>
        )}
      </div>

      {/* 4. Flip 3D (Obróć Fiszkę) */}
      {onToggleReveal && (
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playFlip();
              onToggleReveal();
            }}
            className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/20 backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
            title="Obróć fiszkę (3D Flip)"
          >
            <RotateCw className="w-4 h-4 text-cyan-300 animate-spin-slow" />
          </button>
          <span className="font-tech-mono text-[9px] text-cyan-300 font-semibold tracking-wider">
            FLIP
          </span>
        </div>
      )}

      {/* 5. Oxford Deep Dive Profile */}
      {onOpenDeepDive && (
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playTap();
              onOpenDeepDive(word);
            }}
            className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/20 backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
            title="Pełny słownik Oxford 3000™"
          >
            <BookOpen className="w-4 h-4 text-white" />
          </button>
          <span className="font-tech-mono text-[9px] text-neutral-300 font-semibold tracking-wider">
            INFO
          </span>
        </div>
      )}

      {/* 6. Pop Quiz Challenge */}
      {onOpenQuiz && (
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playTap();
              onOpenQuiz();
            }}
            className="w-11 h-11 rounded-full bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_0_16px_rgba(251,191,36,0.3)]"
            title="Szybki Quiz (+25 XP)"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
          </button>
          <span className="font-tech-mono text-[9px] text-amber-300 font-semibold tracking-wider">
            QUIZ
          </span>
        </div>
      )}

      {/* 7. Quick Copy / Share Card */}
      <button
        type="button"
        onClick={handleCopyClick}
        className="w-9 h-9 mt-1 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-neutral-300 hover:text-white border border-white/15 backdrop-blur-xl flex items-center justify-center transition-all active:scale-90"
        title="Skopiuj fiszkę do schowka"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
}
