const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: settings } = await supabase.from('settings').select('value_json').eq('key', 'ebay_keys').single();
  const keys = settings?.value_json?.keys || [];

  for (const key of keys) {
    const auth = Buffer.from(key.app_id + ':' + key.cert_id).toString('base64');
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + auth },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) continue;

    const searchUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search?q=Yellow+Gold&limit=3&sort=newlyListed&filter=categoryIds:{261993}';
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
    });

    if (searchRes.status === 429) continue;

    const data = await searchRes.json();
    console.log('Status:', searchRes.status);
    if (data.itemSummaries && data.itemSummaries[0]) {
      const item = data.itemSummaries[0];
      console.log('Keys:', Object.keys(item).join(', '));
      console.log('Seller field:', item.seller);
    } else {
      console.log('No results or error:', data);
    }
    return;
  }
  console.log('All keys rate limited');
}
test().catch(e => console.log('Error:', e.message));
