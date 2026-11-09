import { createClient } from '@libsql/client';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const localDbPath = path.join(rootDir, 'data', 'oxford.db');

const url = process.env.TURSO_DATABASE_URL || process.argv[2];
const authToken = process.env.TURSO_AUTH_TOKEN || process.argv[3];

console.log('='.repeat(70));
console.log('🚀 OXFORD-TOK: TURSO CLOUD DATABASE MIGRATION & SEEDING ENGINE');
console.log('='.repeat(70));

if (!url) {
  console.log(`
ℹ️  JAK UTWORZYĆ DARMOWĄ BAZĘ DANYCH TURSO DLA SŁÓWEK (100% ZA DARMO, 9GB):
----------------------------------------------------------------------
1. Wejdź na https://turso.tech i zaloguj się przez GitHub (darmowe konto, 9GB pamięci, 500 baz).
2. Zainstaluj CLI lub stwórz bazę przez panel WWW:
   - Wpisz nazwę bazy, np: oxford-words
   - Kliknij "Create Database"
3. Pobierz:
   - Database URL: np. libsql://oxford-words-username.turso.io
   - Auth Token: wygenerowany w zakładce "Tokens" (turso db tokens create oxford-words)
4. Uruchom tę migrację wpisując:
   node scripts/seed-cloud-db.js "twoj-turso-url" "twoj-auth-token"
   LUB dodaj te zmienne do pliku .env:
   TURSO_DATABASE_URL=libsql://...
   TURSO_AUTH_TOKEN=eyJ...
----------------------------------------------------------------------
`);
  process.exit(0);
}

if (!fs.existsSync(localDbPath)) {
  console.error(`❌ Nie znaleziono lokalnej bazy: ${localDbPath}`);
  process.exit(1);
}

const localDb = new DatabaseSync(localDbPath);
const cloudDb = createClient({ url, authToken });

async function migrate() {
  console.log(`📡 Łączenie z chmurową bazą danych: ${url}...`);

  // 1. Inicjalizacja schematu tabel w chmurze
  console.log('📐 Tworzenie schematu tabel i indeksów...');

  await cloudDb.execute(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      phonetic TEXT,
      phonetic_us TEXT DEFAULT '',
      audio_uk TEXT DEFAULT '',
      audio_us TEXT DEFAULT '',
      cefr_level TEXT NOT NULL,
      part_of_speech TEXT NOT NULL,
      definition_en TEXT NOT NULL,
      definition_pl TEXT NOT NULL,
      example_en TEXT NOT NULL,
      example_pl TEXT NOT NULL,
      collocations TEXT,
      synonyms TEXT,
      antonyms TEXT,
      oxford_category TEXT,
      memory_hook TEXT,
      frequency_rank INTEGER DEFAULT 1000,
      oxford_url TEXT DEFAULT '',
      senses_json TEXT DEFAULT '[]',
      word_origin TEXT DEFAULT '',
      word_family TEXT DEFAULT '[]',
      verb_forms TEXT DEFAULT '[]',
      idioms_json TEXT DEFAULT '[]',
      extra_examples TEXT DEFAULT '[]',
      grammar_note TEXT DEFAULT '',
      register_label TEXT DEFAULT '',
      enriched_at INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_words_cefr ON words(cefr_level);`);
  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);`);
  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_words_enriched ON words(enriched_at);`);

  await cloudDb.execute(`
    CREATE TABLE IF NOT EXISTS user_progress (
      word_id INTEGER PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
      state TEXT DEFAULT 'new',
      repetitions INTEGER DEFAULT 0,
      interval_days REAL DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      next_review INTEGER DEFAULT 0,
      last_review INTEGER DEFAULT 0,
      last_rating INTEGER DEFAULT 0,
      total_reviews INTEGER DEFAULT 0,
      streak_count INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0
    );
  `);

  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_progress_next_review ON user_progress(next_review);`);
  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_progress_state ON user_progress(state);`);

  await cloudDb.execute(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak_days INTEGER DEFAULT 1,
      last_active_date TEXT,
      words_studied_today INTEGER DEFAULT 0,
      daily_goal INTEGER DEFAULT 20
    );
  `);

  await cloudDb.execute(`
    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER,
      rating INTEGER,
      ease_factor REAL,
      interval_days REAL,
      timestamp INTEGER
    );
  `);

  console.log('✅ Tabele chmurowe gotowe.');

  // 2. Pobranie wszystkich słówek z lokalnej bazy
  const allWords = localDb.prepare('SELECT * FROM words').all();
  console.log(`📦 Wczytano ${allWords.length} słówek z lokalnej bazy.`);

  // 3. Wrzucanie w paczkach po 50 do Turso
  const batchSize = 50;
  let inserted = 0;
  const startTime = Date.now();

  for (let i = 0; i < allWords.length; i += batchSize) {
    const chunk = allWords.slice(i, i + batchSize);
    const statements = chunk.map(w => ({
      sql: `
        INSERT INTO words (
          id, word, phonetic, phonetic_us, audio_uk, audio_us,
          cefr_level, part_of_speech, definition_en, definition_pl,
          example_en, example_pl, collocations, synonyms, antonyms,
          oxford_category, memory_hook, frequency_rank, oxford_url,
          senses_json, word_origin, word_family, verb_forms, idioms_json,
          extra_examples, grammar_note, register_label, enriched_at, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
        ON CONFLICT(word) DO UPDATE SET
          phonetic = excluded.phonetic,
          phonetic_us = excluded.phonetic_us,
          audio_uk = excluded.audio_uk,
          audio_us = excluded.audio_us,
          cefr_level = excluded.cefr_level,
          part_of_speech = excluded.part_of_speech,
          definition_en = excluded.definition_en,
          definition_pl = excluded.definition_pl,
          example_en = excluded.example_en,
          example_pl = excluded.example_pl,
          collocations = excluded.collocations,
          synonyms = excluded.synonyms,
          antonyms = excluded.antonyms,
          oxford_category = excluded.oxford_category,
          memory_hook = excluded.memory_hook,
          frequency_rank = excluded.frequency_rank,
          oxford_url = excluded.oxford_url,
          senses_json = excluded.senses_json,
          word_origin = excluded.word_origin,
          word_family = excluded.word_family,
          verb_forms = excluded.verb_forms,
          idioms_json = excluded.idioms_json,
          extra_examples = excluded.extra_examples,
          grammar_note = excluded.grammar_note,
          register_label = excluded.register_label,
          enriched_at = excluded.enriched_at
      `,
      args: [
        w.id, w.word, w.phonetic || '', w.phonetic_us || '', w.audio_uk || '', w.audio_us || '',
        w.cefr_level, w.part_of_speech, w.definition_en, w.definition_pl,
        w.example_en, w.example_pl, w.collocations || '', w.synonyms || '', w.antonyms || '',
        w.oxford_category || '', w.memory_hook || '', w.frequency_rank || 1000, w.oxford_url || '',
        w.senses_json || '[]', w.word_origin || '', w.word_family || '[]', w.verb_forms || '[]',
        w.idioms_json || '[]', w.extra_examples || '[]', w.grammar_note || '', w.register_label || '',
        w.enriched_at || 0, w.created_at || new Date().toISOString()
      ]
    }));

    await cloudDb.batch(statements, 'write');
    inserted += chunk.length;
    process.stdout.write(`\r⏳ Przesyłanie do chmury: ${inserted}/${allWords.length} słówek (${Math.round((inserted / allWords.length) * 100)}%)...`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n🎉 SUKCES! Przesłano ${inserted} słówek do chmury Turso w ${duration}s!`);

  // Weryfikacja
  const countRes = await cloudDb.execute('SELECT COUNT(*) as c FROM words');
  console.log(`📊 Liczba słówek w chmurze: ${countRes.rows[0].c}`);
}

migrate().catch(err => {
  console.error('\n❌ Błąd podczas migracji:', err.message);
  process.exit(1);
});
