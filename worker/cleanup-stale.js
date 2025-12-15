import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Matches older than this many days will be removed (unless purchased)
const STALE_DAYS = parseInt(process.argv[2] || '30');
const DRY_RUN = process.argv.includes('--dry-run');

async function cleanupStaleMatches() {
  console.log('='.repeat(50));
  console.log('Stale Match Cleanup');
  console.log(`Removing matches older than ${STALE_DAYS} days`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no deletions)' : 'LIVE'}`);
  console.log('='.repeat(50));

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  console.log(`\nCutoff date: ${cutoffISO}\n`);

  const tables = ['matches_watch', 'matches_jewelry', 'matches_gemstone'];
  let totalDeleted = 0;

  for (const table of tables) {
    // Count stale matches (not purchased, older than cutoff)
    const { count, error: countError } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .lt('found_at', cutoffISO)
      .neq('status', 'purchased');

    if (countError) {
      console.error(`Error counting ${table}:`, countError.message);
      continue;
    }

    console.log(`${table}: ${count} stale matches`);

    if (count === 0 || DRY_RUN) continue;

    // Delete stale matches
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .lt('found_at', cutoffISO)
      .neq('status', 'purchased');

    if (deleteError) {
      console.error(`Error deleting from ${table}:`, deleteError.message);
    } else {
      console.log(`  ✓ Deleted ${count} stale matches`);
      totalDeleted += count;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Total deleted: ${totalDeleted} stale matches`);
  console.log('='.repeat(50));
}

cleanupStaleMatches();
