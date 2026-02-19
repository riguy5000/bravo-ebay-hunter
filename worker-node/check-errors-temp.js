const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Check ebay_api_keys for any disabled/failed keys
  const { data: keys, error: keysErr } = await supabase
    .from('ebay_api_keys')
    .select('label, is_active, last_used, daily_calls, error_count')
    .order('label');

  console.log('eBay API Keys status:');
  if (keys) {
    keys.forEach(k => {
      const status = k.is_active ? 'ACTIVE' : 'DISABLED';
      console.log('  ' + (k.label || '?').padEnd(10) + ' | ' + status.padEnd(8) + ' | daily_calls: ' + String(k.daily_calls || 0).padEnd(6) + ' | errors: ' + (k.error_count || 0));
    });
  } else {
    console.log('  Could not fetch keys:', keysErr ? keysErr.message : 'unknown');
  }

  // Check for any notifications/alerts table
  const alertTables = ['notifications', 'alerts', 'slack_logs'];
  for (const t of alertTables) {
    const { error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log('\nFound table: ' + t);
    }
  }

  // Check item_cache for any failed fetches
  const { data: cache } = await supabase
    .from('item_cache')
    .select('*')
    .limit(1);

  if (cache) {
    console.log('\nitem_cache columns:', Object.keys(cache[0] || {}).join(', '));
  }
}

check();
