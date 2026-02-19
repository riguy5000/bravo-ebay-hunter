import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  console.log('📊 API Usage Analysis (last 24h)\n');
  console.log('Cutoff:', cutoff);
  console.log('');

  // Get all records from last 24h (limit to 10000 to avoid timeout)
  const { data, error } = await supabase
    .from('api_usage')
    .select('api_key_label, call_type, called_at')
    .gte('called_at', cutoff)
    .limit(10000);

  if (error) {
    console.log('Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No data found');
    // Try without filter
    const { data: allData, count } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact' })
      .limit(5);
    console.log('Total records (no filter):', count);
    console.log('Sample:', allData);
    process.exit(1);
  }

  console.log('Total logged calls (last 24h):', data.length);
  console.log('');

  // By call type
  const byType: Record<string, number> = {};
  for (const row of data) {
    byType[row.call_type] = (byType[row.call_type] || 0) + 1;
  }
  console.log('By call type:');
  for (const [type, cnt] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + type + ': ' + cnt);
  }

  // By key
  console.log('\nBy API key:');
  const byKey: Record<string, number> = {};
  for (const row of data) {
    byKey[row.api_key_label] = (byKey[row.api_key_label] || 0) + 1;
  }
  for (const [key, cnt] of Object.entries(byKey).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + key + ': ' + cnt);
  }

  // Note: source column not yet deployed

  // Estimate missing calls
  const ebayTotal = 67630;
  const logged = data.length;
  const missing = ebayTotal - logged;

  console.log('\n📊 Gap Analysis:');
  console.log('  eBay reported: ' + ebayTotal);
  console.log('  We logged: ' + logged);
  console.log('  MISSING: ' + missing + ' (' + Math.round(missing / ebayTotal * 100) + '%)');

  // Check if item_detail calls from worker are being logged
  const itemDetailCalls = data.filter((r: any) => r.call_type === 'item_detail');
  console.log('\n📊 item_detail breakdown:');
  console.log('  Total item_detail logged: ' + itemDetailCalls.length);

  const searchCalls = data.filter((r: any) => r.call_type === 'search');
  console.log('  Total search logged: ' + searchCalls.length);

  // Ratio
  if (searchCalls.length > 0) {
    const ratio = itemDetailCalls.length / searchCalls.length;
    console.log('  Ratio (item_detail / search): ' + ratio.toFixed(2));
    console.log('  (Each search can trigger 0-200 item detail fetches)');
  }

  process.exit(0);
})();
