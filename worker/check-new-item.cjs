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
  const itemId = process.argv[2] || '177699897002';  // New listing

  console.log('Checking item:', itemId);
  console.log('Found', keys.length, 'API keys\n');

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

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
        continue;
      }

      // Try to fetch the item
      const itemRes = await fetch('https://api.ebay.com/buy/browse/v1/item/v1|' + itemId + '|0', {
        headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
      });

      if (itemRes.status === 200) {
        const item = await itemRes.json();
        console.log('✅ ITEM FOUND IN API!');
        console.log('\n--- ITEM DETAILS ---');
        console.log('Title:', item.title);
        console.log('Price: $' + item.price?.value);
        console.log('Category:', item.categoryPath);
        console.log('CategoryId:', item.categoryId);
        console.log('Condition:', item.condition);
        console.log('\nItem Specifics:');
        item.localizedAspects?.forEach(a => console.log(`  ${a.name}: ${a.value}`));
        return;
      } else if (itemRes.status === 404) {
        console.log('❌ Item NOT FOUND in eBay API yet (404)');
        console.log('   eBay may take 1-5+ minutes to index new listings');
        return;
      } else if (itemRes.status === 429) {
        continue; // Try next key
      } else {
        const err = await itemRes.json();
        console.log('❌ Error', itemRes.status, '-', err.errors?.[0]?.message || 'Unknown');
        return;
      }
    } catch (e) {
      console.log('❌ Error:', e.message);
    }
  }
  console.log('All keys rate limited, try again in a minute');
}

test().catch(e => console.log('Error:', e.message));
