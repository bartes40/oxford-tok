import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env');
  process.exit(1);
}

const cloudDb = createClient({ url, authToken });

async function initOnlineAuthDb() {
  console.log('⚡ Initializing Multi-User & Online Auth Tables in Turso...');

  await cloudDb.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE COLLATE NOCASE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await cloudDb.execute(`DROP TABLE IF EXISTS user_profile;`);

  await cloudDb.execute(`
    CREATE TABLE user_profile (
      user_id INTEGER PRIMARY KEY,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak_days INTEGER DEFAULT 1,
      last_active_date TEXT,
      words_studied_today INTEGER DEFAULT 0,
      daily_goal INTEGER DEFAULT 20
    );
  `);

  await cloudDb.execute(`DROP TABLE IF EXISTS user_progress;`);

  await cloudDb.execute(`
    CREATE TABLE user_progress (
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
  `);

  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_progress_user_next ON user_progress(user_id, next_review);`);
  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_progress_user_state ON user_progress(user_id, state);`);
  await cloudDb.execute(`CREATE INDEX IF NOT EXISTS idx_progress_user_fav ON user_progress(user_id, is_favorite);`);

  await cloudDb.execute(`DROP TABLE IF EXISTS review_logs;`);

  await cloudDb.execute(`
    CREATE TABLE review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      word_id INTEGER,
      rating INTEGER,
      ease_factor REAL,
      interval_days REAL,
      timestamp INTEGER
    );
  `);

  // Create default guest user (id=1) if not exists
  const existingUser = await cloudDb.execute({
    sql: 'SELECT id FROM users WHERE id = 1',
    args: []
  });

  if (existingUser.rows.length === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('guest', salt, 64).toString('hex');
    const guestPasswordHash = `${salt}:${hash}`;

    await cloudDb.execute({
      sql: 'INSERT INTO users (id, username, password_hash) VALUES (1, ?, ?)',
      args: ['guest', guestPasswordHash]
    });

    console.log('✅ Default guest user initialized');
  }

  // Ensure profile for user 1
  const todayStr = new Date().toISOString().split('T')[0];
  await cloudDb.execute({
    sql: `INSERT OR REPLACE INTO user_profile (user_id, xp, level, streak_days, last_active_date, words_studied_today, daily_goal)
          VALUES (1, 100, 1, 1, ?, 0, 20)`,
    args: [todayStr]
  });

  console.log('🎉 Turso online tables ready: users, user_profile, user_progress, review_logs, words!');
}

initOnlineAuthDb().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
