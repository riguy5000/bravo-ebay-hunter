const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUsage() {
  // Get today's date in UTC
  const today = new Date().toISOString().split('T')[0];

  console.log('Checking actual API usage from api_usage table for', today);
  console.log('='.repeat(60));

  // Query actual API calls from the api_usage table
  const { data: usage, error } = await supabase
    .from('api_usage')
    .select('api_key_label, call_type')
    .eq('date_bucket', today);

  if (error) {
    console.log('Error querying api_usage:', error.message);
    return;
  }

  // Count by API key
  const counts = {};
  for (const row of usage) {
    const key = row.api_key_label || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }

  console.log('\nActual API calls today (from api_usage table):');
  console.log('-'.repeat(40));

  let total = 0;
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log(`  ${key}: ${count} calls`);
    total += count;
  });

  console.log('-'.repeat(40));
  console.log(`  TOTAL: ${total} calls`);
  console.log('');

  // Also show what's stored in settings
  console.log('Stored counts in settings (may be inaccurate):');
  console.log('-'.repeat(40));

  const { data: settings } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  if (settings?.value_json?.keys) {
    let storedTotal = 0;
    settings.value_json.keys.forEach(key => {
      const calls = key.calls_today || 0;
      console.log(`  ${key.label}: ${calls} calls (reset: ${key.calls_reset_date || 'never'})`);
      storedTotal += calls;
    });
    console.log('-'.repeat(40));
    console.log(`  STORED TOTAL: ${storedTotal} calls`);
  }

  console.log('');
  console.log('eBay daily limit per key: 5,000 calls');
  console.log('If actual calls > 5,000 per key, that key is rate limited.');
}

checkUsage().catch(console.error);
