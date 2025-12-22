const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function search() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  const keys = settings?.value_json?.keys || [];
  const targetItemId = process.argv[2] || '177699897002';

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

      if (!tokenData.access_token) continue;

      // Search for Yellow Gold in the same category
      const searchUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search?q=Yellow+Gold&limit=200&sort=newlyListed&filter=categoryIds:{261993}';

      console.log('Searching Yellow Gold in category 261993...');
      const searchRes = await fetch(searchUrl, {
        headers: {
          'Authorization': 'Bearer ' + tokenData.access_token,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });

      if (searchRes.status === 200) {
        const data = await searchRes.json();
        console.log('Total items in search:', data.total);
        console.log('Items returned:', data.itemSummaries?.length || 0);

        // Look for the target item
        const found = data.itemSummaries?.find(item => item.itemId.includes(targetItemId));

        if (found) {
          console.log('\n✅ FOUND YOUR ITEM IN SEARCH!');
          console.log('Title:', found.title);
          console.log('ItemId:', found.itemId);
        } else {
          console.log('\n❌ Item NOT found in top 200 results');
          console.log('First 5 items:');
          data.itemSummaries?.slice(0, 5).forEach((item, i) => {
            console.log(`  ${i+1}. ${item.title.substring(0, 60)}... (${item.itemId})`);
          });
        }
        return;
      } else if (searchRes.status === 429) {
        continue;
      } else {
        console.log('Error:', searchRes.status);
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

search().catch(e => console.log('Error:', e.message));
