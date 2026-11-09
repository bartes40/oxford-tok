import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  Heart,
  RotateCw,
  BookOpen
} from 'lucide-react';
import { playGood, playFlip, playTap } from '../utils/sound';
import StarGlint from './StarGlint';

export default function WordCard({
  word,
  onSpeak,
  isRevealed = false,
  onToggleReveal,
  onToggleFavorite,
  onOpenDeepDive,
  currentAccent = 'en-GB',
  onToggleAccent
}) {
  const [flyingHearts, setFlyingHearts] = useState([]);
  const cardRef = useRef(null);
  const clickTimerRef = useRef(null);
  const lastClickTimeRef = useRef(0);

  // Clear pending flip timer on word change or unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, [word.id]);

  // Tastefully highlight target word in English example (Silver/White Distressed Cyber Tape)
  const renderHighlightedExampleEn = (example, targetWord) => {
    if (!example || !targetWord) return example;
    try {
      const stem = targetWord.length > 4 ? targetWord.slice(0, -1) : targetWord;
      const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = example.split(new RegExp(`(\\b${escaped}\\w*\\b)`, 'gi'));
      return parts.map((part, i) => {
        if (part.toLowerCase().startsWith(stem.toLowerCase())) {
          return (
            <span
              key={i}
              className="silver-distressed-badge"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    } catch (e) {
      return example;
    }
  };

  // Tastefully highlight Polish keyword equivalents (Silver Distressed Jagged Underline & White Glow)
  const renderHighlightedExamplePl = (examplePl, definitionPl) => {
    if (!examplePl || !definitionPl) return examplePl;
    try {
      const terms = definitionPl
        .split(/[,;/]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);

      if (terms.length === 0) return examplePl;

      const stems = terms
        .map((t) => {
          const clean = t.replace(/^(się|do|na|w|z)\s+/i, '').split(/\s+/)[0];
          if (clean.length >= 6) return clean.slice(0, -2);
          if (clean.length >= 4) return clean.slice(0, -1);
          return clean;
        })
        .filter((s) => s.length >= 3)
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

      if (stems.length === 0) return examplePl;

      const regex = new RegExp(`(${stems.map((s) => `\\b${s}[a-ząćęłńóśźż]*`).join('|')})`, 'gi');
      const parts = examplePl.split(regex);

      return parts.map((part, i) => {
        if (regex.test(part)) {
          regex.lastIndex = 0;
          return (
            <span
              key={i}
              className="silver-distressed-underline"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    } catch (e) {
      return examplePl;
    }
  };

  // Format Polish translations into clean, scannable typography
  const plMissing =
    !word.definition_pl ||
    word.definition_pl.trim().toLowerCase() === (word.word || '').trim().toLowerCase() ||
    word.definition_pl.startsWith('Ładowanie');
  const polishMeanings = (plMissing ? '' : word.definition_pl || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const primaryMeaningPl = plMissing ? 'Tłumaczenie w przygotowaniu…' : polishMeanings[0] || word.definition_pl;
  const secondaryMeaningsPl = polishMeanings.slice(1, 4);

  const handleCardClick = (e) => {
    const now = Date.now();
    const diff = now - lastClickTimeRef.current;

    // Fast double tap detected (< 280ms) -> LIKE action, cancel flip!
    if (diff < 280 && diff > 0) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      lastClickTimeRef.current = 0;

      // Extract precise tap coordinate relative to the card for TikTok floating heart
      let x = 180;
      let y = 260;
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const clientX = e.clientX ?? (e.nativeEvent && e.nativeEvent.clientX);
        const clientY = e.clientY ?? (e.nativeEvent && e.nativeEvent.clientY);
        if (clientX !== undefined && clientY !== undefined) {
          x = clientX - rect.left;
          y = clientY - rect.top;
        } else {
          x = rect.width / 2;
          y = rect.height / 2;
        }
      }

      const heartId = Date.now() + Math.random();
      const heartRot = ((Math.random() - 0.5) * 36).toFixed(1) + 'deg';
      setFlyingHearts((prev) => [...prev, { id: heartId, x, y, rot: heartRot }]);

      setTimeout(() => {
        setFlyingHearts((prev) => prev.filter((h) => h.id !== heartId));
      }, 900);

      playGood();
      if (onToggleFavorite) onToggleFavorite(word.id);
      return;
    }

    // First tap detected -> schedule flip after 240ms debounce window
    lastClickTimeRef.current = now;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    clickTimerRef.current = setTimeout(() => {
      playFlip();
      if (onToggleReveal) onToggleReveal();
      clickTimerRef.current = null;
      lastClickTimeRef.current = 0;
    }, 240);
  };

  const displayedPhonetic =
    currentAccent === 'en-US' && word.phonetic_us ? word.phonetic_us : word.phonetic;

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className="relative w-full sm:max-w-md mx-auto h-full sm:max-h-[84dvh] perspective-1400 select-none cursor-pointer"
    >
      {/* TikTok Signature Flying Hearts at Tap Location (No Circle, Pure Floater) */}
      {flyingHearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute z-50 pointer-events-none animate-tiktok-heart"
          style={{
            left: `${heart.x}px`,
            top: `${heart.y}px`,
            '--heart-rot': heart.rot
          }}
        >
          <Heart className="w-16 h-16 sm:w-20 sm:h-20 text-[#fe2c55] fill-[#fe2c55] drop-shadow-[0_4px_24px_rgba(254,44,85,0.85)]" />
        </div>
      ))}

      {/* 3D Flipping Core Canvas */}
      <div
        className={`relative w-full h-full preserve-3d flip-card-inner ${
          isRevealed ? 'rotate-y-180' : ''
        }`}
      >
        {/* ============================================================ */}
        {/* AWERS (FRONT): High-Fashion Obsidian Chrome ("ASCENSION")    */}
        {/* Symmetrical padding, full width, integrated controls         */}
        {/* ============================================================ */}
        <div className="absolute inset-0 w-full h-full backface-hidden rounded-none sm:rounded-[36px] obsidian-card-surface text-white flex flex-col justify-between px-6 sm:px-8 card-pt-safe card-pb-safe sm:py-8 overflow-y-auto no-scrollbar">
          
          {/* 1. TOP TECHNICAL BAR: Level, POS, Słownik, Like, Quick Rotate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-tech-mono text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded bg-white text-black tracking-wider uppercase">
                {word.cefr_level || 'B2'}
              </span>
              <span className="font-tech-mono text-xs text-neutral-400 lowercase tracking-wide">
                {word.part_of_speech}
              </span>
            </div>

            {/* Quick Action Icons: Heart (Like), Book (Oxford Słownik), Rotate (Flip) */}
            <div className="flex items-center gap-2">
              {/* Like Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playGood();
                  if (onToggleFavorite) onToggleFavorite(word.id);
                }}
                className={`w-8 h-8 rounded-full border backdrop-blur-md flex items-center justify-center transition-all active:scale-90 ${
                  word.is_favorite
                    ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_16px_rgba(244,63,94,0.7)]'
                    : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/20 text-neutral-300 hover:text-white'
                }`}
                title={word.is_favorite ? 'Zapisano w ulubionych' : 'Polub słówko'}
              >
                <Heart className={`w-4 h-4 ${word.is_favorite ? 'fill-current text-white' : ''}`} />
              </button>

              {/* Oxford Profile / Słownik Button */}
              {onOpenDeepDive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playTap();
                    onOpenDeepDive(word);
                  }}
                  className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 flex items-center justify-center text-neutral-300 hover:text-white active:scale-90 transition-all"
                  title="Pełny słownik Oxford 3000™"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Flip Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playFlip();
                  if (onToggleReveal) onToggleReveal();
                }}
                className="inline-flex items-center gap-1.5 font-tech-mono text-[11px] text-neutral-300 bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 px-3 py-1 rounded-full border border-white/20 transition-all shadow-xs"
              >
                <RotateCw className="w-3 h-3 text-white animate-spin-slow" />
                <span>Obróć</span>
              </button>
            </div>
          </div>

          {/* 2. MIDDLE HERO SECTION: Chrome Typography, Audio, Large Definition & Context */}
          <div className="my-auto py-3 sm:py-5 flex flex-col justify-center min-h-0">
            
            {/* The English Headword in Liquid Chrome with Star Glints */}
            <div className="relative inline-block w-fit max-w-full">
              <h1
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(word);
                }}
                className="chrome-text font-sans font-black text-5xl xs:text-6xl sm:text-7xl tracking-tighter leading-[1.14] pb-1.5 break-words cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
              >
                {word.word}
              </h1>

              {/* Iconic 4-Point Star Lens Flares on letters */}
              <StarGlint className="absolute -top-3 -right-3 w-5 h-5 text-white/95 animate-star-glint" />
              <StarGlint
                className="absolute -bottom-2 -left-3 w-4 h-4 text-slate-200/90 animate-star-glint"
                style={{ animationDelay: '1.4s' }}
              />
            </div>

            {/* Phonetic Pronunciation Pill + UK/US Accent Switcher */}
            <div className="mt-3.5 sm:mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(word);
                }}
                className="inline-flex items-center gap-2 font-tech-mono font-semibold text-xs sm:text-sm text-neutral-100 bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 px-3.5 py-1.5 rounded-full border border-white/20 backdrop-blur-md transition-all shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                title="Odsłuchaj wymowę"
              >
                <Volume2 className="w-4 h-4 text-white" />
                <span>{displayedPhonetic}</span>
              </button>

              {onToggleAccent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAccent();
                  }}
                  className="px-2.5 py-1 text-[10px] font-tech-mono font-bold bg-white/[0.08] hover:bg-white/[0.16] text-neutral-200 hover:text-white rounded-full border border-white/20 active:scale-95 transition-all shadow-xs"
                  title="Przełącz akcent: UK / US"
                >
                  {currentAccent === 'en-GB' ? 'UK' : 'US'}
                </button>
              )}
            </div>

            {/* Clear, Prominent English Oxford Definition */}
            <p className="mt-5 sm:mt-7 text-lg xs:text-xl sm:text-2xl text-neutral-100 leading-snug sm:leading-relaxed font-semibold tracking-tight">
              {word.definition_en}
            </p>

            {/* Authentic Context Sentence with High-Fashion Technical Header */}
            {word.example_en && (
              <div className="mt-5 sm:mt-7 p-4 sm:p-5 rounded-2xl bg-white/[0.035] border border-white/[0.12] backdrop-blur-xs shadow-inner">
                <div className="flex items-center justify-between text-[10px] font-tech-mono text-neutral-400 uppercase tracking-widest mb-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                    EXAMPLE // CONTEXT
                  </span>
                  <span>OXFORD 3000™</span>
                </div>
                <p className="font-sans text-sm xs:text-base sm:text-lg text-neutral-200 font-normal italic leading-relaxed">
                  "{renderHighlightedExampleEn(word.example_en, word.word)}"
                </p>
              </div>
            )}
          </div>

          {/* 3. BOTTOM TECHNICAL FOOTER: Collocations & Technical Metadata */}
          <div className="pt-3 sm:pt-4 border-t border-white/[0.12] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
            {word.collocations && word.collocations.length > 0 ? (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                {word.collocations.slice(0, 3).map((col, idx) => (
                  <span
                    key={idx}
                    className="whitespace-nowrap px-3 py-1 bg-white/[0.05] border border-white/[0.1] text-neutral-300 text-xs font-tech-mono rounded-lg"
                  >
                    {col}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs font-tech-mono text-neutral-500 uppercase tracking-wider">
                OXFORD CORE LEXICON
              </span>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-block font-tech-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                DOTKNIJ ↻
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* REWERS (BACK): High-Fashion Noir Obsidian Chrome             */}
        {/* Symmetrical padding, full width, integrated controls         */}
        {/* ============================================================ */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-none sm:rounded-[36px] obsidian-card-surface text-white flex flex-col justify-between px-6 sm:px-8 card-pt-safe card-pb-safe sm:py-8 overflow-y-auto no-scrollbar">
          
          {/* 1. TOP TECHNICAL BAR: Level, POS, Słownik, Like, Return */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-tech-mono text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded bg-white text-black tracking-wider uppercase shadow-[0_0_12px_rgba(255,255,255,0.45)]">
                  {word.cefr_level || 'B2'}
                </span>
                <span className="font-tech-mono text-xs text-neutral-300 font-semibold tracking-wide uppercase">
                  POLISH // PL
                </span>
              </div>

              {/* Action Buttons: Like, Oxford Profile, Flip Back */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playGood();
                    if (onToggleFavorite) onToggleFavorite(word.id);
                  }}
                  className={`w-8 h-8 rounded-full border backdrop-blur-md flex items-center justify-center transition-all active:scale-90 ${
                    word.is_favorite
                      ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_16px_rgba(244,63,94,0.7)]'
                      : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/20 text-neutral-300 hover:text-white'
                  }`}
                  title={word.is_favorite ? 'Zapisano w ulubionych' : 'Polub słówko'}
                >
                  <Heart className={`w-4 h-4 ${word.is_favorite ? 'fill-current text-white' : ''}`} />
                </button>

                {onOpenDeepDive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playTap();
                      onOpenDeepDive(word);
                    }}
                    className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 flex items-center justify-center text-neutral-300 hover:text-white active:scale-90 transition-all"
                    title="Pełny słownik Oxford 3000™"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playFlip();
                    if (onToggleReveal) onToggleReveal();
                  }}
                  className="inline-flex items-center gap-1.5 font-tech-mono text-[11px] text-neutral-300 bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 px-3 py-1 rounded-full border border-white/20 transition-all shadow-xs"
                >
                  <RotateCw className="w-3 h-3 text-white animate-spin-slow" />
                  <span>Powrót</span>
                </button>
              </div>
            </div>

            {/* Clean Technical Divider Line */}
            <div className="mt-3 sm:mt-4 border-b border-white/[0.12] flex items-center justify-between">
              <span className="text-[10px] font-tech-mono text-neutral-500">REF: EX_01</span>
              <span className="text-[10px] font-tech-mono text-neutral-500">OXFORD.EDU</span>
            </div>
          </div>

          {/* 2. MIDDLE HERO SECTION: Massive Polish Meaning, Pills, Context & Collocations */}
          <div className="my-auto py-3 sm:py-5 flex flex-col justify-center min-h-0">
            {/* The Polish Meaning in Silver Liquid Chrome Typography */}
            <div className="relative inline-block w-fit max-w-full">
              <h2 className="chrome-text-silver font-sans font-black text-5xl xs:text-6xl sm:text-7xl tracking-tighter leading-[1.12] pb-2 break-words">
                {primaryMeaningPl}
              </h2>
              <StarGlint className="absolute -top-3 -right-3 w-5 h-5 text-white/95 animate-star-glint" />
              <StarGlint
                className="absolute -bottom-2 -left-3 w-4 h-4 text-slate-200/90 animate-star-glint"
                style={{ animationDelay: '1.4s' }}
              />
            </div>

            {/* Secondary Meaning Pills in Frosted Obsidian Glass */}
            {secondaryMeaningsPl.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3.5 sm:mt-4">
                {secondaryMeaningsPl.map((syn, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 font-tech-mono text-xs sm:text-sm border border-white/15 backdrop-blur-md shadow-xs"
                  >
                    {syn}
                  </span>
                ))}
              </div>
            )}

            {/* Context Box: English Oxford Example + Polish Translation */}
            {word.example_en ? (
              <div className="mt-5 sm:mt-6 p-4 sm:p-5 rounded-2xl bg-white/[0.035] border border-white/[0.12] backdrop-blur-xs shadow-inner space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-tech-mono text-neutral-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
                    PRZYKŁAD W KONTEKŚCIE
                  </span>
                  <span>OXFORD 3000™</span>
                </div>
                <p className="font-sans text-base xs:text-lg sm:text-xl font-medium text-neutral-100 leading-snug sm:leading-relaxed">
                  "{renderHighlightedExampleEn(word.example_en, word.word)}"
                </p>
                {word.example_pl && (
                  <p className="font-sans text-sm xs:text-base sm:text-lg text-neutral-300 font-normal leading-relaxed pt-2 border-t border-white/[0.08]">
                    {renderHighlightedExamplePl(word.example_pl, word.definition_pl)}
                  </p>
                )}
              </div>
            ) : null}

            {/* Collocations block in Obsidian Glass */}
            {word.collocations && word.collocations.length > 0 && (
              <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-white/[0.025] border border-white/[0.1] backdrop-blur-xs">
                <div className="text-[10px] font-tech-mono font-bold text-neutral-400 uppercase tracking-widest mb-2">
                  Typowe połączenia (Collocations)
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {word.collocations.slice(0, 3).map((col, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-neutral-200 text-xs sm:text-sm font-tech-mono"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. BOTTOM FOOTER: Word Reference, Audio & Return Button */}
          <div className="pt-3 sm:pt-4 border-t border-white/[0.12] flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(word);
                }}
                className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
                title="Odsłuchaj"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <span className="font-sans font-bold text-sm text-white">
                {word.word}
              </span>
              <span className="text-xs font-tech-mono text-neutral-400">
                [{word.cefr_level || 'B2'}]
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-block font-tech-mono text-[10px] text-neutral-500 uppercase tracking-widest">
                DOTKNIJ ↻
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playFlip();
                  if (onToggleReveal) onToggleReveal();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-tech-mono text-white bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 px-3.5 py-1 rounded-full border border-white/20 transition-all cursor-pointer font-semibold shadow-xs"
              >
                <RotateCw className="w-3.5 h-3.5 text-white" />
                <span>Powrót</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}