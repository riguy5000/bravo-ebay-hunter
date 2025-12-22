const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkApi7() {
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

  // Find API7
  const api7 = keys.find(k => k.label === 'API7');

  if (api7) {
    console.log('API7 Details:');
    console.log('  Label:', api7.label);
    console.log('  App ID:', api7.app_id);
    console.log('  Cert ID:', api7.cert_id ? api7.cert_id.substring(0, 10) + '...' : 'MISSING');
    console.log('  Status:', api7.status);
    console.log('');
  }

  // Compare to another working key (API1)
  const api1 = keys.find(k => k.label === 'API1');
  if (api1) {
    console.log('API1 Details (for comparison):');
    console.log('  Label:', api1.label);
    console.log('  App ID:', api1.app_id);
    console.log('  Cert ID:', api1.cert_id ? api1.cert_id.substring(0, 10) + '...' : 'MISSING');
    console.log('  Status:', api1.status);
  }

  // Show all app IDs to compare
  console.log('');
  console.log('All App IDs:');
  keys.forEach(k => {
    console.log('  ' + k.label + ': ' + k.app_id);
  });
}

checkApi7().catch(console.error);
