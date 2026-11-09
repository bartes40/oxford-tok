import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import {
  Volume2,
  Heart,
  RotateCw,
  BookOpen
} from 'lucide-react';
import { playGood, playFlip, playTap } from '../utils/sound';
import StarGlint from './StarGlint';

// Pure helper to format Polish definitions without recreating function every render
function splitDefinitions(str = '') {
  const result = [];
  let current = '';
  let inParen = 0;
  for (const ch of str) {
    if (ch === '(') inParen++;
    else if (ch === ')') inParen = Math.max(0, inParen - 1);
    if ((ch === ',' || ch === ';') && inParen === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

// Tastefully scale large typography so words fit gracefully without clipping
function getHeadingSizeClass(text = '') {
  const clean = (text || '').trim();
  const len = clean.length;
  if (len <= 6) {
    return 'text-4xl xs:text-5xl sm:text-6xl';
  }
  if (len <= 10) {
    return 'text-3xl xs:text-4xl sm:text-5xl';
  }
  if (len <= 16) {
    return 'text-2xl xs:text-3xl sm:text-4xl';
  }
  if (len <= 24) {
    return 'text-xl xs:text-2xl sm:text-3xl';
  }
  if (len <= 36) {
    return 'text-lg xs:text-xl sm:text-2xl';
  }
  return 'text-base xs:text-lg sm:text-xl';
}

function WordCardComponent({
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
  const [shuffleDirection, setShuffleDirection] = useState(null); // null | 'to-back' | 'to-front'
  const cardRef = useRef(null);
  const clickTimerRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const lastFlipTimeRef = useRef(0);
  const isRapidClickingRef = useRef(false);
  const rapidResetTimerRef = useRef(null);
  const pendingFirstTapPosRef = useRef(null);
  const heartTimersRef = useRef(new Set());
  const prevWordIdRef = useRef(word.id);
  const prevRevealedRef = useRef(isRevealed);
  const animTimeoutRef = useRef(null);

  // Tactile, premium card shuffle reveal trigger
  const triggerFlip = () => {
    const now = Date.now();
    if (now - lastFlipTimeRef.current < 460) return;
    lastFlipTimeRef.current = now;
    playFlip();
    if (onToggleReveal) onToggleReveal();
  };

  // Coordinated slow-to-fast shuffle animation when toggling reveal
  useEffect(() => {
    // If the word changed (e.g. user scrolled in the feed), reset instantly with NO animation
    if (prevWordIdRef.current !== word.id) {
      prevWordIdRef.current = word.id;
      prevRevealedRef.current = isRevealed;
      setShuffleDirection(null);
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
      return;
    }

    // When toggling reveal on the active card, trigger tactile deck shuffle
    if (prevRevealedRef.current !== isRevealed) {
      const dir = isRevealed ? 'to-back' : 'to-front';
      prevRevealedRef.current = isRevealed;
      setShuffleDirection(dir);

      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }
      animTimeoutRef.current = setTimeout(() => {
        setShuffleDirection(null);
        animTimeoutRef.current = null;
      }, 520);
    }
  }, [word.id, isRevealed]);

  // Clear pending flip and rapid timers on word change or unmount
  useEffect(() => {
    isRapidClickingRef.current = false;
    lastClickTimeRef.current = 0;
    pendingFirstTapPosRef.current = null;
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      if (rapidResetTimerRef.current) {
        clearTimeout(rapidResetTimerRef.current);
        rapidResetTimerRef.current = null;
      }
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
      heartTimersRef.current.forEach((t) => clearTimeout(t));
      heartTimersRef.current.clear();
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
  const plMissing = useMemo(() => {
    return (
      !word.definition_pl ||
      word.definition_pl.trim().toLowerCase() === (word.word || '').trim().toLowerCase() ||
      word.definition_pl.startsWith('Ładowanie')
    );
  }, [word.definition_pl, word.word]);

  const polishMeanings = useMemo(() => {
    return plMissing ? [] : splitDefinitions(word.definition_pl);
  }, [plMissing, word.definition_pl]);

  const primaryMeaningPl = useMemo(() => {
    return plMissing ? 'Tłumaczenie w przygotowaniu…' : polishMeanings[0] || word.definition_pl;
  }, [plMissing, polishMeanings, word.definition_pl]);

  const secondaryMeaningsPl = useMemo(() => {
    return polishMeanings.slice(1, 4);
  }, [polishMeanings]);

  // Memoized highlighted examples to completely avoid regex parsing on every animation tick
  const highlightedExampleEn = useMemo(() => {
    return renderHighlightedExampleEn(word.example_en, word.word);
  }, [word.example_en, word.word]);

  const highlightedExamplePl = useMemo(() => {
    return renderHighlightedExamplePl(word.example_pl, word.definition_pl);
  }, [word.example_pl, word.definition_pl]);

  // Helper to spawn floating heart at specific coordinates
  const spawnFlyingHeart = (x, y) => {
    const heartId = Date.now() + Math.random();
    const heartRot = ((Math.random() - 0.5) * 44).toFixed(1) + 'deg';
    const offsetX = (Math.random() - 0.5) * 22;
    const offsetY = (Math.random() - 0.5) * 18;
    setFlyingHearts((prev) => [
      ...prev.slice(-30),
      { id: heartId, x: Math.round(x + offsetX), y: Math.round(y + offsetY), rot: heartRot }
    ]);

    const timer = setTimeout(() => {
      setFlyingHearts((prev) => prev.filter((h) => h.id !== heartId));
      heartTimersRef.current.delete(timer);
    }, 900);
    heartTimersRef.current.add(timer);
  };

  const handleCardClick = (e) => {
    // If clicked on an interactive button, audio, or modal trigger, ignore
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('[data-no-flip]')) {
      return;
    }

    // Extract exact tap coordinates relative to the card for TikTok floating heart
    let x = 180;
    let y = 260;
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const clientX = e.clientX ?? (e.nativeEvent && e.nativeEvent.clientX);
      const clientY = e.clientY ?? (e.nativeEvent && e.nativeEvent.clientY);
      if (clientX !== undefined && clientY !== undefined && clientX >= rect.left && clientX <= rect.right) {
        x = clientX - rect.left;
        y = clientY - rect.top;
      } else {
        x = rect.width / 2;
        y = rect.height / 2;
      }
    }

    const now = Date.now();
    const diff = now - lastClickTimeRef.current;
    const DOUBLE_TAP_THRESHOLD = 290; // ms threshold between clicks for double-tap
    const RAPID_STREAK_DELAY = 380;   // ms before ending rapid streak

    // Check if this tap is part of a rapid clicking sequence (double-tap, multi-tap, infinite spam)
    const isRapid = isRapidClickingRef.current || (diff > 0 && diff < DOUBLE_TAP_THRESHOLD);

    if (isRapid) {
      // 1. Instantly cancel any scheduled card flip! Fast clicks NEVER flip the card!
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      // 2. Mark rapid mode active and refresh reset timer
      isRapidClickingRef.current = true;
      lastClickTimeRef.current = now;

      if (rapidResetTimerRef.current) {
        clearTimeout(rapidResetTimerRef.current);
      }
      rapidResetTimerRef.current = setTimeout(() => {
        isRapidClickingRef.current = false;
        lastClickTimeRef.current = 0;
        pendingFirstTapPosRef.current = null;
      }, RAPID_STREAK_DELAY);

      // 3. Spawn floating hearts:
      // If this was tap 2, also reward tap 1's coordinate so no clicks are missed
      if (pendingFirstTapPosRef.current) {
        spawnFlyingHeart(pendingFirstTapPosRef.current.x, pendingFirstTapPosRef.current.y);
        pendingFirstTapPosRef.current = null;
      }
      spawnFlyingHeart(x, y);

      // 4. Play heart reward sound
      playGood();

      // 5. Ensure word is liked (giving heart can only ADD, never remove by clicking card!)
      if (!word.is_favorite && onToggleFavorite) {
        onToggleFavorite(word.id, true);
      }

      return;
    }

    // Tap 1 of a potential single-click flip or rapid-like sequence
    lastClickTimeRef.current = now;
    pendingFirstTapPosRef.current = { x, y };

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // Snappy card reveal: waits for DOUBLE_TAP_THRESHOLD so double-tap or rapid clicks cancel it 100% reliably
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      pendingFirstTapPosRef.current = null;
      triggerFlip();
    }, DOUBLE_TAP_THRESHOLD);
  };

  const displayedPhonetic =
    currentAccent === 'en-US' && word.phonetic_us ? word.phonetic_us : word.phonetic;

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className="relative w-full sm:max-w-md mx-auto h-full sm:max-h-[84dvh] flashcard-stage select-none cursor-pointer"
    >
      {/* Core Canvas (Tactile shuffle cards on mobile, 3D on desktop) */}
      <div
        className={`relative w-full h-full flashcard-inner ${
          isRevealed ? 'is-flipped' : ''
        } ${shuffleDirection === 'to-back' ? 'shuffle-to-back' : ''} ${
          shuffleDirection === 'to-front' ? 'shuffle-to-front' : ''
        }`}
      >
        {/* ============================================================ */}
        {/* AWERS (FRONT): High-Fashion Obsidian Chrome ("ASCENSION")    */}
        {/* Symmetrical padding, full width, integrated controls         */}
        {/* ============================================================ */}
        <div className="flashcard-face flashcard-front rounded-[28px] sm:rounded-[36px] obsidian-card-surface text-white">
          <div className="w-full h-full rounded-[28px] sm:rounded-[36px] overflow-hidden">
            <div className="w-full h-full flex flex-col justify-between px-5 xs:px-6 sm:px-8 card-pt-safe card-pb-safe sm:py-8 overflow-y-auto no-scrollbar">
          
          {/* 1. TOP TECHNICAL BAR: Level, POS, Słownik, Like, Quick Rotate */}
          <div className="shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-tech-mono text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded bg-white text-black tracking-wider uppercase shrink-0">
                {word.cefr_level || 'B2'}
              </span>
              <span className="font-tech-mono text-xs text-neutral-400 lowercase tracking-wide truncate">
                {word.part_of_speech}
              </span>
            </div>

            {/* Quick Action Icons: Heart (Like), Book (Oxford Słownik), Rotate (Flip) */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Like Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (word.is_favorite) {
                    playTap();
                  } else {
                    playGood();
                    if (cardRef.current) {
                      const rect = cardRef.current.getBoundingClientRect();
                      spawnFlyingHeart(rect.width / 2, rect.height / 2);
                    }
                  }
                  if (onToggleFavorite) onToggleFavorite(word.id);
                }}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
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
                  triggerFlip();
                }}
                className="inline-flex items-center gap-1.5 font-tech-mono text-[11px] text-neutral-300 bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 px-3 py-1 rounded-full border border-white/20 transition-all shadow-xs"
              >
                <RotateCw className="w-3 h-3 text-white transition-transform duration-300 hover:rotate-180" />
                <span>Obróć</span>
              </button>
            </div>
          </div>

          {/* 2. MIDDLE HERO SECTION: Chrome Typography, Audio, Large Definition & Context */}
          <div className="flex-1 min-h-0 flex flex-col justify-center my-auto py-2 sm:py-3 space-y-2.5 sm:space-y-3.5">
            
            {/* The English Headword in Liquid Chrome with Star Glints */}
            <div className="relative inline-block w-fit max-w-full">
              <h1
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(word);
                }}
                className={`chrome-text font-sans font-black tracking-tighter leading-[1.14] pb-1.5 break-words [overflow-wrap:anywhere] cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all ${getHeadingSizeClass(word.word)}`}
              >
                {word.word}
              </h1>

              {/* Iconic 4-Point Star Lens Flares on letters */}
              <StarGlint className="absolute -top-2.5 right-0 sm:-right-2 w-4 h-4 sm:w-5 sm:h-5 text-white/95 animate-star-glint pointer-events-none" />
              <StarGlint
                className="absolute -bottom-1.5 left-0 sm:-left-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200/90 animate-star-glint pointer-events-none"
                style={{ animationDelay: '1.4s' }}
              />
            </div>

            {/* Phonetic Pronunciation Pill + UK/US Accent Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(word);
                }}
                className="inline-flex items-center gap-2 font-tech-mono font-semibold text-xs sm:text-sm text-neutral-100 bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 px-3.5 py-1.5 rounded-full border border-white/20 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.5)] max-w-full"
                title="Odsłuchaj wymowę"
              >
                <Volume2 className="w-4 h-4 text-white shrink-0" />
                <span className="truncate">{displayedPhonetic}</span>
              </button>

              {onToggleAccent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAccent();
                  }}
                  className="px-2.5 py-1 text-[10px] font-tech-mono font-bold bg-white/[0.08] hover:bg-white/[0.16] text-neutral-200 hover:text-white rounded-full border border-white/20 active:scale-95 transition-all shadow-xs shrink-0"
                  title="Przełącz akcent: UK / US"
                >
                  {currentAccent === 'en-GB' ? 'UK' : 'US'}
                </button>
              )}
            </div>

            {/* Clear, Prominent English Oxford Definition */}
            <p className="text-base xs:text-lg sm:text-xl text-neutral-100 leading-snug sm:leading-relaxed font-semibold tracking-tight break-words [overflow-wrap:anywhere]">
              {word.definition_en}
            </p>

            {/* Authentic Context Sentence with High-Fashion Technical Header */}
            {word.example_en && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.04] border border-white/[0.12] shadow-inner">
                <div className="flex items-center justify-between text-[10px] font-tech-mono text-neutral-400 uppercase tracking-widest mb-2 gap-2">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                    EXAMPLE // CONTEXT
                  </span>
                  <span className="shrink-0">OXFORD 3000™</span>
                </div>
                <p className="font-sans text-xs xs:text-sm sm:text-base text-neutral-200 font-normal italic leading-relaxed break-words [overflow-wrap:anywhere]">
                  "{highlightedExampleEn}"
                </p>
              </div>
            )}
          </div>

          {/* 3. BOTTOM TECHNICAL FOOTER: Collocations & Technical Metadata */}
          <div className="shrink-0 pt-2.5 sm:pt-3.5 border-t border-white/[0.12] pb-1">
            {word.collocations && word.collocations.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-tech-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    KOLOKACJE // TYPOWE FRAZY
                  </span>
                  <span className="font-tech-mono text-[10px] text-neutral-500 uppercase tracking-widest shrink-0">
                    DOTKNIJ ↻
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {word.collocations.slice(0, 3).map((col, idx) => (
                    <span
                      key={idx}
                      className="max-w-full break-words [overflow-wrap:anywhere] px-2.5 py-1 bg-white/[0.05] border border-white/[0.1] text-neutral-300 text-xs font-tech-mono rounded-lg leading-snug text-left"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-tech-mono text-neutral-500 uppercase tracking-wider">
                  OXFORD CORE LEXICON
                </span>
                <span className="font-tech-mono text-[10px] text-neutral-500 uppercase tracking-widest shrink-0">
                  DOTKNIJ ↻
                </span>
              </div>
            )}
          </div>
          </div>
        </div>
        </div>

        {/* ============================================================ */}
        {/* REWERS (BACK): High-Fashion Noir Obsidian Chrome             */}
        {/* Symmetrical padding, full width, integrated controls         */}
        {/* ============================================================ */}
        <div className="flashcard-face flashcard-back rounded-[28px] sm:rounded-[36px] obsidian-card-surface text-white">
          <div className="w-full h-full rounded-[28px] sm:rounded-[36px] overflow-hidden">
            <div className="w-full h-full flex flex-col justify-between px-5 xs:px-6 sm:px-8 card-pt-safe card-pb-safe sm:py-8 overflow-y-auto no-scrollbar">
            
            {/* 1. TOP TECHNICAL BAR: Level, POS, Słownik, Like, Return */}
            <div className="shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-tech-mono text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded bg-white text-black tracking-wider uppercase shadow-[0_0_12px_rgba(255,255,255,0.45)] shrink-0">
                  {word.cefr_level || 'B2'}
                </span>
                <span className="font-tech-mono text-xs text-neutral-300 font-semibold tracking-wide uppercase truncate">
                  POLISH // PL
                </span>
              </div>

              {/* Action Buttons: Like, Oxford Profile, Flip Back */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (word.is_favorite) {
                      playTap();
                    } else {
                      playGood();
                      if (cardRef.current) {
                        const rect = cardRef.current.getBoundingClientRect();
                        spawnFlyingHeart(rect.width / 2, rect.height / 2);
                      }
                    }
                    if (onToggleFavorite) onToggleFavorite(word.id);
                  }}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
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
                    triggerFlip();
                  }}
                  className="inline-flex items-center gap-1.5 font-tech-mono text-[11px] text-neutral-300 bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 px-3 py-1 rounded-full border border-white/20 transition-all shadow-xs"
                >
                  <RotateCw className="w-3 h-3 text-white transition-transform duration-300 hover:rotate-180" />
                  <span>Powrót</span>
                </button>
              </div>
            </div>

            {/* 2. MIDDLE HERO SECTION: Massive Polish Meaning, Pills, Context & Collocations */}
            <div className="flex-1 min-h-0 flex flex-col justify-center my-auto py-2 sm:py-3 space-y-2.5 sm:space-y-3.5">
              {/* The Polish Meaning in Silver Liquid Chrome Typography */}
              <div className="relative inline-block w-fit max-w-full">
                <h2 className={`chrome-text-silver font-sans font-black tracking-tighter leading-[1.12] pb-1.5 break-words [overflow-wrap:anywhere] ${getHeadingSizeClass(primaryMeaningPl)}`}>
                  {primaryMeaningPl}
                </h2>
                <StarGlint className="absolute -top-2.5 right-0 sm:-right-2 w-4 h-4 sm:w-5 sm:h-5 text-white/95 animate-star-glint pointer-events-none" />
                <StarGlint
                  className="absolute -bottom-1.5 left-0 sm:-left-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200/90 animate-star-glint pointer-events-none"
                  style={{ animationDelay: '1.4s' }}
                />
              </div>

              {/* Secondary Meaning Pills in Frosted Obsidian Glass */}
              {secondaryMeaningsPl.length > 0 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {secondaryMeaningsPl.map((syn, idx) => (
                    <span
                      key={idx}
                      className="max-w-full break-words [overflow-wrap:anywhere] px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 font-tech-mono text-xs sm:text-sm border border-white/15 shadow-xs leading-relaxed text-left"
                    >
                      {syn}
                    </span>
                  ))}
                </div>
              )}

              {/* Context Box: English Oxford Example + Polish Translation */}
              {word.example_en ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.04] border border-white/[0.12] shadow-inner space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-tech-mono text-neutral-400 uppercase tracking-widest gap-2">
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
                      PRZYKŁAD W KONTEKŚCIE
                    </span>
                    <span className="shrink-0">OXFORD 3000™</span>
                  </div>
                  <p className="font-sans text-sm xs:text-base sm:text-lg font-medium text-neutral-100 leading-snug sm:leading-relaxed break-words [overflow-wrap:anywhere]">
                    "{highlightedExampleEn}"
                  </p>
                  {word.example_pl && (
                    <p className="font-sans text-xs xs:text-sm sm:text-base text-neutral-300 font-normal leading-relaxed pt-1.5 border-t border-white/[0.08] break-words [overflow-wrap:anywhere]">
                      {highlightedExamplePl}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Collocations block in Obsidian Glass */}
              {word.collocations && word.collocations.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.1]">
                  <div className="text-[10px] font-tech-mono font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                    Typowe połączenia (Collocations)
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {word.collocations.slice(0, 3).map((col, idx) => (
                      <span
                        key={idx}
                        className="max-w-full break-words [overflow-wrap:anywhere] px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-neutral-200 text-xs sm:text-sm font-tech-mono leading-relaxed text-left"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. BOTTOM FOOTER: Word Reference, Audio & Return Button */}
            <div className="shrink-0 pt-3 sm:pt-4 border-t border-white/[0.12] flex items-center justify-between pb-1 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpeak(word);
                  }}
                  className="w-7 h-7 shrink-0 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
                  title="Odsłuchaj"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <span className="font-sans font-bold text-sm text-white truncate">
                  {word.word}
                </span>
                <span className="text-xs font-tech-mono text-neutral-400 shrink-0">
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
                    triggerFlip();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-tech-mono text-white bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 px-3.5 py-1 rounded-full border border-white/20 transition-all cursor-pointer font-semibold shadow-xs"
                >
                  <RotateCw className="w-3.5 h-3.5 text-white transition-transform duration-300 hover:rotate-180" />
                  <span>Powrót</span>
                </button>
              </div>
            </div>

          </div>
          </div>
        </div>
      </div>

      {/* TikTok Signature Flying Hearts at Tap Location (ALWAYS ON TOP IN 2D & 3D) */}
      <div className="absolute inset-0 pointer-events-none z-[9999] overflow-visible">
        {flyingHearts.map((heart) => (
          <div
            key={heart.id}
            className="absolute pointer-events-none animate-tiktok-heart"
            style={{
              left: `${heart.x}px`,
              top: `${heart.y}px`,
              '--heart-rot': heart.rot
            }}
          >
            <Heart className="w-16 h-16 sm:w-20 sm:h-20 text-[#fe2c55] fill-[#fe2c55] drop-shadow-[0_4px_24px_rgba(254,44,85,0.95)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function areWordCardPropsEqual(prev, next) {
  return (
    prev.word?.id === next.word?.id &&
    prev.word?.is_favorite === next.word?.is_favorite &&
    prev.word?.definition_pl === next.word?.definition_pl &&
    prev.word?.example_en === next.word?.example_en &&
    prev.word?.example_pl === next.word?.example_pl &&
    prev.isRevealed === next.isRevealed &&
    prev.currentAccent === next.currentAccent &&
    prev.onSpeak === next.onSpeak &&
    prev.onToggleReveal === next.onToggleReveal &&
    prev.onToggleFavorite === next.onToggleFavorite &&
    prev.onOpenDeepDive === next.onOpenDeepDive &&
    prev.onToggleAccent === next.onToggleAccent
  );
}

const WordCard = memo(WordCardComponent, areWordCardPropsEqual);
export default WordCard;