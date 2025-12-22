const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkKeys() {
  const { data, error } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const keys = data.value_json.keys;
  console.log('='.repeat(80));
  console.log('eBay API Keys Status');
  console.log('='.repeat(80));

  const today = new Date().toISOString().split('T')[0];

  keys.forEach((key, i) => {
    const calls = key.calls_reset_date === today ? (key.calls_today || 0) : 0;
    const pct = ((calls / 5000) * 100).toFixed(1);
    const status = key.status || 'active';
    const statusIcon = status === 'active' ? '✅' : (status === 'error' ? '❌' : '⚠️');

    console.log('');
    console.log(statusIcon + ' ' + (key.label || 'Key ' + (i+1)));
    console.log('   Status: ' + status.toUpperCase());
    console.log('   App ID: ' + key.app_id.substring(0, 12) + '...');
    console.log('   Calls Today: ' + calls + ' / 5,000 (' + pct + '%)');
    if (key.calls_reset_date) {
      console.log('   Last Reset: ' + key.calls_reset_date);
    }
  });

  console.log('');
  console.log('='.repeat(80));
  const activeKeys = keys.filter(k => k.status === 'active' || !k.status);
  const errorKeys = keys.filter(k => k.status === 'error');
  const rateLimitedKeys = keys.filter(k => k.status === 'rate_limited');

  console.log('Summary: ' + activeKeys.length + ' active, ' + errorKeys.length + ' error, ' + rateLimitedKeys.length + ' rate-limited');
  console.log('Total daily capacity: ' + (activeKeys.length * 5000) + ' calls');
  console.log('='.repeat(80));
}

checkKeys().catch(console.error);
