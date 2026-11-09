import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwdDbPath = path.join(process.cwd(), 'data', 'oxford.db');
const relDbPath = path.join(__dirname, '..', 'data', 'oxford.db');
const originalDbPath = fs.existsSync(cwdDbPath) ? cwdDbPath : relDbPath;

let effectiveDbPath = originalDbPath;

// In Vercel or AWS Lambda, root directory is read-only.
// We safely mirror oxford.db to /tmp on cold start so that SQLite reads & writes work seamlessly.
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const tmpDir = '/tmp';
  const tmpDbPath = path.join(tmpDir, 'oxford.db');
  try {
    if (!fs.existsSync(tmpDbPath)) {
      if (fs.existsSync(originalDbPath)) {
        console.log('[DB] Synchronizing Oxford lexicon to serverless /tmp...');
        fs.copyFileSync(originalDbPath, tmpDbPath);
        console.log('[DB] Oxford 3000 SQLite database loaded into /tmp');
      }
    }
    effectiveDbPath = tmpDbPath;
  } catch (err) {
    console.warn('[DB] Serverless storage notice:', err.message);
  }
} else {
  if (!fs.existsSync(originalDataDir)) {
    fs.mkdirSync(originalDataDir, { recursive: true });
  }
}

const db = new DatabaseSync(effectiveDbPath);

// Enable WAL mode for high performance concurrency (with MEMORY fallback)
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch (e) {
  try {
    db.exec('PRAGMA journal_mode = MEMORY;');
  } catch (e2) {}
}

// Initialize schema
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      phonetic TEXT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_words_cefr ON words(cefr_level);
    CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
  `);
} catch (err) {
  console.warn('[DB] Schema init warning:', err.message);
}

// Safe multidimensional schema migrations for Oxford 3000 Autonomous Engine
const newColumns = [
  ['phonetic_us', 'TEXT DEFAULT ""'],
  ['audio_uk', 'TEXT DEFAULT ""'],
  ['audio_us', 'TEXT DEFAULT ""'],
  ['oxford_url', 'TEXT DEFAULT ""'],
  ['senses_json', 'TEXT DEFAULT "[]"'],
  ['word_origin', 'TEXT DEFAULT ""'],
  ['word_family', 'TEXT DEFAULT "[]"'],
  ['verb_forms', 'TEXT DEFAULT "[]"'],
  ['idioms_json', 'TEXT DEFAULT "[]"'],
  ['extra_examples', 'TEXT DEFAULT "[]"'],
  ['grammar_note', 'TEXT DEFAULT ""'],
  ['register_label', 'TEXT DEFAULT ""'],
  ['enriched_at', 'INTEGER DEFAULT 0']
];

for (const [colName, colDef] of newColumns) {
  try {
    db.exec(`ALTER TABLE words ADD COLUMN ${colName} ${colDef}`);
  } catch (e) {
    // Column already exists
  }
}

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_words_enriched ON words(enriched_at);

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

    CREATE INDEX IF NOT EXISTS idx_progress_next_review ON user_progress(next_review);
    CREATE INDEX IF NOT EXISTS idx_progress_state ON user_progress(state);

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak_days INTEGER DEFAULT 1,
      last_active_date TEXT,
      words_studied_today INTEGER DEFAULT 0,
      daily_goal INTEGER DEFAULT 20
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER,
      rating INTEGER,
      ease_factor REAL,
      interval_days REAL,
      timestamp INTEGER
    );
  `);
} catch (err) {
  console.warn('[DB] Table creation warning:', err.message);
}

// Initialize default user profile if not present
try {
  const profileStmt = db.prepare('SELECT id FROM user_profile WHERE id = 1');
  const existingProfile = profileStmt.get();
  if (!existingProfile) {
    const todayStr = new Date().toISOString().split('T')[0];
    const initProfile = db.prepare(`
      INSERT INTO user_profile (id, xp, level, streak_days, last_active_date, words_studied_today, daily_goal)
      VALUES (1, 120, 1, 3, ?, 5, 20)
    `);
    initProfile.run(todayStr);
  }
} catch (err) {
  console.warn('[DB] User profile init warning:', err.message);
}

export default db;
