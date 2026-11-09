import { Router } from 'express';
import db, { cloudAll, cloudGet, cloudRun, isCloudActive } from './db.js';
import { calculateNextReview, formatInterval, getLevelInfo } from './srs.js';
import {
  enrichWordByIdOrText,
  lookupOrEnrichWord,
  getOxfordEngineStatus,
  formatWordRow
} from './oxfordEngine.js';
import {
  hashPassword,
  verifyPassword,
  createToken,
  authMiddleware
} from './auth.js';

const router = Router();

// Apply auth middleware to all /api routes
router.use(authMiddleware);

// Fast in-memory LRU cache for enriched dictionary entries (sub-millisecond lookups)
const enrichedCache = new Map();
const MAX_ENRICHED_CACHE = 500;

function getCachedEnriched(key) {
  return enrichedCache.get(String(key).toLowerCase());
}

function setCachedEnriched(key, value) {
  if (enrichedCache.size >= MAX_ENRICHED_CACHE) {
    const firstKey = enrichedCache.keys().next().value;
    enrichedCache.delete(firstKey);
  }
  enrichedCache.set(String(key).toLowerCase(), value);
}

// Helper to check and maintain daily streaks
function updateDailyStreak(profile) {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastActive = profile?.last_active_date;
  let newStreak = profile?.streak_days || 1;
  let newStudiedToday = profile?.words_studied_today || 0;

  if (lastActive !== todayStr) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (lastActive === yesterday) {
      newStreak += 1;
    } else if (lastActive) {
      newStreak = 1;
    }
    newStudiedToday = 0;
  }

  return { todayStr, newStreak, newStudiedToday };
}

// Helper to attach SRS preview intervals to a formatted word object
function attachSrsPreview(row, now = Date.now()) {
  const formatted = formatWordRow(row);
  const isDue = formatted.next_review > 0 && formatted.next_review <= now;

  const prevProgress = {
    repetitions: formatted.repetitions || 0,
    interval_days: formatted.interval_days || 0,
    ease_factor: formatted.ease_factor || 2.5,
    streak_count: formatted.streak_count || 0
  };

  return {
    ...formatted,
    is_due: isDue,
    intervals: {
      again: calculateNextReview(prevProgress, 1).intervalDisplay,
      hard: calculateNextReview(prevProgress, 2).intervalDisplay,
      good: calculateNextReview(prevProgress, 3).intervalDisplay,
      easy: calculateNextReview(prevProgress, 4).intervalDisplay
    }
  };
}

// Helper to get or initialize a user profile from Turso
async function ensureUserProfile(userId) {
  let profile = await cloudGet('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
  if (!profile) {
    const todayStr = new Date().toISOString().split('T')[0];
    await cloudRun(
      `INSERT OR REPLACE INTO user_profile (user_id, xp, level, streak_days, last_active_date, words_studied_today, daily_goal)
       VALUES (?, 0, 1, 1, ?, 0, 20)`,
      [userId, todayStr]
    );
    profile = await cloudGet('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
  }
  return profile || {
    user_id: userId,
    xp: 0,
    level: 1,
    streak_days: 1,
    last_active_date: new Date().toISOString().split('T')[0],
    words_studied_today: 0,
    daily_goal: 20
  };
}

// =========================================================================
// AUTHENTICATION ROUTES (Online Turso Cloud DB)
// =========================================================================

// POST /api/auth/register - Create a new user account in Turso online
router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const cleanUser = String(username || '').trim();
    const cleanPass = String(password || '');

    if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 25) {
      return res.status(400).json({
        success: false,
        error: 'Nazwa użytkownika musi mieć od 3 do 25 znaków.'
      });
    }

    if (!/^[a-zA-Z0-9_\-]+$/.test(cleanUser)) {
      return res.status(400).json({
        success: false,
        error: 'Nazwa użytkownika może zawierać tylko litery, cyfry, myślnik i podkreślnik.'
      });
    }

    if (!cleanPass || cleanPass.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Hasło musi mieć co najmniej 4 znaki.'
      });
    }

    // Check if user already exists in Turso
    const existing = await cloudGet('SELECT id FROM users WHERE username = ? COLLATE NOCASE', [cleanUser]);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Taka nazwa użytkownika jest już zajęta.'
      });
    }

    const passwordHash = hashPassword(cleanPass);
    await cloudRun(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [cleanUser, passwordHash]
    );

    const newUser = await cloudGet('SELECT id, username, created_at FROM users WHERE username = ? COLLATE NOCASE', [cleanUser]);
    const todayStr = new Date().toISOString().split('T')[0];

    await cloudRun(
      `INSERT INTO user_profile (user_id, xp, level, streak_days, last_active_date, words_studied_today, daily_goal)
       VALUES (?, 50, 1, 1, ?, 0, 20)`,
      [newUser.id, todayStr]
    );

    const profile = await ensureUserProfile(newUser.id);
    const token = createToken({ userId: newUser.id, username: newUser.username });

    res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username
      },
      profile: {
        ...profile,
        ...getLevelInfo(profile.xp)
      }
    });
  } catch (error) {
    console.error('Error in auth register:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/login - Log into existing account from Turso online
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const cleanUser = String(username || '').trim();
    const cleanPass = String(password || '');

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({ success: false, error: 'Podaj nazwę użytkownika i hasło.' });
    }

    const user = await cloudGet('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [cleanUser]);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
    }

    const isValid = verifyPassword(cleanPass, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
    }

    const profile = await ensureUserProfile(user.id);
    const token = createToken({ userId: user.id, username: user.username });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username
      },
      profile: {
        ...profile,
        ...getLevelInfo(profile.xp)
      }
    });
  } catch (error) {
    console.error('Error in auth login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/me - Get currently authenticated user profile
router.get('/auth/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await ensureUserProfile(userId);
    const levelInfo = getLevelInfo(profile.xp);

    res.json({
      success: true,
      isGuest: req.user.isGuest,
      user: {
        id: req.user.id,
        username: req.user.username
      },
      profile: {
        ...profile,
        ...levelInfo
      }
    });
  } catch (error) {
    console.error('Error in auth me:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/logout - Logout confirmation
router.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Wylogowano pomyślnie' });
});

// =========================================================================
// FEED & LEARNING ROUTES
// =========================================================================

// GET /api/feed - TikTok smart dopamine feed connected to Turso online
router.get('/feed', async (req, res) => {
  try {
    const { filter = 'all', limit = 30 } = req.query;
    const now = Date.now();
    const numLimit = Math.min(60, Math.max(5, Number(limit) || 30));
    const userId = req.user.id;

    let query = `
      SELECT 
        w.*,
        COALESCE(p.state, 'new') as state,
        COALESCE(p.repetitions, 0) as repetitions,
        COALESCE(p.interval_days, 0) as interval_days,
        COALESCE(p.ease_factor, 2.5) as ease_factor,
        COALESCE(p.next_review, 0) as next_review,
        COALESCE(p.last_review, 0) as last_review,
        COALESCE(p.last_rating, 0) as last_rating,
        COALESCE(p.streak_count, 0) as streak_count,
        COALESCE(p.is_favorite, 0) as is_favorite
      FROM words w
      LEFT JOIN user_progress p ON (w.id = p.word_id AND p.user_id = ?)
    `;

    const params = [userId];

    const isEnrichedFilter = `
      (w.enriched_at > 1 
       AND w.definition_pl IS NOT NULL 
       AND w.definition_pl <> '' 
       AND LOWER(trim(w.definition_pl)) <> LOWER(trim(w.word)) 
       AND w.definition_pl NOT LIKE 'Ładowanie%' 
       AND w.example_en NOT LIKE 'This is an essential Oxford 3000%' 
       AND w.example_pl IS NOT NULL 
       AND w.example_pl <> '')
    `;

    if (filter === 'due') {
      query += ` WHERE p.state IN ('learning', 'review') AND p.next_review <= ? ORDER BY CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END, RANDOM() LIMIT ?`;
      params.push(now, numLimit);
    } else if (filter === 'favorites') {
      query += ` WHERE p.is_favorite = 1 ORDER BY CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END, RANDOM() LIMIT ?`;
      params.push(numLimit);
    } else if (filter === 'a1_a2') {
      query += ` WHERE w.cefr_level IN ('A1', 'A2') ORDER BY CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END, RANDOM() LIMIT ?`;
      params.push(numLimit);
    } else if (filter === 'b1_b2') {
      query += ` WHERE w.cefr_level IN ('B1', 'B2', 'C1') ORDER BY CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END, RANDOM() LIMIT ?`;
      params.push(numLimit);
    } else if (filter === 'mastered') {
      query += ` WHERE p.state = 'mastered' ORDER BY CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END, RANDOM() LIMIT ?`;
      params.push(numLimit);
    } else if (filter === 'explore') {
      query += ` ORDER BY CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END, RANDOM() LIMIT ?`;
      params.push(numLimit);
    } else {
      query += `
        ORDER BY 
          CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END ASC,
          RANDOM()
        LIMIT ?
      `;
      params.push(numLimit);
    }

    let rows = await cloudAll(query, params);

    // If initial query gave empty list (e.g. no favorites/due), fallback safely
    if (rows.length === 0 && (filter === 'due' || filter === 'favorites' || filter === 'mastered')) {
      const fallbackRows = await cloudAll(
        `SELECT w.*,
                COALESCE(p.state, 'new') as state,
                COALESCE(p.repetitions, 0) as repetitions,
                COALESCE(p.interval_days, 0) as interval_days,
                COALESCE(p.ease_factor, 2.5) as ease_factor,
                COALESCE(p.next_review, 0) as next_review,
                COALESCE(p.streak_count, 0) as streak_count,
                COALESCE(p.is_favorite, 0) as is_favorite
         FROM words w
         LEFT JOIN user_progress p ON (w.id = p.word_id AND p.user_id = ?)
         ORDER BY RANDOM() LIMIT ?`,
        [userId, numLimit]
      );
      rows = fallbackRows;
    }

    const words = rows.map(row => attachSrsPreview(row, now));
    const engineStatus = getOxfordEngineStatus();

    res.json({
      success: true,
      count: words.length,
      words,
      engineStatus,
      cloudConnected: isCloudActive()
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/oxford/enrich/:wordOrId - On-demand Oxford API enrichment
router.get('/oxford/enrich/:wordOrId', async (req, res) => {
  try {
    const { wordOrId } = req.params;
    const userId = req.user.id;
    let enriched = getCachedEnriched(wordOrId);

    if (!enriched) {
      const isNum = /^\d+$/.test(wordOrId);
      enriched = isNum
        ? await enrichWordByIdOrText(Number(wordOrId))
        : await lookupOrEnrichWord(wordOrId);

      if (enriched) {
        setCachedEnriched(wordOrId, enriched);
        if (enriched.id) setCachedEnriched(enriched.id, enriched);
        if (enriched.word) setCachedEnriched(enriched.word, enriched);
      }
    }

    if (!enriched) {
      return res.status(404).json({ success: false, error: 'Word not found in Oxford API' });
    }

    // Attach user_progress for current user
    const prog = (await cloudGet('SELECT * FROM user_progress WHERE user_id = ? AND word_id = ?', [userId, enriched.id])) || {
      state: 'new',
      repetitions: 0,
      interval_days: 0,
      ease_factor: 2.5,
      next_review: 0,
      streak_count: 0,
      is_favorite: 0
    };

    const fullWord = attachSrsPreview({ ...enriched, ...prog });
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.json({ success: true, word: fullWord });
  } catch (error) {
    console.error('Error enriching word:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/oxford/status - Status of Oxford autonomous engine
router.get('/oxford/status', (req, res) => {
  try {
    res.json({
      success: true,
      status: getOxfordEngineStatus()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/db/status - Database architecture and connectivity health check
router.get('/db/status', async (req, res) => {
  try {
    const countRow = await cloudGet('SELECT COUNT(*) as c FROM words');
    const totalWords = countRow?.c || 0;
    const enrichedRow = await cloudGet('SELECT COUNT(*) as c FROM words WHERE enriched_at > 0');
    const enrichedWords = enrichedRow?.c || 0;
    const userCountRow = await cloudGet('SELECT COUNT(*) as c FROM users');
    const totalUsers = userCountRow?.c || 0;

    res.json({
      success: true,
      mode: isCloudActive() ? 'cloud-turso' : (process.env.VERCEL ? 'vercel-embedded-sqlite' : 'local-sqlite'),
      totalWords,
      enrichedWords,
      totalUsers,
      cloudConfigured: isCloudActive(),
      tursoUrl: process.env.TURSO_DATABASE_URL ? 'Connected' : 'Not configured',
      currentUser: req.user,
      platform: process.env.VERCEL ? 'Vercel Serverless' : 'Node Server',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/review - Process SM-2 Spaced Repetition card rating in Turso online
router.post('/review', async (req, res) => {
  try {
    const { word_id, rating } = req.body || {};
    const userId = req.user.id;

    if (!word_id || !rating || rating < 1 || rating > 4) {
      return res.status(400).json({ success: false, error: 'Valid word_id and rating (1-4) required' });
    }

    let currentProg = await cloudGet(
      'SELECT * FROM user_progress WHERE user_id = ? AND word_id = ?',
      [userId, word_id]
    );

    if (!currentProg) {
      currentProg = {
        word_id,
        user_id: userId,
        state: 'new',
        repetitions: 0,
        interval_days: 0,
        ease_factor: 2.5,
        streak_count: 0,
        total_reviews: 0
      };
    }

    const calculation = calculateNextReview(currentProg, rating);

    // Save to user_progress in Turso online
    await cloudRun(`
      INSERT INTO user_progress (
        user_id, word_id, state, repetitions, interval_days, ease_factor,
        next_review, last_review, last_rating, total_reviews, streak_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        state = excluded.state,
        repetitions = excluded.repetitions,
        interval_days = excluded.interval_days,
        ease_factor = excluded.ease_factor,
        next_review = excluded.next_review,
        last_review = excluded.last_review,
        last_rating = excluded.last_rating,
        total_reviews = excluded.total_reviews,
        streak_count = excluded.streak_count
    `, [
      userId,
      word_id,
      calculation.state,
      calculation.repetitions,
      calculation.interval_days,
      calculation.ease_factor,
      calculation.next_review,
      calculation.last_review,
      calculation.last_rating,
      calculation.total_reviews,
      calculation.streak_count
    ]);

    // Save review log in Turso online
    await cloudRun(`
      INSERT INTO review_logs (user_id, word_id, rating, ease_factor, interval_days, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, word_id, rating, calculation.ease_factor, calculation.interval_days, calculation.last_review]);

    // Update user profile in Turso online
    const profile = await ensureUserProfile(userId);
    const { todayStr, newStreak, newStudiedToday } = updateDailyStreak(profile);

    const updatedXp = (profile.xp || 0) + calculation.xpGain;
    const updatedStudied = newStudiedToday + 1;
    const levelInfo = getLevelInfo(updatedXp);

    await cloudRun(`
      UPDATE user_profile
      SET xp = ?, level = ?, streak_days = ?, last_active_date = ?, words_studied_today = ?
      WHERE user_id = ?
    `, [updatedXp, levelInfo.level, newStreak, todayStr, updatedStudied, userId]);

    res.json({
      success: true,
      updatedProgress: calculation,
      xpGained: calculation.xpGain,
      userStats: {
        xp: updatedXp,
        level: levelInfo.level,
        streak_days: newStreak,
        words_studied_today: updatedStudied,
        daily_goal: profile.daily_goal || 20
      },
      levelInfo
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/toggle-favorite - Star/bookmark a word in Turso online
router.post('/toggle-favorite', async (req, res) => {
  try {
    const { word_id, force } = req.body || {};
    const userId = req.user.id;

    if (!word_id) return res.status(400).json({ success: false, error: 'word_id required' });

    const row = await cloudGet(
      'SELECT is_favorite FROM user_progress WHERE user_id = ? AND word_id = ?',
      [userId, word_id]
    );

    const newFavorite = typeof force === 'boolean'
      ? (force ? 1 : 0)
      : (row && row.is_favorite ? 0 : 1);

    await cloudRun(`
      INSERT INTO user_progress (user_id, word_id, is_favorite) VALUES (?, ?, ?)
      ON CONFLICT(user_id, word_id) DO UPDATE SET is_favorite = excluded.is_favorite
    `, [userId, word_id, newFavorite]);

    res.json({ success: true, is_favorite: newFavorite });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/stats - Global progress statistics & profile from Turso online
router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    const userId = req.user.id;
    const profile = await ensureUserProfile(userId);
    const levelInfo = getLevelInfo(profile.xp);

    const srsCounts = await cloudGet(`
      SELECT 
        COUNT(CASE WHEN p.state = 'new' OR p.state IS NULL THEN 1 END) as new_words,
        COUNT(CASE WHEN p.state = 'learning' THEN 1 END) as learning,
        COUNT(CASE WHEN p.state = 'review' THEN 1 END) as review,
        COUNT(CASE WHEN p.state = 'mastered' THEN 1 END) as mastered,
        COUNT(CASE WHEN p.is_favorite = 1 THEN 1 END) as favorites,
        COUNT(CASE WHEN p.next_review > 0 AND p.next_review <= ? THEN 1 END) as due_reviews,
        COUNT(*) as total_words
      FROM words w
      LEFT JOIN user_progress p ON (w.id = p.word_id AND p.user_id = ?)
    `, [now, userId]);

    const cefrCounts = await cloudAll(`
      SELECT 
        w.cefr_level,
        COUNT(*) as total,
        COUNT(CASE WHEN p.state = 'mastered' THEN 1 END) as mastered,
        COUNT(CASE WHEN p.state IN ('learning', 'review', 'mastered') THEN 1 END) as in_progress
      FROM words w
      LEFT JOIN user_progress p ON (w.id = p.word_id AND p.user_id = ?)
      GROUP BY w.cefr_level
      ORDER BY w.cefr_level ASC
    `, [userId]);

    res.json({
      success: true,
      profile: {
        ...profile,
        ...levelInfo
      },
      srs: srsCounts || {
        new_words: 4979,
        learning: 0,
        review: 0,
        mastered: 0,
        favorites: 0,
        due_reviews: 0,
        total_words: 4979
      },
      cefr: cefrCounts || [],
      oxfordEngine: getOxfordEngineStatus(),
      isOnlineDb: isCloudActive()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/quiz-question - Instant dopamine multiple choice quiz
router.get('/quiz-question', async (req, res) => {
  try {
    let target = await cloudGet(
      "SELECT * FROM words WHERE enriched_at > 0 AND definition_pl != 'Ładowanie z Oxford API...' ORDER BY RANDOM() LIMIT 1"
    );

    if (!target) {
      target = await cloudGet('SELECT * FROM words ORDER BY RANDOM() LIMIT 1');
      if (target) {
        target = await enrichWordByIdOrText(target.id);
      }
    }

    if (!target) return res.status(404).json({ success: false, error: 'No words found' });

    const distractors = await cloudAll(`
      SELECT definition_pl FROM words 
      WHERE id != ? AND enriched_at > 0 AND definition_pl != 'Ładowanie z Oxford API...'
      ORDER BY RANDOM() LIMIT 3
    `, [target.id]);

    const options = [
      { text: target.definition_pl, isCorrect: true },
      ...distractors.map(d => ({ text: d.definition_pl, isCorrect: false }))
    ].sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      question: {
        word_id: target.id,
        word: target.word,
        phonetic: target.phonetic,
        part_of_speech: target.part_of_speech,
        cefr_level: target.cefr_level,
        definition_en: target.definition_en,
        example_en: (target.example_en || '').replace(
          new RegExp(`\\b${target.word}\\w*\\b`, 'gi'),
          '_______'
        ),
        options
      }
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/words - Search and browse words with user progress overlay
router.get('/words', async (req, res) => {
  try {
    const { q = '', cefr = '', limit = 60 } = req.query;
    const userId = req.user.id;
    const cleanQ = String(q).trim();

    let query = `
      SELECT 
        w.*,
        COALESCE(p.state, 'new') as state,
        COALESCE(p.repetitions, 0) as repetitions,
        COALESCE(p.interval_days, 0) as interval_days,
        COALESCE(p.ease_factor, 2.5) as ease_factor,
        COALESCE(p.next_review, 0) as next_review,
        COALESCE(p.streak_count, 0) as streak_count,
        COALESCE(p.is_favorite, 0) as is_favorite
      FROM words w
      LEFT JOIN user_progress p ON (w.id = p.word_id AND p.user_id = ?)
      WHERE 1=1
    `;
    const params = [userId];

    if (cleanQ) {
      query += ` AND (w.word LIKE ? OR w.definition_pl LIKE ? OR w.definition_en LIKE ?)`;
      params.push(`%${cleanQ}%`, `%${cleanQ}%`, `%${cleanQ}%`);
    }

    if (cefr) {
      query += ` AND w.cefr_level = ?`;
      params.push(cefr);
    }

    if (cleanQ) {
      query += `
        ORDER BY 
          CASE WHEN LOWER(w.word) = LOWER(?) THEN 0
               WHEN LOWER(w.word) LIKE LOWER(?) THEN 1
               ELSE 2 END,
          w.word ASC
        LIMIT ?
      `;
      params.push(cleanQ, `${cleanQ}%`, Number(limit) || 60);
    } else {
      query += ` ORDER BY w.word ASC LIMIT ?`;
      params.push(Number(limit) || 60);
    }

    let rows = await cloudAll(query, params);

    // If live search word not in database, lookup
    if (cleanQ && /^[a-zA-Z\-]+$/.test(cleanQ) && !rows.some(r => r.word.toLowerCase() === cleanQ.toLowerCase())) {
      const liveWord = await lookupOrEnrichWord(cleanQ);
      if (liveWord) {
        rows = [liveWord, ...rows];
      }
    }

    const words = rows.map(r => attachSrsPreview(r));
    res.set('Cache-Control', 'private, max-age=60');
    res.json({ success: true, count: words.length, words });
  } catch (error) {
    console.error('Error searching words:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/reset - Reset SRS progress for the authenticated user only
router.post('/reset', async (req, res) => {
  try {
    const userId = req.user.id;
    await cloudRun('DELETE FROM user_progress WHERE user_id = ?', [userId]);
    await cloudRun('DELETE FROM review_logs WHERE user_id = ?', [userId]);
    await cloudRun(
      'UPDATE user_profile SET xp = 0, level = 1, words_studied_today = 0, streak_days = 1 WHERE user_id = ?',
      [userId]
    );

    res.json({ success: true, message: 'Postęp użytkownika został zresetowany.' });
  } catch (error) {
    console.error('Error resetting progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
