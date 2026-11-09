/**
 * Industrial Clean Haptic & Mechanical Sound Synthesizer
 * Web Audio API - zero latency, studio precision.
 */

let audioCtx = null;
let soundEnabled = true;
let idleTimer = null;

function scheduleContextSuspend() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend().catch(() => {});
    }
  }, 4000);
}

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  scheduleContextSuspend();
  return audioCtx;
}

function attachNodeCleanup(osc, gain) {
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch (e) {}
  };
}

export function toggleSound(enabled) {
  soundEnabled = enabled !== undefined ? enabled : !soundEnabled;
  try {
    localStorage.setItem('oxford_tok_sound', soundEnabled ? '1' : '0');
  } catch (e) {}
  return soundEnabled;
}

export function isSoundEnabled() {
  try {
    const saved = localStorage.getItem('oxford_tok_sound');
    if (saved !== null) soundEnabled = saved === '1';
  } catch (e) {}
  return soundEnabled;
}

// 1. Precise mechanical shutter click (Dieter Rams / Leica style)
export function playTap() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.025);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

  osc.connect(gain);
  gain.connect(ctx.destination);
  attachNodeCleanup(osc, gain);

  osc.start();
  osc.stop(ctx.currentTime + 0.025);
}

// 1b. Tactile 3D card flip sound
export function playFlip() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(240, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.045);

  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

  osc.connect(gain);
  gain.connect(ctx.destination);
  attachNodeCleanup(osc, gain);

  osc.start();
  osc.stop(ctx.currentTime + 0.045);
}

// 2. Smooth filtered mechanical swoosh on card slide
export function playSwoosh() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.06);

  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);
  attachNodeCleanup(osc, gain);

  osc.start();
  osc.stop(ctx.currentTime + 0.06);
}

// 3. Subtle harmonic tick for Like/Save
export function playLike() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(580, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);
  attachNodeCleanup(osc, gain);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

// 4. Clean minimal double-tone for "Good"
export function playGood() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const freqs = [659.25, 880.0]; // E5, A5
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.04);

    gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.04);
    gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + idx * 0.04 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.04 + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    attachNodeCleanup(osc, gain);

    osc.start(ctx.currentTime + idx * 0.04);
    osc.stop(ctx.currentTime + idx * 0.04 + 0.22);
  });
}

// 5. Crisp ascending triad for "Easy"
export function playEasy() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const freqs = [523.25, 659.25, 1046.50]; // C5, E5, C6
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.035);

    gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.035);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + idx * 0.035 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.035 + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    attachNodeCleanup(osc, gain);

    osc.start(ctx.currentTime + idx * 0.035);
    osc.stop(ctx.currentTime + idx * 0.035 + 0.25);
  });
}

// 6. Low muted thud for "Again"
export function playAgain() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.06);

  gain.gain.setValueAtTime(0.09, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);
  attachNodeCleanup(osc, gain);

  osc.start();
  osc.stop(ctx.currentTime + 0.06);
}

// 7. Subtle celebratory harmonic chime for level-up
export function playFanfare() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [
    { freq: 440.0, time: 0.0, dur: 0.08 },
    { freq: 554.37, time: 0.07, dur: 0.08 },
    { freq: 659.25, time: 0.14, dur: 0.09 },
    { freq: 880.0, time: 0.22, dur: 0.3 }
  ];

  notes.forEach(n => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);

    gain.gain.setValueAtTime(0, ctx.currentTime + n.time);
    gain.gain.linearRampToValueAtTime(0.11, ctx.currentTime + n.time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    attachNodeCleanup(osc, gain);

    osc.start(ctx.currentTime + n.time);
    osc.stop(ctx.currentTime + n.time + n.dur);
  });
}
