import React, { useState } from 'react';
import { Volume2, Heart, BookOpen } from 'lucide-react';
import { playTap, playGood } from '../utils/sound';

export default function RightActionRail({
  word,
  onSpeak,
  onToggleFavorite,
  onOpenDeepDive,
  currentAccent,
  onToggleAccent
}) {
  const [isPopping, setIsPopping] = useState(false);
  const isFavorite = Boolean(word.is_favorite);

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    setIsPopping(true);
    playGood();
    onToggleFavorite(word.id);
    setTimeout(() => setIsPopping(false), 500);
  };

  return (
    <div className="flex flex-col items-center gap-3 z-30 select-none py-2 px-1.5 rounded-full bg-black/60 sm:bg-black/40 backdrop-blur-2xl border border-white/15 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.9)]">
      
      {/* 1. Like / Save (Heart with Neon Pulse) */}
      <button
        onClick={handleFavoriteClick}
        className={`w-11 h-11 rounded-full border backdrop-blur-xl flex items-center justify-center transition-all duration-200 ${
          isPopping ? 'scale-125' : 'hover:scale-105 active:scale-95'
        } ${
          isFavorite
            ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_25px_rgba(244,63,94,0.7)]'
            : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/20 text-white shadow-[0_4px_16px_rgba(0,0,0,0.6)]'
        }`}
        title={isFavorite ? 'Zapisano w ulubionych' : 'Zapisz słowo'}
      >
        <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
      </button>

      {/* 2. Audio Pronunciation + UK/US Switcher */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            playTap();
            onSpeak(word);
          }}
          className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/20 backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
          title="Odsłuchaj wymowę (Oxford Audio)"
        >
          <Volume2 className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleAccent();
          }}
          className="-mt-1.5 z-10 px-2 py-0.5 text-[9px] font-tech-mono font-bold bg-neutral-900 text-white rounded-full border border-white/30 shadow-md hover:border-white/60 active:scale-95 transition-all"
          title="Przełącz akcent: UK / US"
        >
          {currentAccent === 'en-GB' ? 'UK' : 'US'}
        </button>
      </div>

      {/* 3. Full Multidimensional Oxford Profile */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          playTap();
          onOpenDeepDive(word);
        }}
        className="w-11 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/20 backdrop-blur-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
        title="Pełny profil Oxford 3000™"
      >
        <BookOpen className="w-5 h-5 text-white" />
      </button>

    </div>
  );
}