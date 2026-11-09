import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  Search,
  X,
  Volume2,
  Sparkles,
  BookOpen,
  ArrowUpRight,
  Brain,
  Check,
  Loader2,
  Compass
} from 'lucide-react';
import { playTap, playGood } from '../utils/sound';
import StarGlint from './StarGlint';

const OxfordBrowserRow = memo(function OxfordBrowserRow({
  item,
  isEnriching,
  onOpenWord,
  onSpeak
}) {
  const isReady = item.definition_pl && item.definition_pl !== 'Ładowanie z Oxford API...';

  return (
    <div
      onClick={() => onOpenWord(item)}
      className="group p-3.5 rounded-2xl bg-white/[0.035] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 transition-all flex items-center justify-between gap-3 cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans font-bold text-lg text-white group-hover:text-cyan-200 transition-colors">
            {item.word}
          </span>
          <span className="text-[10px] font-tech-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 border border-white/15">
            {item.cefr_level || 'B2'}
          </span>
          <span className="text-xs font-tech-mono text-neutral-500 lowercase">
            {item.part_of_speech}
          </span>
        </div>

        <p className="text-xs text-neutral-400 truncate mt-1 font-tech-mono">
          {isEnriching
            ? '⚡ Pobieranie pełnego opisu...'
            : isReady
            ? item.definition_pl
            : item.definition_en}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            playTap();
            onSpeak(item);
          }}
          className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-neutral-300 flex items-center justify-center transition-all"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>
        <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
      </div>
    </div>
  );
});

function OxfordBrowserModalComponent({
  onClose,
  onSelectWord,
  onSpeak,
  onToggleFavorite,
  stats
}) {
  const [query, setQuery] = useState('');
  const [cefrFilter, setCefrFilter] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrichingId, setEnrichingId] = useState(null);

  const cefrLevels = ['', 'A1', 'A2', 'B1', 'B2', 'C1'];
  const searchCacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  const fetchWords = useCallback(async (q, cefr) => {
    const cacheKey = `${(q || '').toLowerCase().trim()}__${cefr || ''}`;
    if (searchCacheRef.current.has(cacheKey)) {
      setResults(searchCacheRef.current.get(cacheKey));
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/words?q=${encodeURIComponent(q)}&cefr=${encodeURIComponent(cefr)}&limit=80`,
        { signal: ac.signal }
      );
      const data = await res.json();
      if (data.success) {
        searchCacheRef.current.set(cacheKey, data.words);
        setResults(data.words);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Error searching Oxford 3000:', e);
      }
    } finally {
      if (abortControllerRef.current === ac) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWords(query, cefrFilter);
    }, 200);
    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, cefrFilter, fetchWords]);

  const handleOpenWord = useCallback(async (wordObj) => {
    playTap();
    // If not yet deep-enriched, enrich live from Oxford API right now
    if (!wordObj.senses || wordObj.senses.length === 0 || wordObj.definition_pl === 'Ładowanie z Oxford API...') {
      setEnrichingId(wordObj.id || wordObj.word);
      try {
        const res = await fetch(`/api/oxford/enrich/${encodeURIComponent(wordObj.id || wordObj.word)}`);
        const data = await res.json();
        if (data.success && data.word) {
          onSelectWord(data.word);
          setEnrichingId(null);
          return;
        }
      } catch (e) {}
      setEnrichingId(null);
    }
    onSelectWord(wordObj);
  }, [onSelectWord]);

  const totalCatalog = stats?.oxfordEngine?.totalCatalog || stats?.srs?.total_words || 4979;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg h-[92dvh] sm:h-[86vh] bg-[#05070c] sm:rounded-[32px] rounded-t-[32px] border-t sm:border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-white"
      >
        
        {/* Top Grabber & Header */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3 border-b border-white/15 bg-white/[0.02] shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StarGlint className="w-3.5 h-3.5 text-white animate-star-glint" />
                <span className="font-tech-mono font-bold text-xs uppercase tracking-widest text-white truncate">
                  KATALOG OXFORD 3000™ // SEARCH
                </span>
              </div>
              <p className="text-[11px] font-tech-mono text-neutral-400 mt-0.5 truncate">
                {totalCatalog} haseł • Indeks alfabetyczny & Live API
              </p>
            </div>
            <button
              onClick={() => {
                playTap();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center transition-all shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mt-3">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj hasła EN lub PL..."
              className="w-full pl-10 pr-9 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/[0.1] text-white placeholder-neutral-500 text-base sm:text-sm rounded-2xl border border-white/15 focus:border-white/50 focus:outline-none transition-all font-tech-mono"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* CEFR Filter Pills */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar">
            {cefrLevels.map((lvl) => (
              <button
                key={lvl || 'ALL'}
                onClick={() => {
                  playTap();
                  setCefrFilter(lvl);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-tech-mono font-semibold transition-all shrink-0 border ${
                  cefrFilter === lvl
                    ? 'bg-white text-black border-white shadow-xs'
                    : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:bg-white/[0.08]'
                }`}
              >
                {lvl ? `Poziom ${lvl}` : 'Wszystkie (4979)'}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 sm:p-4 pb-safe-bottom space-y-2 overscroll-contain">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-neutral-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
              <span className="font-tech-mono text-xs">PRZESZUKIWANIE KATALOGU...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 font-tech-mono text-xs">
              Brak wyników dla "{query}".
            </div>
          ) : (
            results.map((item) => (
              <OxfordBrowserRow
                key={item.id || item.word}
                item={item}
                isEnriching={enrichingId === (item.id || item.word)}
                onOpenWord={handleOpenWord}
                onSpeak={onSpeak}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const OxfordBrowserModal = memo(OxfordBrowserModalComponent);
export default OxfordBrowserModal;