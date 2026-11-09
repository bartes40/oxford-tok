/**
 * Crystal-Clear Oxford Pronunciation Speech Engine
 * 1. Plays Official Oxford Learner's Dictionary Studio Audio MP3s (British 🇬🇧 & American 🇺🇸)
 * 2. Gracefully falls back to Web Speech Synthesis for sentences or offline mode
 */

let selectedAccent = 'en-GB'; // Default to Oxford standard British English
let activeAudio = null;
let cachedVoices = [];

// Initialize voices cache cleanly once available
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const updateVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) cachedVoices = v;
    } catch (e) {}
  };
  updateVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }
}

export function setAccent(accent) {
  selectedAccent = accent;
  try {
    localStorage.setItem('oxford_tok_accent', accent);
  } catch (e) {}
}

export function getAccent() {
  try {
    const saved = localStorage.getItem('oxford_tok_accent');
    if (saved) selectedAccent = saved;
  } catch (e) {}
  return selectedAccent;
}

export function speakWord(wordOrText, options = {}) {
  if (typeof window === 'undefined') return;

  const accent = options.accent || selectedAccent;
  const isSlow = Boolean(options.slow);

  // Stop any playing HTML5 Audio or SpeechSynthesis
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.src = '';
    } catch (e) {}
    activeAudio = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }

  const text = typeof wordOrText === 'object' ? wordOrText.word : String(wordOrText || '');
  const audioUk = typeof wordOrText === 'object' ? wordOrText.audio_uk : options.audio_uk;
  const audioUs = typeof wordOrText === 'object' ? wordOrText.audio_us : options.audio_us;

  const targetMp3 = accent === 'en-US' ? (audioUs || audioUk) : (audioUk || audioUs);

  // Try playing official Oxford Studio MP3 first if available
  if (targetMp3 && targetMp3.startsWith('http')) {
    try {
      const audio = new Audio(targetMp3);
      audio.playbackRate = isSlow ? 0.68 : 1.0;
      activeAudio = audio;
      audio.onended = () => {
        if (activeAudio === audio) activeAudio = null;
      };
      audio.play().catch(() => {
        speakWithSynthesis(text, accent, isSlow);
      });
      return;
    } catch (e) {
      // Fallback to synthesis
    }
  }

  speakWithSynthesis(text, accent, isSlow);
}

function speakWithSynthesis(text, accent, isSlow) {
  if (!text || !('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = isSlow ? 0.7 : 0.94;
  utterance.pitch = 1.0;
  utterance.lang = accent;

  const voices = cachedVoices.length > 0 ? cachedVoices : (window.speechSynthesis.getVoices() || []);
  const langTarget = utterance.lang.toLowerCase();

  const bestVoice =
    voices.find(v => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      return (
        vLang.startsWith(langTarget) &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Daniel') ||
          v.name.includes('Samantha') ||
          v.name.includes('Serena'))
      );
    }) || voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(langTarget));

  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  window.speechSynthesis.speak(utterance);
}
