import React, { useState } from 'react';
import {
  X,
  User,
  Lock,
  LogIn,
  UserPlus,
  LogOut,
  Flame,
  Trophy,
  Database,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { playTap } from '../utils/sound';

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

  if (!isOpen) return null;

  const isGuest = !currentUser || currentUser.isGuest;

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

      setSuccessMsg(tab === 'login' ? 'Zalogowano pomyślnie!' : 'Konto zostało utworzone!');
      setUsername('');
      setPassword('');

      if (onLoginSuccess) {
        onLoginSuccess(data.token, data.user, data.profile);
      }

      setTimeout(() => {
        onClose();
      }, 700);
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
        className="w-full max-w-sm bg-[#090d16] border border-white/15 rounded-3xl p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] text-white relative overflow-hidden animate-scale-up"
      >
        {/* Subtle Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-300">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-tech-mono text-sm font-bold tracking-wider text-white">
                {isGuest ? 'KONTO UŻYTKOWNIKA' : 'PROFIL W CHMURZE'}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <Database className="w-3 h-3" />
                <span>Baza Turso Online</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Logged In View */}
        {!isGuest ? (
          <div className="pt-5 space-y-4">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-base shadow-lg">
                    {currentUser.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {currentUser.username}
                    </h3>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {userProfile?.title || 'Oxford Explorer'} • Poz. {userProfile?.level || 1}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full text-amber-300 text-xs font-mono font-bold">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{userProfile?.streak_days || 1} d</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs font-mono">
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 block">PUNKTY XP</span>
                  <span className="text-amber-300 font-bold text-sm">
                    {userProfile?.xp || 0} XP
                  </span>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-neutral-400 block">DZIŚ NAUKA</span>
                  <span className="text-cyan-300 font-bold text-sm">
                    {userProfile?.words_studied_today || 0} / {userProfile?.daily_goal || 20}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed font-sans px-1">
              Wszystkie Twoje postępy SRS, punkty XP i ulubione słówka są automatycznie zapisywane online w Twojej bazie danych <strong>Turso</strong>.
            </p>

            <button
              onClick={handleLogoutClick}
              className="w-full py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-tech-mono font-bold tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              WYLOGUJ SIĘ
            </button>
          </div>
        ) : (
          /* Guest / Form View */
          <div className="pt-4 space-y-4">
            {/* Tab switch */}
            <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10 font-tech-mono text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  playTap();
                  setTab('login');
                  setError('');
                }}
                className={`py-2 rounded-lg transition-all ${
                  tab === 'login'
                    ? 'bg-white/15 text-white shadow'
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
                    ? 'bg-white/15 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                REJESTRACJA
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 font-sans">
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  NAZWA UŻYTKOWNIKA
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="np. bartes"
                    className="w-full pl-9 pr-3 py-2 bg-black/50 border border-white/15 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  HASŁO
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="minimum 4 znaki"
                    className="w-full pl-9 pr-10 py-2 bg-black/50 border border-white/15 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-tech-mono font-bold tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ŁĄCZENIE Z BAZĄ...
                  </>
                ) : tab === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    ZALOGUJ SIĘ
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    UTWÓRZ KONTO W CHMURZE
                  </>
                )}
              </button>
            </form>

            <p className="text-[10px] text-center text-neutral-500 font-mono">
              Wszystkie konta i postępy są przechowywane w chmurze Turso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
