const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resetKeys() {
  const { data, error } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const config = data.value_json;

  // Reset all keys except API7 (which has auth error - invalid credentials)
  const updatedKeys = config.keys.map(key => {
    if (key.label === 'API7') {
      console.log('Skipping API7 (has auth error - needs credential fix)');
      return key;
    }

    if (key.status === 'rate_limited' || key.status === 'RATE_LIMITED') {
      console.log('Resetting ' + key.label + ' from RATE_LIMITED to active');
      return { ...key, status: 'active' };
    }

    return key;
  });

  const { error: updateError } = await supabase
    .from('settings')
    .update({
      value_json: { ...config, keys: updatedKeys },
      updated_at: new Date().toISOString()
    })
    .eq('key', 'ebay_keys');

  if (updateError) {
    console.log('Update error:', updateError.message);
    return;
  }

  console.log('\nDone! Keys have been reset to active status.');
  console.log('You can now restart the worker.');
}

resetKeys().catch(console.error);
