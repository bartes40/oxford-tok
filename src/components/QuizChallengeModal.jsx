import React, { useState, useEffect } from 'react';
import { X, Zap, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playGood, playEasy, playAgain, playTap } from '../utils/sound';
import StarGlint from './StarGlint';

export default function QuizChallengeModal({ onClose, onRewardXp }) {
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  const fetchQuestion = async () => {
    setLoading(true);
    setSelectedOption(null);
    setIsAnswered(false);
    try {
      const res = await fetch('/api/quiz-question');
      const data = await res.json();
      if (data.success) {
        setQuestion(data.question);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const handleSelect = (option, index) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (option.isCorrect) {
      playGood();
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 }
      });
      setScore(s => s + 1);
      if (onRewardXp) onRewardXp(25);
    } else {
      playAgain();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-2xl flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#05070c] text-white w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] border-t sm:border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col"
      >
        
        {/* Header */}
        <div className="relative px-5 pt-4 pb-3 border-b border-white/15 flex items-center justify-between shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2 sm:hidden" />
          <div className="flex items-center gap-2 min-w-0">
            <StarGlint className="w-3.5 h-3.5 text-white animate-star-glint" />
            <span className="font-tech-mono font-bold text-xs uppercase tracking-widest text-neutral-300 truncate">
              POP QUIZ // OXFORD 3000™
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-white/10 text-white text-[10px] font-tech-mono font-bold px-2 py-0.5 rounded border border-white/20">
              +{score * 25} XP
            </span>
            <button
              onClick={() => {
                playTap();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 pb-safe-bottom overflow-y-auto no-scrollbar overscroll-contain">
          {loading ? (
            <div className="py-12 text-center font-tech-mono text-xs text-neutral-400 animate-pulse">
              GENEROWANIE PYTANIA OXFORD 3000...
            </div>
          ) : question ? (
            <div>
              {/* Question Card */}
              <div className="bg-white/[0.04] p-5 rounded-2xl border border-white/15 mb-5 text-center">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-tech-mono font-bold bg-white text-black px-2 py-0.5 rounded uppercase">
                    CEFR {question.cefr_level}
                  </span>
                  <span className="text-[10px] font-tech-mono text-neutral-400 uppercase">
                    {question.part_of_speech}
                  </span>
                </div>

                <div className="my-3">
                  <span className="text-[10px] font-tech-mono text-neutral-400 uppercase tracking-widest block">
                    WYBIERZ POPRAWNE ZNACZENIE:
                  </span>
                  <h3 className="chrome-text font-sans font-black text-4xl text-white mt-1">
                    {question.word}
                  </h3>
                  <div className="text-xs font-tech-mono text-cyan-300 font-medium mt-1">
                    {question.phonetic}
                  </div>
                </div>

                {/* Example sentence hint */}
                <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/10 text-center">
                  <span className="text-[9px] font-tech-mono text-neutral-400 uppercase tracking-widest block mb-1">
                    KONTEKST ZDANIA OXFORD:
                  </span>
                  <p className="text-sm italic text-neutral-200 font-sans">
                    "{question.example_en}"
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-2.5">
                {question.options.map((opt, i) => {
                  let btnStyle = 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 border border-white/15';

                  if (isAnswered) {
                    if (opt.isCorrect) {
                      btnStyle = 'bg-white/15 text-white border border-white/60 font-semibold shadow-[0_0_16px_rgba(255,255,255,0.4)]';
                    } else if (selectedOption === i) {
                      btnStyle = 'bg-rose-500/20 text-rose-300 border border-rose-500/60';
                    } else {
                      btnStyle = 'bg-white/[0.02] text-neutral-500 border border-white/5 opacity-40';
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(opt, i)}
                      disabled={isAnswered}
                      className={`w-full p-4 rounded-xl font-sans text-sm text-left transition-all flex items-center justify-between active:scale-[0.99] backdrop-blur-md ${btnStyle}`}
                    >
                      <span className="font-medium">{opt.text}</span>
                      {isAnswered && opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-white" />}
                      {isAnswered && !opt.isCorrect && selectedOption === i && <XCircle className="w-4 h-4 text-rose-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Next Question Button */}
              {isAnswered && (
                <button
                  onClick={() => {
                    playTap();
                    fetchQuestion();
                  }}
                  className="mt-5 w-full py-3.5 bg-white text-black hover:bg-neutral-200 font-tech-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Kolejne pytanie (+25 XP)
                </button>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-tech-mono text-neutral-400">BRAK PYTAŃ.</div>
          )}
        </div>

      </div>
    </div>
  );
}
