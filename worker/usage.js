#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showUsage() {
  console.log('\n📊 eBay API Usage Stats\n');
  console.log('='.repeat(60));

  // Get today's usage
  const { data: todayData, error: todayError } = await supabase
    .rpc('get_api_usage_today');

  if (todayError) {
    console.log('⚠️  Could not fetch today\'s usage. Run the migration first:');
    console.log('    supabase/migrations/20251216_api_usage_tracking.sql\n');
    return;
  }

  console.log('\n📅 TODAY\'S USAGE:\n');

  if (!todayData || todayData.length === 0) {
    console.log('   No API calls recorded today.\n');
  } else {
    console.log('   API Key              Search    Detail    Total');
    console.log('   ' + '-'.repeat(52));

    let totalSearch = 0;
    let totalDetail = 0;
    let totalAll = 0;

    for (const row of todayData) {
      const keyLabel = (row.api_key || 'unknown').substring(0, 18).padEnd(18);
      const search = String(row.search_calls).padStart(8);
      const detail = String(row.detail_calls).padStart(8);
      const total = String(row.total_calls).padStart(8);
      console.log(`   ${keyLabel}  ${search}  ${detail}  ${total}`);

      totalSearch += parseInt(row.search_calls);
      totalDetail += parseInt(row.detail_calls);
      totalAll += parseInt(row.total_calls);
    }

    console.log('   ' + '-'.repeat(52));
    console.log(`   ${'TOTAL'.padEnd(18)}  ${String(totalSearch).padStart(8)}  ${String(totalDetail).padStart(8)}  ${String(totalAll).padStart(8)}`);

    // Show percentage of daily limit
    const dailyLimit = parseInt(process.env.EBAY_DAILY_LIMIT || '5000');
    const percentUsed = Math.round((totalAll / dailyLimit) * 100);
    console.log(`\n   📈 Daily limit: ${totalAll.toLocaleString()} / ${dailyLimit.toLocaleString()} (${percentUsed}% used)`);

    if (percentUsed >= 80) {
      console.log('   ⚠️  Warning: Approaching daily limit!');
    } else if (percentUsed >= 50) {
      console.log('   ℹ️  Moderate usage');
    } else {
      console.log('   ✅ Low usage');
    }
  }

  // Get historical usage (last 7 days)
  console.log('\n📆 LAST 7 DAYS:\n');

  const { data: historyData, error: historyError } = await supabase
    .rpc('get_api_usage_history', { days_back: 7 });

  if (historyError || !historyData || historyData.length === 0) {
    console.log('   No historical data available.\n');
  } else {
    console.log('   Date          API Key              Total');
    console.log('   ' + '-'.repeat(45));

    for (const row of historyData) {
      const date = row.date;
      const keyLabel = (row.api_key || 'unknown').substring(0, 18).padEnd(18);
      const total = String(row.total_calls).padStart(8);
      console.log(`   ${date}    ${keyLabel}  ${total}`);
    }
  }

  // Show cache stats
  console.log('\n📦 CACHE STATS:\n');

  const { count: cacheCount } = await supabase
    .from('ebay_item_cache')
    .select('*', { count: 'exact', head: true });

  const { count: rejectedCount } = await supabase
    .from('ebay_rejected_items')
    .select('*', { count: 'exact', head: true });

  console.log(`   Item details cached: ${(cacheCount || 0).toLocaleString()}`);
  console.log(`   Rejected items cached: ${(rejectedCount || 0).toLocaleString()}`);

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the command
showUsage().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
