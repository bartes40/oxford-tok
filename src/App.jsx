import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import TopBarMinimal from './components/TopBarMinimal';
import TikTokFeed from './components/TikTokFeed';
import { speakWord, getAccent, setAccent } from './utils/speech';
import { isSoundEnabled, toggleSound, playTap } from './utils/sound';

// Code-split heavy modals to drastically reduce initial JS bundle size and accelerate TTI
const OxfordDeepDiveModal = lazy(() => import('./components/OxfordDeepDiveModal'));
const OxfordBrowserModal = lazy(() => import('./components/OxfordBrowserModal'));

export default function App() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState('all');

  // Modals
  const [deepDiveWord, setDeepDiveWord] = useState(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);

  // Audio & Accent Settings
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [currentAccent, setCurrentAccentState] = useState(getAccent());

  const isFetchingMore = useRef(false);
  const feedAbortControllerRef = useRef(null);

  // Fetch randomized words based on filter with AbortController for race-free switching
  const fetchFeed = useCallback(async (filter) => {
    if (feedAbortControllerRef.current) {
      feedAbortControllerRef.current.abort();
    }
    const ac = new AbortController();
    feedAbortControllerRef.current = ac;

    setLoading(true);
    try {
      const res = await fetch(`/api/feed?filter=${filter}&limit=30`, { signal: ac.signal });
      const data = await res.json();
      if (data.success && data.words) {
        setWords(data.words);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading feed:', err);
      }
    } finally {
      if (feedAbortControllerRef.current === ac) {
        setLoading(false);
      }
    }
  }, []);

  // Infinite scroll: load next random batch from Oxford 3000 catalog
  const handleLoadMore = useCallback(async () => {
    if (isFetchingMore.current) return;
    isFetchingMore.current = true;
    try {
      const res = await fetch(
        `/api/feed?filter=${currentFilter}&limit=20`
      );
      const data = await res.json();
      if (data.success && data.words?.length > 0) {
        setWords((prev) => {
          const existingIds = new Set(prev.map((w) => w.id));
          const fresh = data.words.filter((w) => !existingIds.has(w.id));
          return [...prev, ...fresh];
        });
      }
    } catch (e) {
      // ignore
    } finally {
      isFetchingMore.current = false;
    }
  }, [currentFilter]);

  // Update a single word in state after live Oxford API enrichment
  const handleWordUpdated = useCallback((enrichedWord) => {
    if (!enrichedWord) return;
    setWords((prev) =>
      prev.map((w) => (w.id === enrichedWord.id ? { ...w, ...enrichedWord } : w))
    );
  }, []);

  useEffect(() => {
    fetchFeed(currentFilter);
    return () => {
      if (feedAbortControllerRef.current) {
        feedAbortControllerRef.current.abort();
      }
    };
  }, [currentFilter, fetchFeed]);

  // Toggle favorite / save word (supports optional force boolean)
  const handleToggleFavorite = useCallback(async (wordId, force) => {
    try {
      // Optimistic instant feedback
      setWords((prev) =>
        prev.map((w) => {
          if (w.id === wordId) {
            const nextFav = typeof force === 'boolean' ? (force ? 1 : 0) : (w.is_favorite ? 0 : 1);
            return { ...w, is_favorite: nextFav };
          }
          return w;
        })
      );

      const res = await fetch('/api/toggle-favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: wordId, force })
      });
      const data = await res.json();
      if (data.success) {
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? { ...w, is_favorite: data.is_favorite } : w))
        );
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  }, []);

  // Pronunciation
  const handleSpeak = useCallback((wordOrText, customOpts = {}) => {
    speakWord(wordOrText, { accent: currentAccent, ...customOpts });
  }, [currentAccent]);

  const handleToggleAccent = useCallback(() => {
    setCurrentAccentState((prev) => {
      const next = prev === 'en-GB' ? 'en-US' : 'en-GB';
      setAccent(next);
      return next;
    });
    playTap();
  }, []);

  const handleToggleSound = useCallback(() => {
    const newState = toggleSound();
    setSoundOn(newState);
  }, []);

  const handleOpenBrowser = useCallback(() => {
    setIsBrowserOpen(true);
  }, []);

  return (
    <div className="relative w-full h-screen h-[100dvh] bg-noir flex flex-col justify-between overflow-hidden select-none">
      
      {/* Subtle Analog Film Grain Texture (Isolated onto GPU Layer) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none opacity-[0.035] z-0"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'translate3d(0, 0, 0)', contain: 'strict', willChange: 'opacity' }}
      >
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* High-Fashion Top Bar */}
      <TopBarMinimal
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
        onOpenBrowser={handleOpenBrowser}
      />

      {/* Main TikTok Feed Container */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center w-full h-full overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8 text-neutral-400 text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
            <span className="font-tech-mono text-xs uppercase tracking-widest text-neutral-300">
              SYNCHRONIZING // OXFORD LEXICON
            </span>
          </div>
        ) : (
          <TikTokFeed
            words={words}
            onToggleFavorite={handleToggleFavorite}
            onSpeak={handleSpeak}
            onOpenDeepDive={setDeepDiveWord}
            currentAccent={currentAccent}
            onToggleAccent={handleToggleAccent}
            onLoadMore={handleLoadMore}
            onWordUpdated={handleWordUpdated}
          />
        )}
      </main>

      {/* Lazy Suspense Fallback for Modals */}
      <Suspense fallback={null}>
        {/* Oxford Multidimensional Deep Dive Sheet */}
        {deepDiveWord && (
          <OxfordDeepDiveModal
            word={deepDiveWord}
            onClose={() => setDeepDiveWord(null)}
            onSpeak={handleSpeak}
            currentAccent={currentAccent}
            onWordUpdated={handleWordUpdated}
          />
        )}

        {/* Oxford 3000™ Search & Live Lookup Sheet */}
        {isBrowserOpen && (
          <OxfordBrowserModal
            onClose={() => setIsBrowserOpen(false)}
            onSpeak={handleSpeak}
            onToggleFavorite={handleToggleFavorite}
            onSelectWord={(selected) => {
              setWords((prev) => {
                const exists = prev.some((w) => w.id === selected.id);
                return exists
                  ? prev.map((w) => (w.id === selected.id ? selected : w))
                  : [selected, ...prev];
              });
              setIsBrowserOpen(false);
              setDeepDiveWord(selected);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
