import React, { useState, useEffect } from 'react';
import { X, Zap, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playGood, playEasy, playAgain, playTap } from '../utils/sound';

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
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] rounded-t-[28px] sm:rounded-3xl border-t sm:border border-neutral-200 shadow-2xl overflow-hidden flex flex-col"
      >
        
        {/* Header */}
        <div className="bg-neutral-900 text-white p-4 px-5 flex items-center justify-between border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-amber-400 fill-current shrink-0" />
            <span className="font-mono-code font-semibold text-xs uppercase tracking-wider text-neutral-200 truncate">
              Pop Quiz • Sprawdzenie Wiedzy
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-white/10 text-[#00e575] text-[10px] font-mono-code font-bold px-2 py-0.5 rounded">
              +{score * 25} XP
            </span>
            <button
              onClick={() => {
                playTap();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 pb-safe-bottom overflow-y-auto no-scrollbar overscroll-contain">
          {loading ? (
            <div className="py-12 text-center font-mono-code text-xs text-neutral-400 animate-pulse">
              Generowanie pytania Oxford 3000...
            </div>
          ) : question ? (
            <div>
              {/* Question Card */}
              <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/80 mb-5 text-center">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono-code font-bold bg-neutral-900 text-white px-2 py-0.5 rounded">
                    CEFR {question.cefr_level}
                  </span>
                  <span className="text-[10px] font-mono-code text-neutral-400 uppercase">
                    {question.part_of_speech}
                  </span>
                </div>

                <div className="my-2">
                  <span className="text-[11px] font-mono-code text-neutral-400 uppercase tracking-wider block">Wybierz poprawne znaczenie słowa:</span>
                  <h3 className="font-display font-extrabold text-4xl text-neutral-900 mt-1">
                    {question.word}
                  </h3>
                  <div className="text-xs font-mono-code text-[#0026e6] font-medium mt-1">
                    {question.phonetic}
                  </div>
                </div>

                {/* Example sentence hint */}
                <div className="mt-3 p-3 bg-white rounded-xl border border-neutral-200 text-center">
                  <span className="text-[9px] font-mono-code text-neutral-400 uppercase tracking-wider block mb-1">
                    Kontekst zdania Oxford:
                  </span>
                  <p className="text-xs italic text-neutral-700 font-editorial">
                    "{question.example_en}"
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-2">
                {question.options.map((opt, i) => {
                  let btnStyle = 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200';

                  if (isAnswered) {
                    if (opt.isCorrect) {
                      btnStyle = 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold';
                    } else if (selectedOption === i) {
                      btnStyle = 'bg-rose-50 text-rose-700 border border-rose-300';
                    } else {
                      btnStyle = 'bg-neutral-50 text-neutral-400 border border-neutral-200 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(opt, i)}
                      disabled={isAnswered}
                      className={`w-full p-3.5 rounded-xl font-sans text-sm text-left transition-all flex items-center justify-between industrial-button ${btnStyle}`}
                    >
                      <span>{opt.text}</span>
                      {isAnswered && opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {isAnswered && !opt.isCorrect && selectedOption === i && <XCircle className="w-4 h-4 text-rose-600" />}
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
                  className="mt-5 w-full py-3 bg-neutral-900 hover:bg-black text-white font-mono-code font-medium text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 industrial-button"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Kolejne pytanie (+25 XP)
                </button>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-mono-code text-neutral-400">Brak pytań.</div>
          )}
        </div>

      </div>
    </div>
  );
}
