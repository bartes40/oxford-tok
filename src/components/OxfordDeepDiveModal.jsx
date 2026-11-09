import React, { useState, useEffect, memo } from 'react';
import {
  X,
  Volume2,
  BookOpen,
  Layers,
  Compass,
  GitBranch,
  MessageSquareQuote,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { playTap } from '../utils/sound';
import StarGlint from './StarGlint';

// Tastefully highlight target word in example sentences
function highlightWord(sentence, targetWord) {
  if (!sentence || !targetWord) return sentence;
  try {
    const stem = targetWord.length > 4 ? targetWord.slice(0, -1) : targetWord;
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = sentence.split(new RegExp(`(\\b${escaped}\\w*\\b)`, 'gi'));
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
    return sentence;
  }
}

function OxfordDeepDiveModalComponent({
  word: initialWord,
  onClose,
  onSpeak,
  currentAccent,
  onWordUpdated
}) {
  const [word, setWord] = useState(initialWord);
  const [loadingDeep, setLoadingDeep] = useState(false);

  useEffect(() => {
    setWord(initialWord);
    const isPlBad =
      !initialWord?.definition_pl ||
      initialWord?.definition_pl.trim().toLowerCase() === (initialWord?.word || '').trim().toLowerCase() ||
      initialWord?.definition_pl.startsWith('Ładowanie');

    if (
      initialWord &&
      (!initialWord.senses ||
        initialWord.senses.length <= 1 ||
        isPlBad)
    ) {
      setLoadingDeep(true);
      fetch(`/api/oxford/enrich/${encodeURIComponent(initialWord.id || initialWord.word)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.word) {
            setWord(data.word);
            if (onWordUpdated) onWordUpdated(data.word);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDeep(false));
    }
  }, [initialWord?.id, initialWord?.word]);

  if (!word) return null;

  const senses = Array.isArray(word.senses) && word.senses.length > 0 ? word.senses : null;
  const verbForms = Array.isArray(word.verb_forms) ? word.verb_forms : [];
  const idioms = Array.isArray(word.idioms) ? word.idioms : [];
  const extraExamples = Array.isArray(word.extra_examples) ? word.extra_examples : [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-2xl flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#05070c] text-white w-full max-w-xl max-h-[92dvh] sm:max-h-[86vh] rounded-t-[32px] sm:rounded-[32px] border-t sm:border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col"
      >
        {/* Sheet Header */}
        <div className="relative px-5 sm:px-6 pt-4 pb-3 border-b border-white/15 flex items-center justify-between shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2 sm:hidden" />
          <div className="flex items-center gap-2">
            <StarGlint className="w-3.5 h-3.5 text-white animate-star-glint" />
            <span className="font-tech-mono text-xs font-bold text-neutral-300 uppercase tracking-widest">
              OXFORD 3000™ // PROFILE
            </span>
          </div>
          <button
            onClick={() => {
              playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 pb-safe-bottom overflow-y-auto no-scrollbar space-y-5 sm:space-y-6 flex-1 overscroll-contain">
          {loadingDeep && (
            <div className="bg-white/[0.04] border border-white/15 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs text-neutral-300 font-tech-mono">
              <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
              <span>SYNCHRONIZING WITH OXFORD API...</span>
            </div>
          )}

          {/* Headword & Audio */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="chrome-text font-sans font-black text-3xl sm:text-4xl tracking-tight">
                {word.word}
              </h2>
              <span className="font-tech-mono text-xs font-bold px-2.5 py-0.5 rounded bg-white text-black">
                {word.cefr_level || 'B2'}
              </span>
              <span className="font-tech-mono text-xs text-neutral-400 lowercase">
                {word.part_of_speech}
              </span>
            </div>

            {/* UK & US Audio Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-3.5">
              <button
                onClick={() => onSpeak(word, { accent: 'en-GB' })}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-white transition-all text-xs sm:text-sm font-tech-mono active:scale-95 shadow-xs"
              >
                <span className="font-bold text-neutral-400">UK</span>
                <span className="text-white font-semibold">{word.phonetic}</span>
                <Volume2 className="w-4 h-4 text-white" />
              </button>

              <button
                onClick={() => onSpeak(word, { accent: 'en-US' })}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-white transition-all text-xs sm:text-sm font-tech-mono active:scale-95 shadow-xs"
              >
                <span className="font-bold text-neutral-400">US</span>
                <span className="text-white font-semibold">{word.phonetic_us || word.phonetic}</span>
                <Volume2 className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Polish Meaning Box */}
            <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/15 shadow-inner">
              <div className="text-[10px] font-tech-mono text-neutral-400 uppercase tracking-widest mb-1">
                GŁÓWNE ZNACZENIE (PL)
              </div>
              <p className="font-sans font-black text-xl sm:text-2xl text-white leading-snug tracking-tight">
                {word.definition_pl}
              </p>
            </div>
          </div>

          {/* All Senses */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-tech-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-white" />
                Znaczenia i przykłady ({senses ? senses.length : 1})
              </span>
              {word.oxford_url && (
                <a
                  href={word.oxford_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-tech-mono text-white/90 hover:underline flex items-center gap-1"
                >
                  Oxford <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {senses ? (
              <div className="space-y-3.5">
                {senses.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-tech-mono font-bold text-neutral-500">
                        0{s.senseNumber || idx + 1}
                      </span>
                      {s.cefr && (
                        <span className="text-[10px] font-tech-mono font-bold px-2 py-0.5 rounded bg-white text-black">
                          {s.cefr}
                        </span>
                      )}
                      {s.register && (
                        <span className="text-xs font-tech-mono italic text-neutral-400">
                          {s.register}
                        </span>
                      )}
                      {s.pattern && (
                        <span className="text-xs font-tech-mono font-semibold text-neutral-200 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/20">
                          {s.pattern}
                        </span>
                      )}
                    </div>

                    <p className="text-[15px] sm:text-base font-semibold text-neutral-100 leading-relaxed">
                      {s.definition}
                    </p>

                    {s.definition_pl && (
                      <p className="text-sm font-bold text-white font-tech-mono flex items-center gap-1.5">
                        <span className="text-neutral-400">→</span>
                        <span className="silver-distressed-underline">{s.definition_pl}</span>
                      </p>
                    )}

                    {Array.isArray(s.examples) && s.examples.length > 0 && (
                      <ul className="space-y-2 pt-2.5 border-t border-white/10">
                        {s.examples.map((ex, i) => (
                          <li
                            key={i}
                            className="font-sans text-sm sm:text-[15px] font-medium text-neutral-300 leading-relaxed"
                          >
                            {highlightWord(ex, word.word)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <p className="text-base font-medium text-neutral-200">{word.definition_en}</p>
                {word.example_en && (
                  <p className="font-sans text-[15px] font-medium text-neutral-300 pt-2.5 border-t border-white/10">
                    {highlightWord(word.example_en, word.word)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Collocations */}
          {word.collocations && word.collocations.length > 0 && (
            <div>
              <span className="text-xs font-tech-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <Layers className="w-3.5 h-3.5 text-white" /> Kolokacje Oxford
              </span>
              <div className="flex flex-wrap gap-2">
                {word.collocations.map((col, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white/[0.05] border border-white/10 text-neutral-300 text-xs sm:text-sm font-tech-mono rounded-lg"
                  >
                    {highlightWord(col, word.word)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verb Forms */}
          {verbForms.length > 0 && (
            <div>
              <span className="text-xs font-tech-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <GitBranch className="w-3.5 h-3.5 text-white" /> Formy gramatyczne
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {verbForms.map((vf, idx) => (
                  <div
                    key={idx}
                    className="px-3.5 py-2 bg-white/[0.03] rounded-xl border border-white/10 text-xs sm:text-sm font-tech-mono text-neutral-300"
                  >
                    {vf}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synonyms & Antonyms */}
          {(word.synonyms?.length > 0 || word.antonyms?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {word.synonyms?.length > 0 && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <span className="text-[11px] font-tech-mono font-bold uppercase tracking-wider text-neutral-400">
                    Synonimy
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {word.synonyms.map((syn, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-tech-mono text-neutral-200"
                      >
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {word.antonyms?.length > 0 && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <span className="text-[11px] font-tech-mono font-bold uppercase tracking-wider text-neutral-400">
                    Antonimy
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {word.antonyms.map((ant, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-tech-mono text-neutral-200"
                      >
                        {ant}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Idioms */}
          {idioms.length > 0 && (
            <div>
              <span className="text-xs font-tech-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-white" /> Idiomy
              </span>
              <div className="space-y-2">
                {idioms.map((idm, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="font-sans font-bold text-sm text-white">
                      {idm.phrase}
                    </div>
                    <div className="text-sm text-neutral-400 mt-1">{idm.definition}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra Examples */}
          {extraExamples.length > 0 && (
            <div>
              <span className="text-xs font-tech-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <Compass className="w-3.5 h-3.5 text-white" /> Dodatkowe przykłady Oxford
              </span>
              <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                {extraExamples.slice(0, 5).map((ex, i) => (
                  <p key={i} className="font-sans text-sm sm:text-[15px] font-medium text-neutral-300 leading-relaxed">
                    {highlightWord(ex, word.word)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const OxfordDeepDiveModal = memo(OxfordDeepDiveModalComponent);
export default OxfordDeepDiveModal;