const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TARGET_ITEM = process.argv[2] || '177700679651';

async function getToken(keys) {
  for (const key of keys) {
    const auth = Buffer.from(key.app_id + ':' + key.cert_id).toString('base64');
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + auth },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });
    const data = await res.json();
    if (data.access_token) return data.access_token;
  }
  return null;
}

async function searchWithKeywords(token) {
  const url = 'https://api.ebay.com/buy/browse/v1/item_summary/search?q=Yellow+Gold&limit=200&sort=newlyListed&filter=categoryIds:{261993}';
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
  });
  if (res.status === 429) return { error: 'rate limited' };
  const data = await res.json();
  return data.itemSummaries || [];
}

async function categoryBrowse(token) {
  const url = 'https://api.ebay.com/buy/browse/v1/item_summary/search?limit=200&sort=newlyListed&filter=categoryIds:{261993}';
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
  });
  if (res.status === 429) return { error: 'rate limited' };
  const data = await res.json();
  return data.itemSummaries || [];
}

async function test() {
  const { data: settings } = await supabase.from('settings').select('value_json').eq('key', 'ebay_keys').single();
  const keys = settings?.value_json?.keys || [];
  
  console.log('Testing item:', TARGET_ITEM);
  console.log('Polling both methods every 15 seconds...\n');
  
  let searchFound = null;
  let categoryFound = null;
  let attempts = 0;
  
  while (!searchFound || !categoryFound) {
    attempts++;
    const token = await getToken(keys);
    if (!token) { console.log('No valid token'); await new Promise(r => setTimeout(r, 5000)); continue; }
    
    const now = new Date().toISOString();
    
    // Test both in parallel
    const [searchResults, categoryResults] = await Promise.all([
      searchWithKeywords(token),
      categoryBrowse(token)
    ]);
    
    if (!searchFound && !searchResults.error) {
      const found = searchResults.find(i => i.itemId.includes(TARGET_ITEM));
      if (found) {
        searchFound = now;
        console.log(`✅ SEARCH found item at: ${now}`);
      } else {
        console.log(`[${now}] Search: not found (${searchResults.length} items)`);
      }
    }
    
    if (!categoryFound && !categoryResults.error) {
      const found = categoryResults.find(i => i.itemId.includes(TARGET_ITEM));
      if (found) {
        categoryFound = now;
        console.log(`✅ CATEGORY found item at: ${now}`);
      } else {
        console.log(`[${now}] Category: not found (${categoryResults.length} items)`);
      }
    }
    
    if (searchFound && categoryFound) break;
    if (attempts > 30) { console.log('Timeout after 30 attempts'); break; }
    
    await new Promise(r => setTimeout(r, 15000));
  }
  
  console.log('\n=== RESULTS ===');
  console.log('Search found at:', searchFound || 'NOT FOUND');
  console.log('Category found at:', categoryFound || 'NOT FOUND');
  
  if (searchFound && categoryFound) {
    const diff = new Date(categoryFound) - new Date(searchFound);
    if (diff < 0) console.log('Category was FASTER by', Math.abs(diff)/1000, 'seconds');
    else if (diff > 0) console.log('Search was FASTER by', diff/1000, 'seconds');
    else console.log('Both found at the SAME time');
  }
}

test().catch(console.error);
