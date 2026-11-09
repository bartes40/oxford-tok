import React, { useState, useEffect, useRef } from 'react';
import WordCard from './WordCard';
import { playSwoosh, playFlip } from '../utils/sound';

export default function TikTokFeed({
  words,
  onToggleFavorite,
  onSpeak,
  onOpenDeepDive,
  currentAccent,
  onToggleAccent,
  onLoadMore,
  onWordUpdated
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next');
  const [isRevealed, setIsRevealed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartY = useRef(0);
  const isScrolling = useRef(false);

  const currentWord = words[currentIndex];

  // Reset revealed state on slide change & pre-fetch/enrich upcoming cards
  useEffect(() => {
    setIsRevealed(false);

    if (words.length > 0 && currentIndex >= words.length - 5 && onLoadMore) {
      onLoadMore();
    }

    const upcoming = [words[currentIndex], words[currentIndex + 1], words[currentIndex + 2]].filter(Boolean);
    for (const w of upcoming) {
      const isPlBad =
        !w.definition_pl ||
        w.definition_pl.trim().toLowerCase() === (w.word || '').trim().toLowerCase() ||
        w.definition_pl.startsWith('Ładowanie');
      if (!w.senses || w.senses.length === 0 || isPlBad) {
        fetch(`/api/oxford/enrich/${encodeURIComponent(w.id || w.word)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.word && onWordUpdated) {
              onWordUpdated(data.word);
            }
          })
          .catch(() => {});
      }
    }
  }, [currentIndex, words.length]);

  const goToNext = () => {
    if (currentIndex < words.length - 1) {
      setSlideDirection('next');
      playSwoosh();
      setCurrentIndex((i) => i + 1);
    } else if (onLoadMore) {
      onLoadMore();
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setSlideDirection('prev');
      playSwoosh();
      setCurrentIndex((i) => i - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        goToPrev();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        playFlip();
        setIsRevealed((r) => !r);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentWord, words.length]);

  // Touch Swipe Handling
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    setDragOffset(diff * 0.42);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragOffset < -36) {
      goToNext();
    } else if (dragOffset > 36) {
      goToPrev();
    }
    setDragOffset(0);
  };

  // Mouse Wheel Handling
  const handleWheel = (e) => {
    if (isScrolling.current) return;
    if (Math.abs(e.deltaY) > 25) {
      isScrolling.current = true;
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
      setTimeout(() => {
        isScrolling.current = false;
      }, 420);
    }
  };

  if (!currentWord) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center">
        <p className="text-sm font-mono-code">Brak słówek w tym filtrze.</p>
      </div>
    );
  }

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative flex-1 flex flex-col items-center justify-center w-full h-full p-0 sm:px-4 sm:pt-14 sm:pb-4 overflow-hidden select-none touch-pan-y-only"
    >
      <div className="relative w-full sm:max-w-lg h-full flex items-center justify-center sm:gap-4 my-auto">
        
        {/* Flashcard — 100% Full Screen on Mobile, Framed Card on Desktop */}
        <div
          key={currentWord.id}
          className={`w-full h-full flex items-center justify-center transition-transform duration-200 ease-out ${
            slideDirection === 'next' ? 'animate-card-next' : 'animate-card-prev'
          }`}
          style={{
            transform: isDragging ? `translateY(${dragOffset}px)` : undefined
          }}
        >
          <WordCard
            word={currentWord}
            onSpeak={onSpeak}
            isRevealed={isRevealed}
            onToggleReveal={() => setIsRevealed(!isRevealed)}
            onToggleFavorite={onToggleFavorite}
            onOpenDeepDive={onOpenDeepDive}
            currentAccent={currentAccent}
            onToggleAccent={onToggleAccent}
          />
        </div>
      </div>
    </div>
  );
}
