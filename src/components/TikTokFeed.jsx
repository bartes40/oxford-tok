import React, { useState, useEffect, useRef, memo } from 'react';
import WordCard from './WordCard';
import { playSwoosh, playFlip } from '../utils/sound';

function TikTokFeedComponent({
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
  const [snapbackDirection, setSnapbackDirection] = useState(null); // 'next' | 'prev' | null

  // Core Gesture Refs
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const dragStartY = useRef(0);
  const hasSlopCrossed = useRef(false);
  const isDraggingRef = useRef(false);
  const dragDistance = useRef(0);
  const recentPoints = useRef([]);
  const suppressClick = useRef(false);
  const isTransitioningRef = useRef(false);
  const containerRef = useRef(null);

  // Timers and Throttling
  const rafIdRef = useRef(null);
  const pendingDragYRef = useRef(0);
  const transitionTimerRef = useRef(null);
  const snapbackTimerRef = useRef(null);
  const enrichedRequestedRef = useRef(new Set());

  // Mouse Wheel Momentum Cooldown
  const lastWheelTriggerRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const wheelTimeoutRef = useRef(null);

  const scheduleDragUpdate = (targetY) => {
    pendingDragYRef.current = targetY;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        setDragY(pendingDragYRef.current);
        rafIdRef.current = null;
      });
    }
  };

  const cancelPendingDragUpdate = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cancelPendingDragUpdate();
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (snapbackTimerRef.current) clearTimeout(snapbackTimerRef.current);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, []);

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
      const key = String(w.id || w.word);
      if (enrichedRequestedRef.current.has(key)) continue;

      const isPlBad =
        !w.definition_pl ||
        w.definition_pl.trim().toLowerCase() === (w.word || '').trim().toLowerCase() ||
        w.definition_pl.startsWith('Ładowanie');
      if (!w.senses || w.senses.length === 0 || isPlBad) {
        enrichedRequestedRef.current.add(key);
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

  // Execute full transition to next or prev card
  const executeTransition = (direction) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    playSwoosh();
    setTransitionState(direction);

    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      if (direction === 'next') {
        setCurrentIndex((i) => i + 1);
      } else {
        setCurrentIndex((i) => i - 1);
      }
      setIsRevealed(false);
      setDragY(0);
      pendingDragYRef.current = 0;
      setTransitionState(null);
      setSnapbackDirection(null);
      isTransitioningRef.current = false;
    }, 340);
  };

  // Execute smooth snapback to current card
  const executeSnapback = (currentY) => {
    const direction = currentY < 0 ? 'next' : 'prev';
    setSnapbackDirection(direction);
    setTransitionState('snapback');
    isTransitioningRef.current = true;

    if (snapbackTimerRef.current) clearTimeout(snapbackTimerRef.current);
    snapbackTimerRef.current = setTimeout(() => {
      setDragY(0);
      pendingDragYRef.current = 0;
      setTransitionState(null);
      setSnapbackDirection(null);
      isTransitioningRef.current = false;
    }, 260);
  };

  // Programmatic transitions (Keyboard, Wheel, API)
  const triggerTransition = (direction) => {
    if (isTransitioningRef.current) return;

    if (direction === 'next') {
      if (currentIndex >= words.length - 1) {
        if (onLoadMore) onLoadMore();
        return;
      }
      executeTransition('next');
    } else if (direction === 'prev') {
      if (currentIndex <= 0) return;
      executeTransition('prev');
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

  // Mouse Wheel & Trackpad Handling with Inertia Cooldown & Delta Accumulation
  const handleWheel = (e) => {
    if (isTransitioningRef.current) return;

    const now = Date.now();
    // Cooldown window (520ms) absorbs touchpad/mouse momentum inertia
    if (now - lastWheelTriggerRef.current < 520) {
      if (Math.abs(e.deltaY) > 12) {
        lastWheelTriggerRef.current = now; // extend lock while active rolling continues
      }
      return;
    }

    wheelAccumulatorRef.current += e.deltaY;

    if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    wheelTimeoutRef.current = setTimeout(() => {
      wheelAccumulatorRef.current = 0;
    }, 140);

    const ACCUM_THRESHOLD = 45;
    if (Math.abs(wheelAccumulatorRef.current) >= ACCUM_THRESHOLD) {
      const dir = wheelAccumulatorRef.current > 0 ? 'next' : 'prev';
      wheelAccumulatorRef.current = 0;
      lastWheelTriggerRef.current = now;
      triggerTransition(dir);
    }
  };

  // Unified Gesture Handlers (Smooth continuous delta with zero jump)
  const onDragStart = (clientY, clientX) => {
    if (isTransitioningRef.current) return false;

    touchStartY.current = clientY;
    touchStartX.current = clientX;
    dragStartY.current = clientY;
    hasSlopCrossed.current = false;
    isDraggingRef.current = false;
    dragDistance.current = 0;
    recentPoints.current = [{ y: clientY, t: Date.now() }];
    return true;
  };

  const onDragMove = (clientY, clientX) => {
    if (isTransitioningRef.current) return;

    const totalDiffY = clientY - touchStartY.current;
    const totalDiffX = clientX - touchStartX.current;
    const absY = Math.abs(totalDiffY);
    const absX = Math.abs(totalDiffX);

    // If movement is predominantly horizontal, ignore to allow gestures elsewhere
    if (!hasSlopCrossed.current && absX > absY && absX > 10) {
      return;
    }

    // Touch-slop deadzone: 12px before dragging engages (prevents mobile thumb taps from false-triggering drags)
    if (!hasSlopCrossed.current) {
      if (absY < 12) return;
      hasSlopCrossed.current = true;
      isDraggingRef.current = true;
      setIsDragging(true);
      // Anchor smoothly so drag starts continuously from 0 with no sudden jump
      dragStartY.current = totalDiffY > 0 ? touchStartY.current + 12 : touchStartY.current - 12;
    }

    dragDistance.current = Math.abs(clientY - touchStartY.current);

    // Track rolling window of positions for accurate release velocity
    const now = Date.now();
    recentPoints.current.push({ y: clientY, t: now });
    recentPoints.current = recentPoints.current.filter((p) => now - p.t <= 120);

    // Continuous delta relative to anchor
    const rawDiff = clientY - dragStartY.current;

    // Apply smooth rubber band resistance at feed bounds
    let effectiveY = rawDiff;
    if ((currentIndex === 0 && rawDiff > 0) || (currentIndex === words.length - 1 && rawDiff < 0)) {
      effectiveY = rawDiff * 0.28;
    }

    scheduleDragUpdate(effectiveY);
  };

  const onDragEnd = () => {
    if (isTransitioningRef.current) return;
    cancelPendingDragUpdate();

    if (!isDraggingRef.current) {
      // Pure tap or micro-motion below slop threshold: never suppress click!
      setDragY(0);
      pendingDragYRef.current = 0;
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);

    // Suppress click on card flip ONLY if user actually engaged a vertical drag gesture
    if (hasSlopCrossed.current && dragDistance.current > 12) {
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 150);
    }

    const effectiveDragY = pendingDragYRef.current;

    // Calculate release velocity over the last 120ms
    const now = Date.now();
    const validPoints = recentPoints.current.filter((p) => now - p.t <= 120);
    let velocity = 0;
    if (validPoints.length >= 2) {
      const oldest = validPoints[0];
      const newest = validPoints[validPoints.length - 1];
      const dt = newest.t - oldest.t;
      if (dt > 10) {
        velocity = (newest.y - oldest.y) / dt; // px per ms
      }
    }

    // Dynamic threshold based on container height (between 52px and 100px)
    const containerHeight = containerRef.current ? containerRef.current.clientHeight : window.innerHeight;
    const threshold = Math.min(Math.max(containerHeight * 0.16, 52), 100);
    const FLICK_VELOCITY = 0.28; // px/ms

    const shouldGoNext =
      (effectiveDragY < -threshold || (velocity < -FLICK_VELOCITY && effectiveDragY < -18)) &&
      currentIndex < words.length - 1;

    const shouldGoPrev =
      (effectiveDragY > threshold || (velocity > FLICK_VELOCITY && effectiveDragY > 18)) &&
      currentIndex > 0;

    if (shouldGoNext) {
      setDragY(effectiveDragY);
      executeTransition('next');
    } else if (shouldGoPrev) {
      setDragY(effectiveDragY);
      executeTransition('prev');
    } else {
      setDragY(effectiveDragY);
      executeSnapback(effectiveDragY);
    }
  };

  // Touch Event Listeners
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    onDragStart(touch.clientY, touch.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    onDragMove(touch.clientY, touch.clientX);
  };

  const handleTouchEnd = () => {
    onDragEnd();
  };

  const handleTouchCancel = () => {
    cancelPendingDragUpdate();
    if (isDraggingRef.current) {
      executeSnapback(pendingDragYRef.current || dragY);
    } else {
      setDragY(0);
      pendingDragYRef.current = 0;
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // Mouse Drag Support
  const handleMouseDown = (e) => {
    if (isTransitioningRef.current || e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('[data-no-flip]')) {
      return;
    }

    if (!onDragStart(e.clientY, e.clientX)) return;

    const onMouseMove = (moveEvent) => {
      onDragMove(moveEvent.clientY, moveEvent.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      onDragEnd();
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

  // Calculate dynamic transform & transition styles with unified calc(% + px) coordinates
  const getStyleForSlot = (slot) => {
    const transitionTiming = 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 340ms ease-out';
    const snapbackTiming = 'transform 260ms cubic-bezier(0.25, 1, 0.4, 1), opacity 260ms ease-out';

    if (slot === 'current') {
      if (transitionState === 'next') {
        return {
          transform: 'translate3d(0, calc(-100% + 0px), 0) scale(0.94)',
          opacity: 0.75,
          transition: transitionTiming,
          willChange: 'transform, opacity'
        };
      }
      if (transitionState === 'prev') {
        return {
          transform: 'translate3d(0, calc(100% + 0px), 0) scale(0.94)',
          opacity: 0.75,
          transition: transitionTiming,
          willChange: 'transform, opacity'
        };
      }
      if (transitionState === 'snapback') {
        return {
          transform: 'translate3d(0, calc(0% + 0px), 0) scale(1)',
          opacity: 1,
          transition: snapbackTiming,
          willChange: 'transform, opacity'
        };
      }
      if (isDragging) {
        const progress = Math.min(Math.abs(dragY) / 400, 1);
        return {
          transform: `translate3d(0, calc(0% + ${dragY}px), 0) scale(${1 - progress * 0.05})`,
          opacity: 1 - progress * 0.2,
          transition: 'none',
          willChange: 'transform, opacity'
        };
      }
      return {
        transform: 'translate3d(0, calc(0% + 0px), 0) scale(1)',
        opacity: 1,
        transition: 'none'
      };
    }

    if (slot === 'next') {
      if (transitionState === 'next') {
        return {
          transform: 'translate3d(0, calc(0% + 0px), 0) scale(1)',
          opacity: 1,
          transition: transitionTiming,
          willChange: 'transform',
          boxShadow: '0 -25px 60px -10px rgba(0, 0, 0, 0.95)'
        };
      }
      if (transitionState === 'snapback') {
        if (snapbackDirection === 'next') {
          return {
            transform: 'translate3d(0, calc(100% + 0px), 0)',
            opacity: 1,
            transition: snapbackTiming,
            willChange: 'transform',
            boxShadow: '0 -25px 60px -10px rgba(0, 0, 0, 0.95)'
          };
        }
        return {
          transform: 'translate3d(0, calc(100% + 0px), 0)',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'none'
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
        transform: 'translate3d(0, calc(100% + 0px), 0)',
        opacity: 0,
        pointerEvents: 'none',
        transition: 'none'
      };
    }

    if (slot === 'prev') {
      if (transitionState === 'prev') {
        return {
          transform: 'translate3d(0, calc(0% + 0px), 0) scale(1)',
          opacity: 1,
          transition: transitionTiming,
          willChange: 'transform',
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.95)'
        };
      }
      if (transitionState === 'snapback') {
        if (snapbackDirection === 'prev') {
          return {
            transform: 'translate3d(0, calc(-100% + 0px), 0)',
            opacity: 1,
            transition: snapbackTiming,
            willChange: 'transform',
            boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.95)'
          };
        }
        return {
          transform: 'translate3d(0, calc(-100% + 0px), 0)',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'none'
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
        transform: 'translate3d(0, calc(-100% + 0px), 0)',
        opacity: 0,
        pointerEvents: 'none',
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
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onClickCapture={handleClickCapture}
      className="relative flex-1 flex flex-col items-center justify-center w-full h-full p-0 sm:px-4 sm:pt-14 sm:pb-4 overflow-hidden select-none touch-pan-y-only cursor-grab active:cursor-grabbing"
    >
      <div
        ref={containerRef}
        className="relative w-full sm:max-w-md h-full sm:max-h-[84dvh] overflow-hidden rounded-none sm:rounded-[36px]"
      >
        {/* Previous Card (Slides in from top when dragging down or during prev transition/snapback) */}
        {prevWord && (
          <div
            key={`prev-${prevWord.id}`}
            className={`absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none ${
              (isDragging && dragY > 0) || transitionState === 'prev' || (transitionState === 'snapback' && snapbackDirection === 'prev')
                ? 'z-30'
                : 'z-10'
            }`}
            style={getStyleForSlot('prev')}
            aria-hidden={!isDragging && transitionState !== 'prev' && (transitionState !== 'snapback' || snapbackDirection !== 'prev')}
          >
            <WordCard
              word={prevWord}
              onSpeak={onSpeak}
              isRevealed={false}
              onToggleReveal={noop}
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

        {/* Next Card (Slides in from bottom when dragging up or during next transition/snapback) */}
        {nextWord && (
          <div
            key={`next-${nextWord.id}`}
            className={`absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none ${
              (isDragging && dragY < 0) || transitionState === 'next' || (transitionState === 'snapback' && snapbackDirection === 'next')
                ? 'z-30'
                : 'z-10'
            }`}
            style={getStyleForSlot('next')}
            aria-hidden={!isDragging && transitionState !== 'next' && (transitionState !== 'snapback' || snapbackDirection !== 'next')}
          >
            <WordCard
              word={nextWord}
              onSpeak={onSpeak}
              isRevealed={false}
              onToggleReveal={noop}
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

const noop = () => {};

const TikTokFeed = memo(TikTokFeedComponent);
export default TikTokFeed;
