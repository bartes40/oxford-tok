/**
 * Autonomous Diki.pl Lexicon Synchronizer
 * Refreshes SQLite database cards with authentic, frequency-ranked Polish translations from Diki.pl
 *
 * Usage:
 *   node scripts/refresh-diki-translations.js [limit] [offset]
 * Example:
 *   node scripts/refresh-diki-translations.js 100 0
 */

import db from '../server/db.js';
import { enrichWordByIdOrText } from '../server/oxfordEngine.js';

const args = process.argv.slice(2);
const limit = args[0] ? parseInt(args[0], 10) : 50;
const offset = args[1] ? parseInt(args[1], 10) : 0;

async function run() {
  console.log(`🚀 Starting Diki.pl Lexicon Refresh (Limit: ${limit}, Offset: ${offset})...\n`);

  const stmt = db.prepare(`
    SELECT id, word, part_of_speech, definition_pl
    FROM words
    ORDER BY id ASC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(limit, offset);
  console.log(`Found ${rows.length} words to check/update.`);

  let updatedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prevDef = row.definition_pl || '';

    try {
      // Force refresh with Diki
      const enriched = await enrichWordByIdOrText(row.id, true);

      if (enriched && enriched.definition_pl && enriched.definition_pl !== prevDef) {
        updatedCount++;
        console.log(`[${i + 1}/${rows.length}] ✅ ${row.word.toUpperCase()} (${row.part_of_speech})`);
        console.log(`   Stare: ${prevDef.slice(0, 50)}`);
        console.log(`   Diki:  ${enriched.definition_pl}`);
      } else {
        console.log(`[${i + 1}/${rows.length}] ➖ ${row.word.toUpperCase()} (${enriched?.definition_pl || prevDef})`);
      }
    } catch (err) {
      failedCount++;
      console.warn(`[${i + 1}/${rows.length}] ⚠️ Błąd dla ${row.word}:`, err.message);
    }

    // Polite delay between requests (250ms)
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\n🎉 Gotowe! Zaktualizowano ${updatedCount} słówek z Diki.pl (Błędów: ${failedCount}).`);
}

run().catch(console.error);
