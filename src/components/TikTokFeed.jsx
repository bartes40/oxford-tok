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
  const [isRevealed, setIsRevealed] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [transitionState, setTransitionState] = useState(null); // 'next' | 'prev' | 'snapback' | null

  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const dragDistance = useRef(0);
  const suppressClick = useRef(false);
  const isTransitioningRef = useRef(false);
  const containerRef = useRef(null);

  const currentWord = words[currentIndex];
  const nextWord = currentIndex < words.length - 1 ? words[currentIndex + 1] : null;
  const prevWord = currentIndex > 0 ? words[currentIndex - 1] : null;

  // Pre-fetch/enrich upcoming cards & trigger infinite load
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

  // Programmatic transitions (Keyboard, Wheel, API)
  const triggerTransition = (direction) => {
    if (isTransitioningRef.current) return;

    if (direction === 'next') {
      if (currentIndex >= words.length - 1) {
        if (onLoadMore) onLoadMore();
        return;
      }
      isTransitioningRef.current = true;
      playSwoosh();
      setTransitionState('next');

      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setIsRevealed(false);
        setDragY(0);
        setTransitionState(null);
        isTransitioningRef.current = false;
      }, 320);
    } else if (direction === 'prev') {
      if (currentIndex <= 0) return;
      isTransitioningRef.current = true;
      playSwoosh();
      setTransitionState('prev');

      setTimeout(() => {
        setCurrentIndex((i) => i - 1);
        setIsRevealed(false);
        setDragY(0);
        setTransitionState(null);
        isTransitioningRef.current = false;
      }, 320);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        triggerTransition('next');
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        triggerTransition('prev');
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        playFlip();
        setIsRevealed((r) => !r);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, words.length]);

  // Mouse Wheel Handling (Debounced for silky gesture response)
  const handleWheel = (e) => {
    if (isTransitioningRef.current) return;

    if (Math.abs(e.deltaY) > 28) {
      if (e.deltaY > 0) {
        triggerTransition('next');
      } else {
        triggerTransition('prev');
      }
    }
  };

  // Touch Gesture Handling (1:1 Native TikTok Physics)
  const handleTouchStart = (e) => {
    if (isTransitioningRef.current) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    dragDistance.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || isTransitioningRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    dragDistance.current = Math.abs(diff);

    // Apply rubber band resistance if at bounds
    if ((currentIndex === 0 && diff > 0) || (currentIndex === words.length - 1 && diff < 0)) {
      setDragY(diff * 0.22);
    } else {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || isTransitioningRef.current) return;
    setIsDragging(false);

    if (dragDistance.current > 8) {
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 120);
    }

    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = dragY / elapsed; // px per ms

    // Threshold: either dragged > 65px or fast flick (velocity > 0.45px/ms)
    if ((dragY < -65 || velocity < -0.45) && currentIndex < words.length - 1) {
      isTransitioningRef.current = true;
      playSwoosh();
      setTransitionState('next');

      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setIsRevealed(false);
        setDragY(0);
        setTransitionState(null);
        isTransitioningRef.current = false;
      }, 320);
    } else if ((dragY > 65 || velocity > 0.45) && currentIndex > 0) {
      isTransitioningRef.current = true;
      playSwoosh();
      setTransitionState('prev');

      setTimeout(() => {
        setCurrentIndex((i) => i - 1);
        setIsRevealed(false);
        setDragY(0);
        setTransitionState(null);
        isTransitioningRef.current = false;
      }, 320);
    } else {
      // Snapback cancelled drag
      setTransitionState('snapback');
      setTimeout(() => {
        setDragY(0);
        setTransitionState(null);
      }, 240);
    }
  };

  // Mouse Drag Support for Desktop testing
  const handleMouseDown = (e) => {
    if (isTransitioningRef.current) return;
    touchStartY.current = e.clientY;
    touchStartTime.current = Date.now();
    dragDistance.current = 0;
    setIsDragging(true);

    const onMouseMove = (moveEvent) => {
      const diff = moveEvent.clientY - touchStartY.current;
      dragDistance.current = Math.abs(diff);

      if ((currentIndex === 0 && diff > 0) || (currentIndex === words.length - 1 && diff < 0)) {
        setDragY(diff * 0.22);
      } else {
        setDragY(diff);
      }
    };

    const onMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      if (dragDistance.current > 8) {
        suppressClick.current = true;
        setTimeout(() => {
          suppressClick.current = false;
        }, 120);
      }

      const currentDiff = upEvent.clientY - touchStartY.current;
      const elapsed = Math.max(1, Date.now() - touchStartTime.current);
      const velocity = currentDiff / elapsed;

      if ((currentDiff < -65 || velocity < -0.45) && currentIndex < words.length - 1) {
        isTransitioningRef.current = true;
        playSwoosh();
        setTransitionState('next');

        setTimeout(() => {
          setCurrentIndex((i) => i + 1);
          setIsRevealed(false);
          setDragY(0);
          setTransitionState(null);
          isTransitioningRef.current = false;
        }, 320);
      } else if ((currentDiff > 65 || velocity > 0.45) && currentIndex > 0) {
        isTransitioningRef.current = true;
        playSwoosh();
        setTransitionState('prev');

        setTimeout(() => {
          setCurrentIndex((i) => i - 1);
          setIsRevealed(false);
          setDragY(0);
          setTransitionState(null);
          isTransitioningRef.current = false;
        }, 320);
      } else {
        setTransitionState('snapback');
        setTimeout(() => {
          setDragY(0);
          setTransitionState(null);
        }, 240);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleClickCapture = (e) => {
    if (suppressClick.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  if (!currentWord) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center">
        <p className="text-sm font-tech-mono">BRAK SŁÓWEK W TYM FILTRZE.</p>
      </div>
    );
  }

  // Calculate dynamic transform & transition styles
  const getStyleForSlot = (slot) => {
    const isTransitioning = transitionState !== null;
    const transitionTiming =
      transitionState === 'snapback'
        ? 'transform 240ms cubic-bezier(0.25, 1, 0.5, 1), opacity 240ms ease-out'
        : 'transform 320ms cubic-bezier(0.2, 0.95, 0.3, 1), opacity 320ms ease-out';

    if (slot === 'current') {
      if (transitionState === 'next') {
        return {
          transform: 'translate3d(0, -100%, 0) scale(0.96)',
          opacity: 0.8,
          transition: transitionTiming,
          willChange: 'transform, opacity'
        };
      }
      if (transitionState === 'prev') {
        return {
          transform: 'translate3d(0, 100%, 0) scale(0.96)',
          opacity: 0.8,
          transition: transitionTiming,
          willChange: 'transform, opacity'
        };
      }
      if (transitionState === 'snapback') {
        return {
          transform: 'translate3d(0, 0, 0) scale(1)',
          opacity: 1,
          transition: transitionTiming,
          willChange: 'transform, opacity'
        };
      }
      if (isDragging) {
        const progress = Math.min(Math.abs(dragY) / 500, 1);
        return {
          transform: `translate3d(0, ${dragY}px, 0) scale(${1 - progress * 0.04})`,
          opacity: 1 - progress * 0.2,
          transition: 'none',
          willChange: 'transform, opacity'
        };
      }
      return {
        transform: 'translate3d(0, 0, 0) scale(1)',
        opacity: 1,
        transition: 'none'
      };
    }

    if (slot === 'next') {
      if (transitionState === 'next') {
        return {
          transform: 'translate3d(0, 0, 0) scale(1)',
          opacity: 1,
          transition: transitionTiming,
          willChange: 'transform, opacity',
          boxShadow: '0 -25px 60px -10px rgba(0, 0, 0, 0.95)'
        };
      }
      if (transitionState === 'snapback') {
        return {
          transform: 'translate3d(0, 100%, 0)',
          opacity: 1,
          transition: transitionTiming,
          willChange: 'transform'
        };
      }
      if (isDragging && dragY < 0) {
        return {
          transform: `translate3d(0, calc(100% + ${dragY}px), 0)`,
          opacity: 1,
          transition: 'none',
          willChange: 'transform',
          boxShadow: '0 -25px 60px -10px rgba(0, 0, 0, 0.95)'
        };
      }
      return {
        transform: 'translate3d(0, 100%, 0)',
        opacity: 1,
        transition: 'none'
      };
    }

    if (slot === 'prev') {
      if (transitionState === 'prev') {
        return {
          transform: 'translate3d(0, 0, 0) scale(1)',
          opacity: 1,
          transition: transitionTiming,
          willChange: 'transform, opacity',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.95)'
        };
      }
      if (transitionState === 'snapback') {
        return {
          transform: 'translate3d(0, -100%, 0)',
          opacity: 1,
          transition: transitionTiming,
          willChange: 'transform'
        };
      }
      if (isDragging && dragY > 0) {
        return {
          transform: `translate3d(0, calc(-100% + ${dragY}px), 0)`,
          opacity: 1,
          transition: 'none',
          willChange: 'transform',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.95)'
        };
      }
      return {
        transform: 'translate3d(0, -100%, 0)',
        opacity: 1,
        transition: 'none'
      };
    }

    return {};
  };

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onClickCapture={handleClickCapture}
      className="relative flex-1 flex flex-col items-center justify-center w-full h-full p-0 sm:px-4 sm:pt-14 sm:pb-4 overflow-hidden select-none touch-pan-y-only cursor-grab active:cursor-grabbing"
    >
      <div
        ref={containerRef}
        className="relative w-full sm:max-w-md h-full sm:max-h-[84dvh] overflow-hidden rounded-none sm:rounded-[36px]"
      >
        {/* Previous Card (Slides in from top when dragging down) */}
        {prevWord && (
          <div
            key={`prev-${prevWord.id}`}
            className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-10"
            style={getStyleForSlot('prev')}
          >
            <WordCard
              word={prevWord}
              onSpeak={onSpeak}
              isRevealed={false}
              onToggleReveal={() => {}}
              onToggleFavorite={onToggleFavorite}
              onOpenDeepDive={onOpenDeepDive}
              currentAccent={currentAccent}
              onToggleAccent={onToggleAccent}
            />
          </div>
        )}

        {/* Current Active Card */}
        <div
          key={`current-${currentWord.id}`}
          className="absolute inset-0 w-full h-full flex items-center justify-center z-20"
          style={getStyleForSlot('current')}
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

        {/* Next Card (Slides in from bottom when dragging up) */}
        {nextWord && (
          <div
            key={`next-${nextWord.id}`}
            className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-30"
            style={getStyleForSlot('next')}
          >
            <WordCard
              word={nextWord}
              onSpeak={onSpeak}
              isRevealed={false}
              onToggleReveal={() => {}}
              onToggleFavorite={onToggleFavorite}
              onOpenDeepDive={onOpenDeepDive}
              currentAccent={currentAccent}
              onToggleAccent={onToggleAccent}
            />
          </div>
        )}
      </div>
    </div>
  );
}
