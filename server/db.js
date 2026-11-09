import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwdDbPath = path.join(process.cwd(), 'data', 'oxford.db');
const relDbPath = path.join(__dirname, '..', 'data', 'oxford.db');
const originalDbPath = fs.existsSync(cwdDbPath) ? cwdDbPath : relDbPath;
const originalDataDir = path.dirname(originalDbPath);

let effectiveDbPath = originalDbPath;

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

// Local SQLite instance
export const db = new DatabaseSync(effectiveDbPath);

try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA cache_size = -32000;');
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA mmap_size = 268435456;');
} catch (e) {
  try {
    db.exec('PRAGMA journal_mode = MEMORY;');
    db.exec('PRAGMA busy_timeout = 5000;');
  } catch (e2) {}
}

// Safe migrations for local SQLite tables
try {
  db.exec('ALTER TABLE user_profile ADD COLUMN user_id INTEGER DEFAULT 1');
} catch (e) {}
try {
  db.exec('ALTER TABLE user_progress ADD COLUMN user_id INTEGER DEFAULT 1');
} catch (e) {}
try {
  db.exec('ALTER TABLE review_logs ADD COLUMN user_id INTEGER DEFAULT 1');
} catch (e) {}

// Local schema initialization & migrations
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

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE COLLATE NOCASE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      user_id INTEGER PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak_days INTEGER DEFAULT 1,
      last_active_date TEXT,
      words_studied_today INTEGER DEFAULT 0,
      daily_goal INTEGER DEFAULT 20
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER NOT NULL DEFAULT 1,
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      state TEXT DEFAULT 'new',
      repetitions INTEGER DEFAULT 0,
      interval_days REAL DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      next_review INTEGER DEFAULT 0,
      last_review INTEGER DEFAULT 0,
      last_rating INTEGER DEFAULT 0,
      total_reviews INTEGER DEFAULT 0,
      streak_count INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, word_id)
    );

    CREATE INDEX IF NOT EXISTS idx_progress_user_next ON user_progress(user_id, next_review);
    CREATE INDEX IF NOT EXISTS idx_progress_user_state ON user_progress(user_id, state);
    CREATE INDEX IF NOT EXISTS idx_progress_user_fav ON user_progress(user_id, is_favorite);

    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      word_id INTEGER,
      rating INTEGER,
      ease_factor REAL,
      interval_days REAL,
      timestamp INTEGER
    );
  `);
} catch (err) {
  // Silent fallback
}

// Add columns to words if missing
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
  } catch (e) {}
}

// Initialize Turso Cloud DB client (with guaranteed production fallback)
const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://english-tok-bsc1.aws-eu-central-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTQyNjM3MjMsImlkIjoiMDFhMWMyNzMtNjQwMS03NWFjLWJlZWItMzA1YjAxMDMwNTg3Iiwia2lkIjoiS2NiMXpvUU5fN3ZTM2dQSUVoTWl2eEhva1hfTjJUNjMyLU9DWURvcTctMCIsInJpZCI6IjA5MDdmYjVkLWJkOTYtNGMyZS1hZmUwLTEyNzg1NmE0OTIwZiJ9.MlxKEXtH36H79ZL2FZsXM_8B_u83BxoLim8T35i89cLd2pflQs02CrB9jnGSkRy7kAlhPbGkE8mbESRn0qcyDA';

export const cloudDb = (TURSO_URL && TURSO_TOKEN)
  ? createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN
    })
  : null;

if (cloudDb) {
  console.log(`[DB] ⚡ Connected to Turso Cloud DB: ${TURSO_URL}`);
} else {
  console.log('[DB] Running with local SQLite database.');
}

export function isCloudActive() {
  return Boolean(cloudDb);
}

/**
 * Execute query on Turso (or fallback to local SQLite) and return array of objects
 */
export async function cloudAll(sql, args = []) {
  if (cloudDb) {
    try {
      const res = await cloudDb.execute({ sql, args });
      return res.rows || [];
    } catch (err) {
      console.error('[Turso cloudAll error]', err.message);
      throw err;
    }
  }

  // Fallback to local
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...args);
  } catch (err) {
    console.error('[Local SQLite cloudAll error]', err.message);
    return [];
  }
}

/**
 * Execute query on Turso (or fallback to local SQLite) and return single object or null
 */
export async function cloudGet(sql, args = []) {
  if (cloudDb) {
    try {
      const res = await cloudDb.execute({ sql, args });
      return res.rows && res.rows.length > 0 ? res.rows[0] : null;
    } catch (err) {
      console.error('[Turso cloudGet error]', err.message);
      throw err;
    }
  }

  // Fallback to local
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...args) || null;
  } catch (err) {
    console.error('[Local SQLite cloudGet error]', err.message);
    return null;
  }
}

/**
 * Execute INSERT/UPDATE/DELETE on Turso and optionally local SQLite
 */
export async function cloudRun(sql, args = []) {
  let cloudResult = { rowsAffected: 0, lastInsertRowid: null };

  if (cloudDb) {
    try {
      const res = await cloudDb.execute({ sql, args });
      cloudResult = {
        rowsAffected: res.rowsAffected,
        lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : null
      };
    } catch (err) {
      console.error('[Turso cloudRun error]', err.message);
      throw err;
    }
  }

  // Also sync to local SQLite so offline backup stays consistent
  try {
    const stmt = db.prepare(sql);
    const localRes = stmt.run(...args);
    if (!cloudDb) {
      return {
        rowsAffected: localRes.changes,
        lastInsertRowid: localRes.lastInsertRowid
      };
    }
  } catch (err) {
    if (!cloudDb) {
      throw err;
    }
  }

  return cloudResult;
}

export default db;
