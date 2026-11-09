import { Router } from 'express';
import db from './db.js';
import { calculateNextReview, formatInterval, getLevelInfo } from './srs.js';
import {
  enrichWordByIdOrText,
  lookupOrEnrichWord,
  getOxfordEngineStatus,
  formatWordRow
} from './oxfordEngine.js';

const router = Router();

// Helper to check and maintain daily streaks
function updateDailyStreak(profile) {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastActive = profile.last_active_date;
  let newStreak = profile.streak_days;
  let newStudiedToday = profile.words_studied_today;

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

// GET /api/feed - TikTok smart dopamine feed with autonomous Oxford 3000 enrichment
router.get('/feed', async (req, res) => {
  try {
    const { filter = 'all', limit = 30, offset = 0 } = req.query;
    const now = Date.now();
    const numLimit = Math.min(60, Math.max(5, Number(limit) || 30));
    const numOffset = Math.max(0, Number(offset) || 0);

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
      LEFT JOIN user_progress p ON w.id = p.word_id
    `;

    const params = [];

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
      // Pure random exploration across all Oxford words, prioritizing real Oxford sentences
      query += ` ORDER BY CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END, RANDOM() LIMIT ?`;
      params.push(numLimit);
    } else {
      // Randomized TikTok Feed: prioritizes fully enriched cards with authentic Oxford sentences & Polish translations
      query += `
        ORDER BY 
          CASE WHEN ${isEnrichedFilter} THEN 0 ELSE 1 END ASC,
          RANDOM()
        LIMIT ?
      `;
      params.push(numLimit);
    }

    const stmt = db.prepare(query);
    let rows = stmt.all(...params);

    // Autonomously enrich un-enriched cards synchronously so the user never sees a stub card
    const unEnriched = rows.filter(
      r =>
        !r.enriched_at ||
        r.enriched_at <= 1 ||
        !r.definition_pl ||
        r.definition_pl.toLowerCase() === String(r.word).toLowerCase() ||
        r.definition_pl.startsWith('Ładowanie') ||
        !r.example_en ||
        r.example_en.startsWith('This is an essential Oxford 3000') ||
        !r.example_pl ||
        r.example_pl.trim() === ''
    );

    if (unEnriched.length > 0) {
      const immediateBatch = unEnriched.slice(0, 3);
      await Promise.allSettled(immediateBatch.map(r => enrichWordByIdOrText(r.id)));

      // Refresh rows from DB after immediate enrichment
      const ids = rows.map(r => r.id);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const refreshed = db
          .prepare(`
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
            LEFT JOIN user_progress p ON w.id = p.word_id
            WHERE w.id IN (${placeholders})
          `)
          .all(...ids);

        const byId = new Map(refreshed.map(r => [r.id, r]));
        rows = ids.map(id => byId.get(id)).filter(Boolean);
      }

      // Queue remaining un-enriched in background
      const backgroundBatch = unEnriched.slice(3, 12);
      if (backgroundBatch.length > 0) {
        setImmediate(async () => {
          for (const item of backgroundBatch) {
            try {
              await enrichWordByIdOrText(item.id);
            } catch (e) {}
          }
        });
      }
    }

    const words = rows.map(row => attachSrsPreview(row, now));
    const engineStatus = getOxfordEngineStatus();

    res.json({
      success: true,
      count: words.length,
      words,
      engineStatus
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/oxford/enrich/:wordOrId - On-demand autonomous multidimensional Oxford API enrichment
router.get('/oxford/enrich/:wordOrId', async (req, res) => {
  try {
    const { wordOrId } = req.params;
    const isNum = /^\d+$/.test(wordOrId);
    const enriched = isNum
      ? await enrichWordByIdOrText(Number(wordOrId))
      : await lookupOrEnrichWord(wordOrId);

    if (!enriched) {
      return res.status(404).json({ success: false, error: 'Word not found in Oxford API' });
    }

    // Attach user_progress
    const prog = db
      .prepare('SELECT * FROM user_progress WHERE word_id = ?')
      .get(enriched.id) || {
      state: 'new',
      repetitions: 0,
      interval_days: 0,
      ease_factor: 2.5,
      next_review: 0,
      streak_count: 0,
      is_favorite: 0
    };

    const fullWord = attachSrsPreview({ ...enriched, ...prog });
    res.json({ success: true, word: fullWord });
  } catch (error) {
    console.error('Error enriching word:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/oxford/status - Live status of the Oxford 3000 autonomous engine
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
router.get('/db/status', (req, res) => {
  try {
    const totalWords = db.prepare('SELECT COUNT(*) as c FROM words').get()?.c || 0;
    const enrichedWords = db.prepare('SELECT COUNT(*) as c FROM words WHERE enriched_at > 0').get()?.c || 0;
    const hasTurso = Boolean(process.env.TURSO_DATABASE_URL);
    res.json({
      success: true,
      mode: hasTurso ? 'cloud-turso' : (process.env.VERCEL ? 'vercel-embedded-sqlite' : 'local-sqlite'),
      totalWords,
      enrichedWords,
      cloudConfigured: hasTurso,
      platform: process.env.VERCEL ? 'Vercel Serverless' : 'Node Server',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/review - Process SM-2 Spaced Repetition card rating
router.post('/review', (req, res) => {
  try {
    const { word_id, rating } = req.body;
    if (!word_id || !rating || rating < 1 || rating > 4) {
      return res.status(400).json({ success: false, error: 'Valid word_id and rating (1-4) required' });
    }

    const progStmt = db.prepare('SELECT * FROM user_progress WHERE word_id = ?');
    let currentProg = progStmt.get(word_id);
    if (!currentProg) {
      currentProg = {
        word_id,
        state: 'new',
        repetitions: 0,
        interval_days: 0,
        ease_factor: 2.5,
        streak_count: 0,
        total_reviews: 0
      };
    }

    const calculation = calculateNextReview(currentProg, rating);

    const updateProg = db.prepare(`
      INSERT INTO user_progress (
        word_id, state, repetitions, interval_days, ease_factor,
        next_review, last_review, last_rating, total_reviews, streak_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(word_id) DO UPDATE SET
        state = excluded.state,
        repetitions = excluded.repetitions,
        interval_days = excluded.interval_days,
        ease_factor = excluded.ease_factor,
        next_review = excluded.next_review,
        last_review = excluded.last_review,
        last_rating = excluded.last_rating,
        total_reviews = excluded.total_reviews,
        streak_count = excluded.streak_count
    `);

    updateProg.run(
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
    );

    const logStmt = db.prepare(`
      INSERT INTO review_logs (word_id, rating, ease_factor, interval_days, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    logStmt.run(word_id, rating, calculation.ease_factor, calculation.interval_days, calculation.last_review);

    const profStmt = db.prepare('SELECT * FROM user_profile WHERE id = 1');
    const profile = profStmt.get();
    const { todayStr, newStreak, newStudiedToday } = updateDailyStreak(profile);

    const updatedXp = profile.xp + calculation.xpGain;
    const updatedStudied = newStudiedToday + 1;
    const levelInfo = getLevelInfo(updatedXp);

    const updateProfile = db.prepare(`
      UPDATE user_profile
      SET xp = ?, level = ?, streak_days = ?, last_active_date = ?, words_studied_today = ?
      WHERE id = 1
    `);
    updateProfile.run(updatedXp, levelInfo.level, newStreak, todayStr, updatedStudied);

    res.json({
      success: true,
      updatedProgress: calculation,
      xpGained: calculation.xpGain,
      userStats: {
        xp: updatedXp,
        level: levelInfo.level,
        streak_days: newStreak,
        words_studied_today: updatedStudied,
        daily_goal: profile.daily_goal
      },
      levelInfo
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/toggle-favorite - Star/bookmark a word
router.post('/toggle-favorite', (req, res) => {
  try {
    const { word_id } = req.body;
    if (!word_id) return res.status(400).json({ success: false, error: 'word_id required' });

    const getProg = db.prepare('SELECT is_favorite FROM user_progress WHERE word_id = ?');
    const row = getProg.get(word_id);
    const newFavorite = row && row.is_favorite ? 0 : 1;

    const setFav = db.prepare(`
      INSERT INTO user_progress (word_id, is_favorite) VALUES (?, ?)
      ON CONFLICT(word_id) DO UPDATE SET is_favorite = excluded.is_favorite
    `);
    setFav.run(word_id, newFavorite);

    res.json({ success: true, is_favorite: newFavorite });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/stats - Global progress statistics & profile
router.get('/stats', (req, res) => {
  try {
    const now = Date.now();
    const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get();
    const levelInfo = getLevelInfo(profile.xp);

    const srsCounts = db.prepare(`
      SELECT 
        COUNT(CASE WHEN p.state = 'new' OR p.state IS NULL THEN 1 END) as new_words,
        COUNT(CASE WHEN p.state = 'learning' THEN 1 END) as learning,
        COUNT(CASE WHEN p.state = 'review' THEN 1 END) as review,
        COUNT(CASE WHEN p.state = 'mastered' THEN 1 END) as mastered,
        COUNT(CASE WHEN p.is_favorite = 1 THEN 1 END) as favorites,
        COUNT(CASE WHEN p.next_review > 0 AND p.next_review <= ? THEN 1 END) as due_reviews,
        COUNT(*) as total_words
      FROM words w
      LEFT JOIN user_progress p ON w.id = p.word_id
    `).get(now);

    const cefrCounts = db.prepare(`
      SELECT 
        w.cefr_level,
        COUNT(*) as total,
        COUNT(CASE WHEN p.state = 'mastered' THEN 1 END) as mastered,
        COUNT(CASE WHEN p.state IN ('learning', 'review', 'mastered') THEN 1 END) as in_progress
      FROM words w
      LEFT JOIN user_progress p ON w.id = p.word_id
      GROUP BY w.cefr_level
      ORDER BY w.cefr_level ASC
    `).all();

    res.json({
      success: true,
      profile: {
        ...profile,
        ...levelInfo
      },
      srs: srsCounts,
      cefr: cefrCounts,
      oxfordEngine: getOxfordEngineStatus()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/quiz-question - Instant dopamine multiple choice quiz (uses enriched words)
router.get('/quiz-question', async (req, res) => {
  try {
    let target = db
      .prepare(
        "SELECT * FROM words WHERE enriched_at > 0 AND definition_pl != 'Ładowanie z Oxford API...' ORDER BY RANDOM() LIMIT 1"
      )
      .get();

    if (!target) {
      target = db.prepare('SELECT * FROM words ORDER BY RANDOM() LIMIT 1').get();
      if (target) {
        target = await enrichWordByIdOrText(target.id);
      }
    }

    if (!target) return res.status(404).json({ success: false, error: 'No words found' });

    const distractors = db
      .prepare(`
        SELECT definition_pl FROM words 
        WHERE id != ? AND enriched_at > 0 AND definition_pl != 'Ładowanie z Oxford API...'
        ORDER BY RANDOM() LIMIT 3
      `)
      .all(target.id);

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

// GET /api/words - Search and browse all 3000+ Oxford words + live lookup
router.get('/words', async (req, res) => {
  try {
    const { q = '', cefr = '', limit = 60 } = req.query;
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
      LEFT JOIN user_progress p ON w.id = p.word_id
      WHERE 1=1
    `;
    const params = [];

    if (cleanQ) {
      query += ` AND (w.word LIKE ? OR w.definition_pl LIKE ? OR w.definition_en LIKE ?)`;
      params.push(`%${cleanQ}%`, `%${cleanQ}%`, `%${cleanQ}%`);
    }

    if (cefr) {
      query += ` AND w.cefr_level = ?`;
      params.push(cefr);
    }

    query += `
      ORDER BY 
        CASE WHEN LOWER(w.word) = LOWER(?) THEN 0
             WHEN LOWER(w.word) LIKE LOWER(?) THEN 1
             ELSE 2 END,
        w.word ASC
      LIMIT ?
    `;
    params.push(cleanQ, `${cleanQ}%`, Number(limit) || 60);

    let rows = db.prepare(query).all(...params);

    // If user searched for a specific English word and no exact match exists, fetch live from Oxford API!
    if (cleanQ && /^[a-zA-Z\-]+$/.test(cleanQ) && !rows.some(r => r.word.toLowerCase() === cleanQ.toLowerCase())) {
      const liveWord = await lookupOrEnrichWord(cleanQ);
      if (liveWord) {
        rows = [liveWord, ...rows];
      }
    }

    const words = rows.map(r => attachSrsPreview(r));
    res.json({ success: true, count: words.length, words });
  } catch (error) {
    console.error('Error searching words:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/oxford/ingest - Silent autonomous bulk ingestion endpoint (accepts array of words or text)
router.post('/oxford/ingest', async (req, res) => {
  try {
    const { words = [] } = req.body;
    const list = Array.isArray(words)
      ? words
      : String(words || '')
          .split(/[\r\n,;]+/)
          .map(w => w.trim())
          .filter(Boolean);

    if (list.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide words array or text' });
    }

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO words (
        word, phonetic, cefr_level, part_of_speech,
        definition_en, definition_pl, example_en, example_pl,
        collocations, synonyms, antonyms, oxford_category, memory_hook, frequency_rank, enriched_at
      ) VALUES (?, ?, 'B2', 'word', 'Oxford core word.', 'Ładowanie z Oxford API...', '', '', '[]', '[]', '[]', 'Oxford Custom', '', 3000, 0)
    `);

    let inserted = 0;
    db.exec('BEGIN TRANSACTION');
    try {
      for (const raw of list) {
        const clean = String(raw).trim();
        if (clean.length > 1) {
          const info = insertStmt.run(clean, `/${clean.toLowerCase()}/`);
          if (info.changes > 0) inserted++;
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const total = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
    res.json({ success: true, submitted: list.length, inserted, totalCatalog: total });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/reset - Reset SRS progress without losing the Oxford words
router.post('/reset', (req, res) => {
  try {
    db.exec(`
      UPDATE user_progress SET
        state = 'new',
        repetitions = 0,
        interval_days = 0,
        ease_factor = 2.5,
        next_review = 0,
        last_review = 0,
        last_rating = 0,
        total_reviews = 0,
        streak_count = 0
    `);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
