import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Lock,
  LogIn,
  UserPlus,
  LogOut,
  Flame,
  Database,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { playTap, playGood } from '../utils/sound';

function computeLevelProgress(xp = 0) {
  const levels = [
    { level: 1, name: 'Word Spark', minXp: 0, maxXp: 150 },
    { level: 2, name: 'Vocab Novice', minXp: 150, maxXp: 400 },
    { level: 3, name: 'Oxford Explorer', minXp: 400, maxXp: 850 },
    { level: 4, name: 'Memory Crafter', minXp: 850, maxXp: 1500 },
    { level: 5, name: 'Lexical Beast', minXp: 1500, maxXp: 2500 },
    { level: 6, name: 'Fluency Titan', minXp: 2500, maxXp: 4000 },
    { level: 7, name: 'Polyglot Elite', minXp: 4000, maxXp: 99999 }
  ];

  for (let i = 0; i < levels.length; i++) {
    const l = levels[i];
    if (xp >= l.minXp && (xp < l.maxXp || i === levels.length - 1)) {
      const progressInLevel = xp - l.minXp;
      const totalNeeded = l.maxXp - l.minXp;
      const progressPercent = Math.min(100, Math.round((progressInLevel / totalNeeded) * 100));
      return {
        level: l.level,
        title: l.name,
        progressPercent,
        xpToNext: Math.max(0, l.maxXp - xp)
      };
    }
  }

  return { level: 7, title: 'Polyglot Elite', progressPercent: 100, xpToNext: 0 };
}

export default function AuthModal({
  isOpen,
  onClose,
  currentUser,
  userProfile,
  onLoginSuccess,
  onLogout
}) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isLoggedIn = Boolean(
    currentUser &&
    !currentUser.isGuest &&
    currentUser.username &&
    currentUser.username.toLowerCase() !== 'guest'
  );
  const isGuest = !isLoggedIn;

  const levelData = useMemo(() => {
    const totalXp = userProfile?.xp || 0;
    const computed = computeLevelProgress(totalXp);
    return {
      level: userProfile?.level || computed.level,
      title: userProfile?.title || computed.title,
      progressPercent: userProfile?.progressPercent ?? computed.progressPercent,
      xpToNext: userProfile?.xpToNext ?? computed.xpToNext
    };
  }, [userProfile]);

  const wordsStudied = userProfile?.words_studied_today || 0;
  const dailyGoal = userProfile?.daily_goal || 20;
  const dailyProgressPercent = Math.min(100, Math.round((wordsStudied / dailyGoal) * 100));

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!username.trim()) {
      setError('Wpisz nazwę użytkownika.');
      return;
    }
    if (!password) {
      setError('Wpisz hasło.');
      return;
    }

    setLoading(true);
    playTap();

    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Wystąpił błąd podczas logowania.');
      }

      playGood();
      setSuccessMsg(tab === 'login' ? 'Zalogowano pomyślnie!' : 'Konto zostało utworzone!');
      setUsername('');
      setPassword('');

      if (onLoginSuccess) {
        onLoginSuccess(data.token, data.user, data.profile);
      }

      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = () => {
    playTap();
    if (onLogout) onLogout();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm obsidian-card-surface rounded-[28px] p-6 text-white relative overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] animate-scale-up border border-white/10"
      >
        {/* Minimal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-neutral-300">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-tech-mono text-xs font-bold tracking-wider text-white uppercase">
                {isGuest ? 'Konto użytkownika' : 'Profil w chmurze'}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Baza Turso Online</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all active:scale-90"
            title="Zamknij"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Logged-In View */}
        {!isGuest ? (
          <div className="pt-4 space-y-3.5">
            {/* Clean Profile Card */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center font-bold text-base text-white font-tech-mono shadow-inner">
                    {currentUser.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight font-sans">
                      {currentUser.username}
                    </h3>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {levelData.title} • Poz. {levelData.level}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-white/[0.05] border border-white/10 px-2.5 py-1 rounded-full text-neutral-200 text-xs font-mono font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{userProfile?.streak_days || 1} d</span>
                </div>
              </div>

              {/* Clean Stats Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/5 font-mono">
                <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 block tracking-wider uppercase">
                    PUNKTY XP
                  </span>
                  <span className="text-white font-bold text-sm block mt-0.5">
                    {userProfile?.xp || 0} XP
                  </span>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-300"
                      style={{ width: `${levelData.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 block tracking-wider uppercase">
                    DZIŚ NAUKA
                  </span>
                  <span className="text-white font-bold text-sm block mt-0.5">
                    {wordsStudied} <span className="text-neutral-500 font-normal">/ {dailyGoal}</span>
                  </span>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-300"
                      style={{ width: `${dailyProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed font-sans px-0.5">
              Wszystkie Twoje postępy SRS, punkty XP i ulubione słówka są automatycznie zapisywane online w bazie danych <strong className="text-neutral-200 font-medium">Turso</strong>.
            </p>

            <button
              type="button"
              onClick={handleLogoutClick}
              className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/25 text-neutral-300 hover:text-rose-300 text-xs font-tech-mono font-medium tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>WYLOGUJ SIĘ</span>
            </button>
          </div>
        ) : (
          /* Guest / Auth Form View */
          <div className="pt-4 space-y-3.5">
            {/* Minimal Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10 font-tech-mono text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  playTap();
                  setTab('login');
                  setError('');
                }}
                className={`py-2 rounded-lg transition-all ${
                  tab === 'login'
                    ? 'bg-white text-black font-bold shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                LOGOWANIE
              </button>
              <button
                type="button"
                onClick={() => {
                  playTap();
                  setTab('register');
                  setError('');
                }}
                className={`py-2 rounded-lg transition-all ${
                  tab === 'register'
                    ? 'bg-white text-black font-bold shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                REJESTRACJA
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs font-mono flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs font-mono flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 font-sans">
              <div>
                <label className="block text-[10px] font-mono tracking-wider uppercase text-neutral-400 mb-1">
                  NAZWA UŻYTKOWNIKA
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="np. bartes"
                    className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/10 focus:border-white/30 rounded-xl text-sm text-white placeholder-neutral-600 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono tracking-wider uppercase text-neutral-400 mb-1">
                  HASŁO
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="minimum 4 znaki"
                    className="w-full pl-9 pr-10 py-2 bg-black/50 border border-white/10 focus:border-white/30 rounded-xl text-sm text-white placeholder-neutral-600 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      playTap();
                      setShowPassword(!showPassword);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1.5 py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 active:scale-[0.99] text-black text-xs font-tech-mono font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>ŁĄCZENIE Z BAZĄ...</span>
                  </>
                ) : tab === 'login' ? (
                  <>
                    <LogIn className="w-3.5 h-3.5 text-black" />
                    <span>ZALOGUJ SIĘ</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 text-black" />
                    <span>UTWÓRZ KONTO</span>
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 font-mono pt-1">
              <Database className="w-3 h-3 text-neutral-500" />
              <span>Baza danych Turso Online</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
