const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  const keys = settings?.value_json?.keys || [];
  console.log('Found', keys.length, 'API keys\n');

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    console.log(`[${i+1}] ${key.name || 'API' + (i+1)}: `, '');

    try {
      const auth = Buffer.from(key.app_id + ':' + key.cert_id).toString('base64');
      const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + auth
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        console.log('❌ Token error:', tokenData.error_description || tokenData.error);
        continue;
      }

      // Try to fetch the item
      const itemRes = await fetch('https://api.ebay.com/buy/browse/v1/item/v1|177690023535|0', {
        headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
      });

      if (itemRes.status === 200) {
        const item = await itemRes.json();
        console.log('✅ SUCCESS!');
        console.log('\n--- ITEM DETAILS ---');
        console.log('Title:', item.title);
        console.log('Price: $' + item.price?.value);
        console.log('Category:', item.categoryPath);
        console.log('CategoryId:', item.categoryId);
        console.log('Condition:', item.condition);
        console.log('\nItem Specifics:');
        item.localizedAspects?.forEach(a => console.log(`  ${a.name}: ${a.value}`));
        return; // Found it, stop trying
      } else if (itemRes.status === 429) {
        console.log('⚠️ Rate limited (429)');
      } else {
        const err = await itemRes.json();
        console.log('❌ Error', itemRes.status, '-', err.errors?.[0]?.message || 'Unknown');
      }
    } catch (e) {
      console.log('❌ Error:', e.message);
    }
  }
}

test().catch(e => console.log('Error:', e.message));
