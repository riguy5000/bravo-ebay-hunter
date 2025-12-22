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

  for (let i = 10; i < keys.length; i++) {
    const key = keys[i];
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

    const allCategories = '164330,261993,164332,164333,164334,164336,164338,45077,45080,45081,45079,45078,155123,155124,155125,155126,164395,164396,164397,48579,48580,48581,164344,164345,164346';

    const searchUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search?' + new URLSearchParams({
      q: 'Yellow Gold',
      limit: '200',
      sort: 'newlyListed',
      filter: `categoryIds:{${allCategories}},conditions:{USED},price:[..30000],priceCurrency:USD`
    });

    console.log('Testing exact worker search...');

    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
    });

    if (searchRes.status === 429) {
      console.log('Rate limited');
      continue;
    }

    const results = await searchRes.json();
    console.log('Total:', results.total);
    console.log('Returned:', results.itemSummaries?.length);

    const ourItem = results.itemSummaries?.find(i => i.itemId?.includes('177690117212'));
    if (ourItem) {
      console.log('\n✅ YOUR ITEM IS IN TOP 200!');
      console.log('Title:', ourItem.title);
    } else {
      console.log('\n❌ Your item NOT in top 200 newlyListed');
      console.log('\nFirst 3 items:');
      results.itemSummaries?.slice(0,3).forEach((item, i) => {
        console.log(`  ${i+1}. ${item.title?.substring(0,50)}...`);
      });
    }
    return;
  }
}

test().catch(e => console.log('Error:', e.message));
