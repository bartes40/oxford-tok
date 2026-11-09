import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = fs.existsSync(path.join(process.cwd(), 'data'))
  ? path.join(process.cwd(), 'data')
  : path.join(__dirname, '..', 'data');
const catalogCachePath = path.join(dataDir, 'oxford3000_catalog.json');
const masterDictPath = path.join(dataDir, 'oxford_en_pl_master.json');

let masterDict = {};
try {
  if (fs.existsSync(masterDictPath)) {
    masterDict = JSON.parse(fs.readFileSync(masterDictPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not load master dictionary:', e.message);
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Active background worker state
let isWorkerRunning = false;
let workerStats = {
  totalCatalog: 0,
  enrichedCount: 0,
  lastEnrichedWord: '',
  isSyncing: false
};

// Clean HTML tags & decode HTML entities
function cleanHtml(str = '') {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 1. Fetch & Sync Full Official Oxford 3000™ Catalog (~3,000 unique headwords / 3,812 entries)
 * Automatically caches to data/oxford3000_catalog.json and populates SQLite `words` table.
 */
export async function syncOxford3000Catalog() {
  try {
    let catalog = [];

    if (fs.existsSync(catalogCachePath)) {
      try {
        catalog = JSON.parse(fs.readFileSync(catalogCachePath, 'utf-8'));
      } catch (e) {
        catalog = [];
      }
    }

    if (!catalog || catalog.length < 4000) {
      console.log('🌐 Fetching complete official Oxford 3000™ & 5000™ wordlist from Oxford Learner’s Dictionaries...');
      const res = await fetch('https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000', {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (res.ok) {
        const html = await res.text();
        // Match BOTH data-ox3000 AND data-ox5000 entries from the official Oxford wordlist!
        const matches = [
          ...html.matchAll(/<li[^>]*data-hw="([^"]+)"[^>]*data-(?:ox3000|ox5000)="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)
        ];

        const byWord = new Map();
        const cefrOrder = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };

        let idx = 0;
        for (const m of matches) {
          idx++;
          const word = m[1].trim();
          const ox3000Cefr = m[0].match(/data-ox3000="([^"]+)"/)?.[1]?.trim()?.toUpperCase();
          const ox5000Cefr = m[0].match(/data-ox5000="([^"]+)"/)?.[1]?.trim()?.toUpperCase();
          const cefrRaw = ox3000Cefr || ox5000Cefr || m[2].trim().toUpperCase();
          const cefr = ['A1', 'A2', 'B1', 'B2', 'C1'].includes(cefrRaw) ? cefrRaw : 'B2';
          const inner = m[3];

          const posMatch = inner.match(/<span class="pos">([^<]+)<\/span>/);
          const hrefMatch = inner.match(/href="([^"]+)"/);
          const mp3UkMatch = inner.match(/data-src-mp3="([^"]*uk_pron[^"]*\.mp3)"/);
          const mp3UsMatch = inner.match(/data-src-mp3="([^"]*us_pron[^"]*\.mp3)"/);

          const pos = posMatch ? posMatch[1].trim() : 'noun';
          const href = hrefMatch
            ? hrefMatch[1].trim()
            : `/definition/english/${encodeURIComponent(word.toLowerCase())}`;
          const audio_uk = mp3UkMatch ? `https://www.oxfordlearnersdictionaries.com${mp3UkMatch[1]}` : '';
          const audio_us = mp3UsMatch ? `https://www.oxfordlearnersdictionaries.com${mp3UsMatch[1]}` : '';
          const fullUrl = `https://www.oxfordlearnersdictionaries.com${href}`;

          const key = word.toLowerCase();
          if (!byWord.has(key)) {
            byWord.set(key, {
              word,
              cefr_level: cefr,
              part_of_speech: pos,
              all_pos: [pos],
              oxford_url: fullUrl,
              audio_uk,
              audio_us,
              frequency_rank: idx
            });
          } else {
            const existing = byWord.get(key);
            if (!existing.all_pos.includes(pos)) {
              existing.all_pos.push(pos);
              existing.part_of_speech = existing.all_pos.slice(0, 3).join(' / ');
            }
            if ((cefrOrder[cefr] || 9) < (cefrOrder[existing.cefr_level] || 9)) {
              existing.cefr_level = cefr;
            }
            if (!existing.audio_uk && audio_uk) existing.audio_uk = audio_uk;
            if (!existing.audio_us && audio_us) existing.audio_us = audio_us;
          }
        }

        catalog = [...byWord.values()];
        fs.writeFileSync(catalogCachePath, JSON.stringify(catalog, null, 2), 'utf-8');
        console.log(`✅ Cached ${catalog.length} unique Oxford 3000™ & 5000™ headwords to disk.`);
      }
    }

    if (catalog.length > 0) {
      const insertStub = db.prepare(`
        INSERT INTO words (
          word, phonetic, cefr_level, part_of_speech,
          definition_en, definition_pl, example_en, example_pl,
          collocations, synonyms, antonyms, oxford_category,
          memory_hook, frequency_rank, audio_uk, audio_us, oxford_url, enriched_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 0
        )
        ON CONFLICT(word) DO UPDATE SET
          audio_uk = CASE WHEN words.audio_uk = '' OR words.audio_uk IS NULL THEN excluded.audio_uk ELSE words.audio_uk END,
          audio_us = CASE WHEN words.audio_us = '' OR words.audio_us IS NULL THEN excluded.audio_us ELSE words.audio_us END,
          oxford_url = CASE WHEN words.oxford_url = '' OR words.oxford_url IS NULL THEN excluded.oxford_url ELSE words.oxford_url END
      `);

      const insertProgress = db.prepare(`
        INSERT OR IGNORE INTO user_progress (word_id, state, repetitions, interval_days, ease_factor, next_review, streak_count, is_favorite)
        VALUES (?, 'new', 0, 0, 2.5, 0, 0, 0)
      `);

      db.exec('BEGIN TRANSACTION');
      try {
        for (const item of catalog) {
          const wClean = item.word.toLowerCase();
          const stubPl = masterDict[wClean] || masterDict[wClean.replace(/&#x2122;/g, '™')] || 'Ładowanie z Oxford API...';
          insertStub.run(
            item.word,
            `/${item.word.toLowerCase()}/`,
            item.cefr_level,
            item.part_of_speech,
            `Oxford 3000™ core ${item.part_of_speech} (${item.cefr_level}). Tap to load full multidimensional Oxford entry.`,
            stubPl,
            `This is an essential Oxford 3000™ word: ${item.word}.`,
            '',
            '[]',
            '[]',
            '[]',
            `Oxford 3000 • ${item.cefr_level}`,
            '',
            item.frequency_rank + 500,
            item.audio_uk || '',
            item.audio_us || '',
            item.oxford_url || ''
          );
        }
        db.exec('COMMIT');
      } catch (txErr) {
        db.exec('ROLLBACK');
        console.error('Transaction error syncing catalog:', txErr);
      }

      // Ensure user_progress rows exist
      db.exec(`
        INSERT OR IGNORE INTO user_progress (word_id, state, repetitions, interval_days, ease_factor, next_review, streak_count, is_favorite)
        SELECT id, 'new', 0, 0, 2.5, 0, 0, 0 FROM words
      `);

      // Mark already rich seeded words as enriched if they have real Polish definitions
      db.exec(`
        UPDATE words
        SET enriched_at = 1
        WHERE enriched_at = 0
          AND definition_pl != 'Ładowanie z Oxford API...'
          AND definition_en NOT LIKE 'Oxford 3000™ core%'
      `);

      const total = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
      const enriched = db.prepare('SELECT COUNT(*) as c FROM words WHERE enriched_at > 0').get().c;
      workerStats.totalCatalog = total;
      workerStats.enrichedCount = enriched;
      console.log(`📚 Oxford 3000™ Database Ready: ${total} total headwords (${enriched} already enriched).`);
    }
  } catch (err) {
    console.error('Error syncing Oxford 3000 catalog:', err.message);
  }
}

/**
 * 2. Translate English word & sentences to Polish using Diki.pl (Primary) + Google Translate (Fallback)
 */
export function translationAvailable() {
  return true;
}

// Map Oxford CEFR / grammatical parts of speech to Diki Polish POS headers
function normalizePosToDiki(pos = '') {
  const p = String(pos || '').toLowerCase();
  const targets = [];
  if (p.includes('verb') && !p.includes('adverb')) targets.push('czasownik');
  if (p.includes('noun')) targets.push('rzeczownik');
  if (p.includes('adj')) targets.push('przymiotnik');
  if (p.includes('adv')) targets.push('przysłówek');
  if (p.includes('prep')) targets.push('przyimek');
  if (p.includes('conj')) targets.push('spójnik');
  if (p.includes('pron')) targets.push('zaimek');
  if (p.includes('exclam') || p.includes('interj')) targets.push('wykrzyknik');
  if (p.includes('idiom')) targets.push('idiom');
  return targets;
}

/**
 * High-precision Diki.pl Scraper / API:
 * - Sorts strictly by real-world frequency (most common usage first)
 * - Targets exact grammatical part of speech matching Oxford
 * - Extracts authentic example sentences with natural Polish translations
 */
export async function fetchDikiLinguistics(word, posHint = '') {
  const cleanWord = String(word || '').toLowerCase().trim();
  if (!cleanWord) return null;

  try {
    const url = `https://www.diki.pl/slownik-angielskiego?q=${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl,en-US;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return null;
    const html = await res.text();

    const targetPosNames = normalizePosToDiki(posHint);

    const entities = [...html.matchAll(/<div class="dictionaryEntity"[^>]*>([\s\S]*?)(?=<div class="dictionaryEntity"|$)/g)];
    if (entities.length === 0) return null;

    // Filter to entities whose headword matches or starts with our cleanWord
    const validEntities = entities.filter(ent => {
      const hwMatch = ent[1].match(/<span class="hw">([\s\S]*?)<\/span>/);
      if (!hwMatch) return true;
      const hwText = cleanHtml(hwMatch[1]).toLowerCase();
      return hwText === cleanWord || hwText.startsWith(cleanWord);
    });

    const candidateEntities = validEntities.length > 0 ? validEntities : entities.slice(0, 3);

    // Two-pass POS matching:
    // Pass 1: find all POS sections matching targetPosNames across candidate entities
    const matchedSections = [];
    const allSections = [];

    for (const ent of candidateEntities) {
      const entHtml = ent[1];
      const posSections = [...entHtml.matchAll(/<div class="partOfSpeechSectionHeader">[\s\S]*?<span class="partOfSpeech">([^<]+)<\/span>([\s\S]*?)(?=<div class="partOfSpeechSectionHeader"|$)/g)];

      for (const s of posSections) {
        allSections.push(s);
        const sPos = s[1].trim().toLowerCase();
        if (targetPosNames.length > 0 && targetPosNames.some(tp => sPos.includes(tp))) {
          matchedSections.push(s);
        }
      }
    }

    const sectionsToProcess = matchedSections.length > 0 ? matchedSections : allSections;
    if (sectionsToProcess.length === 0) return null;

    const orderedMeanings = [];
    let primaryExample = null;
    const senses = [];

    for (const [_, posName, sectionContent] of sectionsToProcess) {
      const listItems = [...sectionContent.matchAll(/<li[^>]*id="meaning[^"]*"[^>]*>([\s\S]*?)<\/li>/g)];

      for (const li of listItems) {
        const liContent = li[1];
        const hwSpans = [...liContent.matchAll(/<span class="hw"[^>]*>([\s\S]*?)<\/span>/g)];
        const meaningTerms = [];

        for (const hwSpan of hwSpans) {
          const raw = hwSpan[1];
          const linkMatch = raw.match(/<a[^>]*class="plainLink"[^>]*>([\s\S]*?)<\/a>/);
          const mainTerm = linkMatch ? cleanHtml(linkMatch[1]) : cleanHtml(raw);

          const cleanTerm = mainTerm
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/[,\/]$/, '')
            .trim();

          if (cleanTerm && !meaningTerms.some(t => t.toLowerCase() === cleanTerm.toLowerCase())) {
            meaningTerms.push(cleanTerm);
          }
        }

        if (meaningTerms.length > 0) {
          for (const t of meaningTerms) {
            if (!orderedMeanings.some(m => m.toLowerCase() === t.toLowerCase())) {
              orderedMeanings.push(t);
            }
          }
        }

        let senseExample = null;
        const exampleDiv = liContent.match(/<div class="exampleSentence"[^>]*>([\s\S]*?)<\/div>/);
        if (exampleDiv) {
          const rawEx = cleanHtml(exampleDiv[1]);
          const matchEx = rawEx.match(/^(.*?)\s*\((.*?)\)\s*$/);
          if (matchEx) {
            senseExample = {
              en: matchEx[1].trim(),
              pl: matchEx[2].trim()
            };
            if (!primaryExample) {
              primaryExample = senseExample;
            }
          }
        }

        senses.push({
          pos: posName.trim(),
          meanings: meaningTerms,
          example: senseExample
        });
      }

      if (orderedMeanings.length >= 6) break;
    }

    if (orderedMeanings.length === 0) return null;

    return {
      source: 'diki',
      primaryMeaning: orderedMeanings[0],
      definition_pl: orderedMeanings.slice(0, 5).join(', '),
      allMeanings: orderedMeanings.slice(0, 8),
      example: primaryExample,
      senses: senses.slice(0, 6)
    };
  } catch (err) {
    return null;
  }
}

/**
 * Translate text EN -> PL. Uses multi-endpoint Google clients (clients5, dict-chrome-ex, translate.googleapis),
 * never echoes input text back as translation.
 */
async function translateToPolish(text) {
  const clean = String(text || '').trim();
  if (!clean) return '';

  const endpoints = [
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=pl&q=${encodeURIComponent(clean)}`,
    `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=pl&dt=t&q=${encodeURIComponent(clean)}`,
    `https://clients1.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=pl&q=${encodeURIComponent(clean)}`,
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pl&dt=t&q=${encodeURIComponent(clean)}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const raw = await res.json();
        if (typeof raw === 'string') {
          const out = raw.trim();
          if (out && out.toLowerCase() !== clean.toLowerCase()) return out;
        }
        if (Array.isArray(raw)) {
          if (typeof raw[0] === 'string') {
            const out = raw[0].trim();
            if (out && out.toLowerCase() !== clean.toLowerCase()) return out;
          }
          if (Array.isArray(raw[0])) {
            const joined = raw[0].map(p => (Array.isArray(p) ? p[0] : p)).filter(Boolean).join('').trim();
            if (joined && joined.toLowerCase() !== clean.toLowerCase()) return joined;
          }
        }
      }
    } catch (e) {}
  }

  // Word-level fallback to local Oxford Master dictionary
  const lower = clean.toLowerCase();
  if (masterDict[lower]) {
    const firstDef = masterDict[lower].split(/[,;]+/)[0].trim();
    if (firstDef && firstDef.toLowerCase() !== lower) return firstDef;
  }

  return '';
}

/**
 * Multi-tier Polish Linguistics Provider:
 * 1. Tier 1 (Gold Standard): Diki.pl (Frequency-ranked, POS-matched, authentic examples)
 * 2. Tier 2 (Live Fallback): Google Translate dictionary breakdown (dt=bd)
 * 3. Tier 3 (Offline Fallback): Local Oxford master dictionary
 */
async function fetchPolishLinguistics(word, primaryDefEn, primaryExampleEn, posHint = '') {
  const cleanWord = String(word || '').toLowerCase().trim();
  const cleanWordNoEntity = cleanWord.replace(/&#x2122;/g, '™');
  const masterGloss = masterDict[cleanWord] || masterDict[cleanWordNoEntity] || '';

  // 1. Try Diki as PRIMARY Gold-Standard source
  const dikiData = await fetchDikiLinguistics(cleanWord, posHint);
  if (dikiData && dikiData.allMeanings && dikiData.allMeanings.length > 0) {
    let examplePl = '';
    // If Diki provided a great translated example and we don't have an authentic Oxford example or want Diki's
    if (dikiData.example && (!primaryExampleEn || primaryExampleEn.startsWith('This is an essential Oxford 3000'))) {
      examplePl = dikiData.example.pl;
    } else if (primaryExampleEn && !primaryExampleEn.startsWith('This is an essential Oxford 3000')) {
      // Translate the authentic Oxford example sentence
      examplePl = await translateToPolish(primaryExampleEn);
    }

    return {
      source: 'diki',
      definition_pl: dikiData.definition_pl,
      example_pl: examplePl || dikiData.example?.pl || '',
      polishSynonyms: dikiData.allMeanings,
      dikiSenses: dikiData.senses || [],
      dikiExample: dikiData.example
    };
  }

  // 2. Fallback to Google Live Dictionary & Translate if Diki has no entry
  let definitionPl = masterGloss;
  let examplePl = '';
  let polishSynonyms = masterGloss
    ? masterGloss.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 6)
    : [];

  const dictUrls = [
    `https://clients5.google.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=pl&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
    `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=en&tl=pl&dt=t&dt=bd&q=${encodeURIComponent(word)}`
  ];

  for (const urlWord of dictUrls) {
    try {
      const resWord = await fetch(urlWord, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(3000)
      });
      if (resWord.ok) {
        const data = await resWord.json();
        const mainTrans = data?.[0]?.[0]?.[0] || '';
        const dictTerms = [];
        if (Array.isArray(data?.[1])) {
          for (const posBlock of data[1]) {
            if (Array.isArray(posBlock?.[1])) {
              dictTerms.push(...posBlock[1].slice(0, 4));
            }
          }
        }
        const uniquePl = [...new Set([mainTrans, ...dictTerms].map(s => s?.toLowerCase()?.trim()).filter(Boolean))]
          .filter(s => s.toLowerCase() !== cleanWord);
        if (uniquePl.length > 0) {
          definitionPl = uniquePl.slice(0, 4).join(', ');
          polishSynonyms = uniquePl.slice(0, 6);
          break;
        }
      }
    } catch (e) {}
  }

  // Translate primary example sentence into natural Polish
  if (primaryExampleEn && !primaryExampleEn.startsWith('This is an essential Oxford 3000')) {
    examplePl = await translateToPolish(primaryExampleEn);
  }

  // Fallback if still missing definition
  if (!definitionPl || definitionPl.toLowerCase() === cleanWord) {
    definitionPl = (await translateToPolish(word)) || masterGloss || '';
    if (definitionPl.toLowerCase() === cleanWord) definitionPl = masterGloss || '';
    if (definitionPl && polishSynonyms.length === 0) {
      polishSynonyms = definitionPl.split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    }
  }

  // Last resort: translate primaryDefEn
  if (!definitionPl && primaryDefEn) {
    definitionPl = await translateToPolish(primaryDefEn);
  }

  return {
    source: 'google',
    definition_pl: definitionPl || masterGloss || '',
    example_pl: examplePl || '',
    polishSynonyms
  };
}

/**
 * 3. Fetch lexical network from Datamuse & Free Dictionary API (Synonyms, Antonyms, Collocations, Word Family)
 */
async function fetchLexicalGraph(word) {
  let synonyms = [];
  let antonyms = [];
  let collocations = [];
  let wordFamily = [];
  let fallbackDef = '';
  let fallbackExample = '';
  let fallbackPhonetic = '';
  let fallbackAudio = '';
  let fallbackOrigin = '';

  await Promise.allSettled([
    // Free Dictionary API
    (async () => {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) return;
      const data = await res.json();
      const entry = data?.[0];
      if (!entry) return;

      fallbackPhonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
      fallbackAudio = entry.phonetics?.find(p => p.audio)?.audio || '';
      if (entry.origin) fallbackOrigin = entry.origin;

      for (const m of entry.meanings || []) {
        if (Array.isArray(m.synonyms)) synonyms.push(...m.synonyms);
        if (Array.isArray(m.antonyms)) antonyms.push(...m.antonyms);
        for (const d of m.definitions || []) {
          if (!fallbackDef && d.definition) fallbackDef = d.definition;
          if (!fallbackExample && d.example) fallbackExample = d.example;
          if (Array.isArray(d.synonyms)) synonyms.push(...d.synonyms);
          if (Array.isArray(d.antonyms)) antonyms.push(...d.antonyms);
        }
      }
    })(),

    // Datamuse Synonyms & Related
    (async () => {
      const res = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=8`);
      if (res.ok) {
        const data = await res.json();
        synonyms.push(...data.map(d => d.word));
      }
    })(),

    // Datamuse Antonyms
    (async () => {
      const res = await fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=6`);
      if (res.ok) {
        const data = await res.json();
        antonyms.push(...data.map(d => d.word));
      }
    })(),

    // Datamuse Frequent followers / collocations (lc = left context)
    (async () => {
      const res = await fetch(`https://api.datamuse.com/words?lc=${encodeURIComponent(word)}&max=6`);
      if (res.ok) {
        const data = await res.json();
        collocations.push(
          ...data
            .map(d => d.word)
            .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'that'].includes(w))
            .map(w => `${word} ${w}`)
        );
      }
    })()
  ]);

  return {
    synonyms: [...new Set(synonyms)].slice(0, 8),
    antonyms: [...new Set(antonyms)].slice(0, 6),
    collocations: [...new Set(collocations)].slice(0, 6),
    wordFamily: [...new Set(wordFamily)].slice(0, 6),
    fallbackDef,
    fallbackExample,
    fallbackPhonetic,
    fallbackAudio,
    fallbackOrigin
  };
}

/**
 * 4. Deep Multidimensional Extraction from Oxford Learner's Dictionary
 */
async function fetchLiveOxfordEntry(word, targetUrl) {
  const urlsToTry = [
    targetUrl,
    `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word.toLowerCase())}_1`,
    `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word.toLowerCase())}`
  ].filter(Boolean);

  let html = '';
  let finalUrl = '';

  for (const url of [...new Set(urlsToTry)]) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow'
      });
      if (res.ok) {
        html = await res.text();
        finalUrl = res.url || url;
        if (html.includes('class="def"')) break;
      }
    } catch (e) {}
  }

  if (!html) return null;

  // Phonetics UK & US
  const phonBrMatch = html.match(/<div class="phons_br"[^>]*>[\s\S]*?<span class="phon">([\s\S]*?)<\/span>/);
  const phonUsMatch = html.match(/<div class="phons_n_am"[^>]*>[\s\S]*?<span class="phon">([\s\S]*?)<\/span>/);
  const phoneticUk = phonBrMatch ? cleanHtml(phonBrMatch[1]) : '';
  const phoneticUs = phonUsMatch ? cleanHtml(phonUsMatch[1]) : phoneticUk;

  // Audio MP3 UK & US
  const mp3UkMatch = html.match(
    /data-src-mp3="(https:\/\/www\.oxfordlearnersdictionaries\.com\/media\/english\/uk_pron\/[^"]+\.mp3)"/
  );
  const mp3UsMatch = html.match(
    /data-src-mp3="(https:\/\/www\.oxfordlearnersdictionaries\.com\/media\/english\/us_pron\/[^"]+\.mp3)"/
  );
  const audioUk = mp3UkMatch ? mp3UkMatch[1] : '';
  const audioUs = mp3UsMatch ? mp3UsMatch[1] : '';

  // Part of speech
  const posMatch = html.match(/<span class="pos"[^>]*>([\s\S]*?)<\/span>/);
  const pos = posMatch ? cleanHtml(posMatch[1]) : '';

  // Word Origin / Etymology
  const originMatch = html.match(
    /<span class="unbox"[^>]*unbox="wordorigin"[\s\S]*?<span class="body"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/
  );
  const wordOrigin = originMatch ? cleanHtml(originMatch[1]) : '';

  // Verb forms / inflections
  const verbForms = [...html.matchAll(/<td class="verb_form"[^>]*>([\s\S]*?)<\/td>/g)]
    .map(m => cleanHtml(m[1]))
    .filter(Boolean);

  // Extra examples
  const extraExamples = [
    ...html.matchAll(/<span class="unbox"[^>]*unbox="extra_examples"[\s\S]*?<ul class="examples"[^>]*>([\s\S]*?)<\/ul>/g)
  ]
    .flatMap(m => [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(li => cleanHtml(li[1])))
    .filter(Boolean)
    .slice(0, 8);

  // Extract Senses (before idioms block so idiom senses don't mix with core senses)
  const mainBodyHtml = html.split('<div class="idioms"')[0];
  const senseChunks = mainBodyHtml.split('<li class="sense"').slice(1);

  const senses = [];
  const allCollocations = [];
  let primaryTopic = '';
  let primaryGrammar = '';
  let primaryRegister = '';

  for (let i = 0; i < senseChunks.length; i++) {
    const rawChunk = senseChunks[i];
    // Cut off unbox extra_examples or wordorigin inside the sense so examples are clean
    const coreChunk = rawChunk.split('<span class="unbox"')[0];

    const cefr = coreChunk.match(/cefr="([^"]+)"/)?.[1]?.toUpperCase() || '';
    const defMatch = coreChunk.match(/<span class="def"[^>]*>([\s\S]*?)<\/span>/);
    if (!defMatch) continue;

    const definition = cleanHtml(defMatch[1]);
    if (!definition) continue;

    const grammar = cleanHtml(coreChunk.match(/<span class="grammar"[^>]*>([\s\S]*?)<\/span>/)?.[1] || '');
    const register = cleanHtml(coreChunk.match(/<span class="labels"[^>]*>([\s\S]*?)<\/span>/)?.[1] || '');
    const cfs = [...coreChunk.matchAll(/<span class="cf"[^>]*>([\s\S]*?)<\/span>/g)]
      .map(m => cleanHtml(m[1]))
      .filter(Boolean);
    const cls = [...coreChunk.matchAll(/<span class="cl"[^>]*>([\s\S]*?)<\/span>/g)]
      .map(m => cleanHtml(m[1]))
      .filter(Boolean);

    allCollocations.push(...cfs, ...cls);

    const examples = [];
    const ulExamplesMatch = coreChunk.match(/<ul class="examples"[^>]*>([\s\S]*?)<\/ul>/);
    if (ulExamplesMatch) {
      const liMatches = [...ulExamplesMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
      for (const li of liMatches) {
        const xMatch = li[1].match(/<span class="x"[^>]*>([\s\S]*?)<\/span>\s*(?:<\/li>|$)/) || [null, li[1]];
        const cleaned = cleanHtml(xMatch[1]);
        if (cleaned.length > 5) examples.push(cleaned);
      }
    }
    if (examples.length === 0) {
      const xMatches = [
        ...coreChunk.matchAll(
          /<span class="x"[^>]*>([\s\S]*?)<\/span>(?=\s*<\/li>|\s*<span class="labels"|\s*<span class="syn"|\s*<span class="gl"|\s*<\/span>)/g
        )
      ];
      for (const xm of xMatches) {
        const cleaned = cleanHtml(xm[1]);
        if (cleaned.length > 5) examples.push(cleaned);
      }
    }

    const topicMatch = coreChunk.match(/topic_name="([^"]+)"/);
    const topic = topicMatch ? cleanHtml(topicMatch[1]) : '';
    if (!primaryTopic && topic) primaryTopic = topic;
    if (!primaryGrammar && grammar) primaryGrammar = grammar;
    if (!primaryRegister && register) primaryRegister = register;

    senses.push({
      senseNumber: senses.length + 1,
      cefr: cefr || null,
      grammar: grammar || null,
      register: register || null,
      pattern: cfs[0] || null,
      topic: topic || null,
      definition,
      examples: examples.slice(0, 4)
    });
  }

  // Extract Idioms if present
  const idioms = [];
  const idiomsBlock = html.split('<div class="idioms"')[1];
  if (idiomsBlock) {
    const idmMatches = [
      ...idiomsBlock.matchAll(
        /<span class="idm"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="def"[^>]*>([\s\S]*?)<\/span>/g
      )
    ];
    for (const m of idmMatches.slice(0, 5)) {
      idioms.push({
        phrase: cleanHtml(m[1]),
        definition: cleanHtml(m[2])
      });
    }
  }

  // Extract Word Family / Related entries from nearby links or morphology
  const wordFamily = [
    ...new Set(
      [...html.matchAll(/<span class="xh"[^>]*>([\s\S]*?)<\/span>/g)]
        .map(m => cleanHtml(m[1]))
        .filter(Boolean)
    )
  ].slice(0, 8);

  return {
    oxford_url: finalUrl,
    phonetic: phoneticUk,
    phonetic_us: phoneticUs,
    audio_uk: audioUk,
    audio_us: audioUs,
    part_of_speech: pos,
    senses,
    word_origin: wordOrigin,
    verb_forms: verbForms,
    idioms,
    extra_examples: extraExamples,
    collocations: [...new Set(allCollocations)].filter(c => c.length > 2).slice(0, 10),
    word_family: wordFamily,
    oxford_category: primaryTopic ? `Oxford • ${primaryTopic}` : '',
    grammar_note: primaryGrammar,
    register_label: primaryRegister
  };
}

/**
 * 5. Build an automatic multidimensional memory hook / etymology note
 */
function buildAutonomousMemoryHook(word, oxData, lexicalData, plTranslation) {
  if (oxData?.word_origin) {
    return `Etymologia Oxford: ${oxData.word_origin}`;
  }
  if (lexicalData?.fallbackOrigin) {
    return `Pochodzenie: ${lexicalData.fallbackOrigin}`;
  }
  const topCollocation = oxData?.collocations?.[0] || lexicalData?.collocations?.[0];
  if (topCollocation) {
    return `Kluczowy wzorzec Oxford: "${topCollocation}" → ${plTranslation.split(',')[0]}.`;
  }
  return `Słowo z kanonu Oxford 3000™: zapamiętaj w kontekście "${word.toUpperCase()}" = ${plTranslation.split(',')[0]}.`;
}

// Persistent Prepared Statements (prevents V8 C++ handle allocation leaks)
const stmtWordById = db.prepare('SELECT * FROM words WHERE id = ?');
const stmtWordByLower = db.prepare('SELECT * FROM words WHERE LOWER(word) = LOWER(?)');
const stmtWordUpdate = db.prepare(`
  UPDATE words SET
    phonetic = ?,
    phonetic_us = ?,
    audio_uk = ?,
    audio_us = ?,
    oxford_url = ?,
    definition_en = ?,
    definition_pl = ?,
    example_en = ?,
    example_pl = ?,
    collocations = ?,
    synonyms = ?,
    antonyms = ?,
    oxford_category = ?,
    memory_hook = ?,
    senses_json = ?,
    word_origin = ?,
    word_family = ?,
    verb_forms = ?,
    idioms_json = ?,
    extra_examples = ?,
    grammar_note = ?,
    register_label = ?,
    enriched_at = ?
  WHERE id = ?
`);
const stmtPendingBatch = db.prepare(`
  SELECT id, word FROM words
  WHERE enriched_at = 0 OR senses_json = '[]' OR senses_json IS NULL
     OR definition_pl IS NULL OR definition_pl = '' OR LOWER(definition_pl) = LOWER(word)
     OR definition_pl LIKE 'Ładowanie%'
     OR example_en LIKE 'This is an essential Oxford 3000%'
     OR (example_en NOT LIKE 'This is an essential Oxford 3000%' AND (example_pl IS NULL OR example_pl = ''))
  ORDER BY RANDOM()
  LIMIT 1
`);

/**
 * 6. Enrich a single word row in SQLite with full multidimensional data from Oxford + Lexical + Polish APIs
 */
export async function enrichWordByIdOrText(identifier, forceRefresh = false) {
  const row =
    typeof identifier === 'number'
      ? stmtWordById.get(identifier)
      : stmtWordByLower.get(String(identifier).trim());

  if (!row) return null;

  // If already enriched and not forcing refresh, return immediately
  if (
    !forceRefresh &&
    row.enriched_at > 1 &&
    row.senses_json &&
    row.senses_json !== '[]' &&
    row.definition_pl &&
    row.definition_pl.toLowerCase() !== row.word.toLowerCase() &&
    !row.definition_pl.startsWith('Ładowanie') &&
    row.example_en &&
    !row.example_en.startsWith('This is an essential') &&
    row.example_pl &&
    row.example_pl.trim() !== ''
  ) {
    return formatWordRow(row);
  }

  const word = row.word;

  // Fetch Oxford live data and Lexical Graph in parallel
  const [oxData, lexicalData] = await Promise.all([
    fetchLiveOxfordEntry(word, row.oxford_url),
    fetchLexicalGraph(word)
  ]);

  const primarySense = oxData?.senses?.[0];
  const primaryDefEn =
    primarySense?.definition ||
    (row.definition_en && !row.definition_en.startsWith('Oxford 3000™ core') ? row.definition_en : '') ||
    lexicalData.fallbackDef ||
    `Core Oxford 3000™ ${row.part_of_speech}.`;

  const primaryExampleEn =
    primarySense?.examples?.[0] ||
    oxData?.extra_examples?.[0] ||
    (row.example_en && !row.example_en.startsWith('This is an essential') ? row.example_en : '') ||
    lexicalData.fallbackExample ||
    `The concept of ${word} plays an important role in everyday communication.`;

  // Fetch Polish translations (prioritizing Diki)
  const hasCuratedPl =
    row.definition_pl &&
    row.definition_pl !== 'Ładowanie z Oxford API...' &&
    !row.definition_pl.startsWith('Ładowanie') &&
    row.definition_pl.toLowerCase() !== word.toLowerCase();

  const exampleChanged = primaryExampleEn !== row.example_en;
  const plData = await fetchPolishLinguistics(
    word,
    primaryDefEn,
    primaryExampleEn,
    oxData?.part_of_speech || row.part_of_speech
  );

  // Also translate up to 4 top senses into Polish so each sense in Deep Dive has its own Polish meaning!
  const sensesToStore = oxData?.senses?.slice(0, 6) || [];
  if (sensesToStore.length > 0) {
    await Promise.allSettled(
      sensesToStore.slice(0, 4).map(async (sense, sIdx) => {
        try {
          if (!sense.definition_pl) {
            if (plData?.dikiSenses?.[sIdx]?.meanings?.length > 0) {
              sense.definition_pl = plData.dikiSenses[sIdx].meanings.slice(0, 3).join(', ');
            } else if (sense.definition) {
              sense.definition_pl = (await translateToPolish(sense.definition)) || '';
            }
          }
        } catch (e) {}
      })
    );
  } else {
    sensesToStore.push({
      senseNumber: 1,
      cefr: row.cefr_level,
      grammar: null,
      register: null,
      pattern: null,
      definition: primaryDefEn,
      definition_pl: plData.definition_pl || (hasCuratedPl ? row.definition_pl : ''),
      examples: [primaryExampleEn]
    });
  }

  const finalPhoneticUk = oxData?.phonetic || lexicalData.fallbackPhonetic || row.phonetic || `/${word}/`;
  const finalPhoneticUs = oxData?.phonetic_us || finalPhoneticUk;
  const finalAudioUk = oxData?.audio_uk || row.audio_uk || lexicalData.fallbackAudio || '';
  const finalAudioUs = oxData?.audio_us || row.audio_us || finalAudioUk;

  const existingCols = safeJsonParse(row.collocations, []);
  const mergedCollocations = [
    ...new Set([...(oxData?.collocations || []), ...existingCols, ...(lexicalData.collocations || [])])
  ].slice(0, 10);

  const existingSyns = safeJsonParse(row.synonyms, []);
  const mergedSynonyms = [...new Set([...existingSyns, ...(lexicalData.synonyms || [])])].slice(0, 8);

  const existingAnts = safeJsonParse(row.antonyms, []);
  const mergedAntonyms = [...new Set([...existingAnts, ...(lexicalData.antonyms || [])])].slice(0, 6);

  let finalDefinitionPl = (plData?.definition_pl && plData.definition_pl.toLowerCase() !== word.toLowerCase())
    ? plData.definition_pl
    : (hasCuratedPl ? row.definition_pl : masterDict[word.toLowerCase()] || '');
  if (!finalDefinitionPl || finalDefinitionPl.toLowerCase() === word.toLowerCase() || finalDefinitionPl.startsWith('Ładowanie')) {
    finalDefinitionPl = masterDict[word.toLowerCase()] || '';
  }

  let finalExamplePl = plData.example_pl;
  if (!finalExamplePl && !primaryExampleEn.startsWith('This is an essential')) {
    finalExamplePl = await translateToPolish(primaryExampleEn);
  }
  if (!finalExamplePl && !exampleChanged && row.example_pl) {
    finalExamplePl = row.example_pl;
  }

  const translationFailed = !finalDefinitionPl || finalDefinitionPl.toLowerCase() === word.toLowerCase() || finalDefinitionPl.startsWith('Ładowanie');
  const finalCategory =
    oxData?.oxford_category ||
    (row.oxford_category && !row.oxford_category.startsWith('Oxford 3000 •')
      ? row.oxford_category
      : `Oxford 3000 • ${row.cefr_level}`);

  const finalMemoryHook =
    row.memory_hook || buildAutonomousMemoryHook(word, oxData, lexicalData, finalDefinitionPl);

  const now = Date.now();

  stmtWordUpdate.run(
    finalPhoneticUk,
    finalPhoneticUs,
    finalAudioUk,
    finalAudioUs,
    oxData?.oxford_url || row.oxford_url || '',
    capitalizeFirst(primaryDefEn),
    finalDefinitionPl,
    primaryExampleEn,
    finalExamplePl,
    JSON.stringify(mergedCollocations),
    JSON.stringify(mergedSynonyms),
    JSON.stringify(mergedAntonyms),
    finalCategory,
    finalMemoryHook,
    JSON.stringify(sensesToStore),
    oxData?.word_origin || lexicalData.fallbackOrigin || '',
    JSON.stringify(oxData?.word_family || []),
    JSON.stringify(oxData?.verb_forms || []),
    JSON.stringify(oxData?.idioms || []),
    JSON.stringify(oxData?.extra_examples || []),
    oxData?.grammar_note || '',
    oxData?.register_label || '',
    translationFailed ? 1 : now,
    row.id
  );

  workerStats.lastEnrichedWord = word;
  const updatedRow = stmtWordById.get(row.id);
  return formatWordRow(updatedRow);
}

/**
 * 7. Lookup & Auto-Create ANY English word on demand if searched by user
 */
export async function lookupOrEnrichWord(rawWord, forceRefresh = false) {
  const clean = String(rawWord || '').trim().toLowerCase();
  if (!clean) return null;

  const existing = db.prepare('SELECT * FROM words WHERE LOWER(word) = ?').get(clean);
  if (existing) {
    return await enrichWordByIdOrText(existing.id, forceRefresh);
  }

  // Not in DB yet: insert stub and immediately enrich from Oxford API
  const stubPl = masterDict[clean] || masterDict[clean.replace(/&#x2122;/g, '™')] || 'Ładowanie...';
  const insertStmt = db.prepare(`
    INSERT INTO words (
      word, phonetic, cefr_level, part_of_speech,
      definition_en, definition_pl, example_en, example_pl,
      collocations, synonyms, antonyms, oxford_category, memory_hook, frequency_rank, enriched_at
    ) VALUES (?, ?, 'B2', 'word', 'Loading...', ?, '', '', '[]', '[]', '[]', 'Oxford Live Lookup', '', 2500, 0)
  `);
  const info = insertStmt.run(clean, `/${clean}/`, stubPl);
  const newId = Number(info.lastInsertRowid);

  db.prepare(`
    INSERT OR IGNORE INTO user_progress (word_id, state, repetitions, interval_days, ease_factor, next_review, streak_count, is_favorite)
    VALUES (?, 'new', 0, 0, 2.5, 0, 0, 0)
  `).run(newId);

  return await enrichWordByIdOrText(newId, forceRefresh);
}

const customDropWordsPath = path.join(dataDir, 'custom_words.txt');

/**
 * Autonomous Drop-File Watcher:
 * If the user drops or adds words into `data/custom_words.txt` (newline or comma separated)
 * or `data/custom_words.json`, the engine automatically ingests them into SQLite without any UI button!
 */
export function ingestCustomDropFiles() {
  try {
    const wordsToIngest = [];

    if (fs.existsSync(customDropWordsPath)) {
      const raw = fs.readFileSync(customDropWordsPath, 'utf-8');
      const parsed = raw
        .split(/[\r\n,;]+/)
        .map(w => w.trim())
        .filter(w => w.length > 1 && !w.startsWith('#'));
      wordsToIngest.push(...parsed);
    }

    const customJsonPath = path.join(dataDir, 'custom_words.json');
    if (fs.existsSync(customJsonPath)) {
      const parsedJson = JSON.parse(fs.readFileSync(customJsonPath, 'utf-8'));
      if (Array.isArray(parsedJson)) {
        for (const item of parsedJson) {
          if (typeof item === 'string' && item.trim()) {
            wordsToIngest.push(item.trim());
          } else if (item && item.word) {
            wordsToIngest.push(String(item.word).trim());
          }
        }
      }
    }

    if (wordsToIngest.length > 0) {
      const insertCustom = db.prepare(`
        INSERT OR IGNORE INTO words (
          word, phonetic, cefr_level, part_of_speech,
          definition_en, definition_pl, example_en, example_pl,
          collocations, synonyms, antonyms, oxford_category, memory_hook, frequency_rank, enriched_at
        ) VALUES (?, ?, 'B2', 'word', 'Oxford 3000™ core word.', 'Ładowanie z Oxford API...', '', '', '[]', '[]', '[]', 'Oxford Custom', '', 3000, 0)
      `);

      db.exec('BEGIN TRANSACTION');
      try {
        for (const w of wordsToIngest) {
          insertCustom.run(w, `/${w.toLowerCase()}/`);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
      }
    }
  } catch (e) {
    // silent
  }
}

/**
 * 8. Autonomous Background Enrichment Worker
 * Continuously enriches un-enriched words (whether 3,000, 5,000, or 10,000+) in the background without blocking the server.
 */
export function startAutonomousOxfordWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  // Safely check for any custom drop files periodically (avoids Windows fs.watch locks on SQLite WAL files)
  try {
    ingestCustomDropFiles();
    setInterval(ingestCustomDropFiles, 30000);
  } catch (e) {}

  const runNextBatch = async () => {
    try {
      workerStats.isSyncing = true;
      const pending = stmtPendingBatch.all();

      if (pending.length === 0 || !translationAvailable()) {
        workerStats.isSyncing = false;
        setTimeout(runNextBatch, 30000);
        return;
      }

      await enrichWordByIdOrText(pending[0].id);
    } catch (e) {
      // ignore transient network errors
    } finally {
      workerStats.isSyncing = false;
      setTimeout(runNextBatch, 8000);
    }
  };

  setTimeout(runNextBatch, 1500);
}

const stmtCountTotal = db.prepare('SELECT COUNT(*) as c FROM words');
const stmtCountEnriched = db.prepare('SELECT COUNT(*) as c FROM words WHERE enriched_at > 0');
const stmtCountDeep = db.prepare("SELECT COUNT(*) as c FROM words WHERE senses_json IS NOT NULL AND senses_json != '[]'");

export function getOxfordEngineStatus() {
  const total = stmtCountTotal.get().c;
  const enriched = stmtCountEnriched.get().c;
  const deepEnriched = stmtCountDeep.get().c;
  return {
    totalCatalog: total,
    enrichedCount: enriched,
    deepEnrichedCount: deepEnriched,
    lastEnrichedWord: workerStats.lastEnrichedWord,
    isSyncing: workerStats.isSyncing
  };
}

export function safeJsonParse(str, fallback = []) {
  if (!str) return fallback;
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

function capitalizeFirst(s = '') {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatWordRow(row) {
  if (!row) return null;
  return {
    ...row,
    collocations: safeJsonParse(row.collocations, []),
    synonyms: safeJsonParse(row.synonyms, []),
    antonyms: safeJsonParse(row.antonyms, []),
    senses: safeJsonParse(row.senses_json, []),
    word_family: safeJsonParse(row.word_family, []),
    verb_forms: safeJsonParse(row.verb_forms, []),
    idioms: safeJsonParse(row.idioms_json, []),
    extra_examples: safeJsonParse(row.extra_examples, [])
  };
}
