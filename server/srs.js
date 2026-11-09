/**
 * SM-2 Spaced Repetition Algorithm & Gamified XP Calculator
 */

export function calculateNextReview(currentProgress, rating) {
  // rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
  const now = Date.now();
  let {
    repetitions = 0,
    interval_days = 0,
    ease_factor = 2.5,
    streak_count = 0,
    total_reviews = 0
  } = currentProgress || {};

  ease_factor = Math.max(1.3, ease_factor);
  let nextIntervalDays = 0;
  let nextReviewMs = now;
  let newState = 'learning';

  if (rating === 1) {
    // Again: immediate fail, re-appear soon in session (~60 seconds)
    repetitions = 0;
    nextIntervalDays = 1 / (24 * 60); // 1 minute
    nextReviewMs = now + 60 * 1000;
    ease_factor = Math.max(1.3, ease_factor - 0.2);
    streak_count = 0;
    newState = 'learning';
  } else if (rating === 2) {
    // Hard: difficult recall
    if (repetitions === 0) {
      nextIntervalDays = 0.5; // 12 hours
    } else {
      nextIntervalDays = Math.max(1, interval_days * 1.2);
    }
    nextReviewMs = now + Math.round(nextIntervalDays * 24 * 60 * 60 * 1000);
    ease_factor = Math.max(1.3, ease_factor - 0.15);
    repetitions += 1;
    streak_count += 1;
    newState = 'learning';
  } else if (rating === 3) {
    // Good: correct recall
    if (repetitions === 0) {
      nextIntervalDays = 1;
    } else if (repetitions === 1) {
      nextIntervalDays = 3;
    } else {
      nextIntervalDays = Math.round(interval_days * ease_factor * 10) / 10;
    }
    nextReviewMs = now + Math.round(nextIntervalDays * 24 * 60 * 60 * 1000);
    repetitions += 1;
    streak_count += 1;
    newState = repetitions >= 3 ? 'review' : 'learning';
    if (repetitions >= 5 && nextIntervalDays >= 21) {
      newState = 'mastered';
    }
  } else if (rating === 4) {
    // Easy: instant recall
    if (repetitions === 0) {
      nextIntervalDays = 2.5;
    } else if (repetitions === 1) {
      nextIntervalDays = 6;
    } else {
      nextIntervalDays = Math.round(interval_days * ease_factor * 1.35 * 10) / 10;
    }
    nextReviewMs = now + Math.round(nextIntervalDays * 24 * 60 * 60 * 1000);
    ease_factor = Math.min(3.2, ease_factor + 0.15);
    repetitions += 1;
    streak_count += 1;
    newState = repetitions >= 2 ? 'review' : 'learning';
    if (repetitions >= 4 && nextIntervalDays >= 14) {
      newState = 'mastered';
    }
  }

  // Calculate XP gained
  let xpGain = 0;
  if (rating === 1) xpGain = 5;
  else if (rating === 2) xpGain = 12;
  else if (rating === 3) xpGain = 22;
  else if (rating === 4) xpGain = 35;

  // Streak bonus
  if (streak_count > 0 && streak_count % 5 === 0) {
    xpGain += 25; // Milestone bonus!
  }

  return {
    repetitions,
    interval_days: nextIntervalDays,
    ease_factor: Math.round(ease_factor * 100) / 100,
    next_review: nextReviewMs,
    last_review: now,
    last_rating: rating,
    total_reviews: (total_reviews || 0) + 1,
    streak_count,
    state: newState,
    xpGain,
    intervalDisplay: formatInterval(nextIntervalDays)
  };
}

export function formatInterval(days) {
  if (days < 1 / 24) {
    const mins = Math.max(1, Math.round(days * 24 * 60));
    return `${mins}m`;
  }
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  if (days < 30) {
    const d = Math.round(days);
    return `${d}d`;
  }
  const months = Math.round((days / 30) * 10) / 10;
  return `${months}mo`;
}

export function getLevelInfo(totalXp) {
  const levels = [
    { level: 1, name: 'Word Spark', minXp: 0, maxXp: 150 },
    { level: 2, name: 'Vocab Novice', minXp: 150, maxXp: 400 },
    { level: 3, name: 'Oxford Explorer', minXp: 400, maxXp: 850 },
    { level: 4, name: 'Memory Crafter', minXp: 850, maxXp: 1500 },
    { level: 5, name: 'Lexical Beast', minXp: 1500, maxXp: 2500 },
    { level: 6, name: 'Fluency Titan', minXp: 2500, maxXp: 4000 },
    { level: 7, name: 'Polyglot Elite', minXp: 4000, maxXp: 99999 }
  ];

  for (let i = 0; i < levels.length; i++) {
    const l = levels[i];
    if (totalXp >= l.minXp && (totalXp < l.maxXp || i === levels.length - 1)) {
      const progressInLevel = totalXp - l.minXp;
      const totalNeeded = l.maxXp - l.minXp;
      const progressPercent = Math.min(100, Math.round((progressInLevel / totalNeeded) * 100));
      return {
        level: l.level,
        title: l.name,
        currentXp: totalXp,
        levelMinXp: l.minXp,
        levelMaxXp: l.maxXp,
        progressPercent,
        xpToNext: Math.max(0, l.maxXp - totalXp)
      };
    }
  }

  return {
    level: 7,
    title: 'Polyglot Elite',
    currentXp: totalXp,
    levelMinXp: 4000,
    levelMaxXp: 99999,
    progressPercent: 100,
    xpToNext: 0
  };
}
