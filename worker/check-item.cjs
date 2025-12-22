const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const itemId = process.argv[2] || '177699858914';

async function checkItem() {
  // Fetch from eBay API
  const credentials = Buffer.from(process.env.EBAY_CLIENT_ID_API2 + ':' + process.env.EBAY_CLIENT_SECRET_API2).toString('base64');

  // Get token
  const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });
  const tokenData = await tokenRes.json();

  // Fetch item
  const itemRes = await fetch('https://api.ebay.com/buy/browse/v1/item/v1|' + itemId + '|0', {
    headers: {
      'Authorization': 'Bearer ' + tokenData.access_token,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    }
  });

  if (!itemRes.ok) {
    console.log('Item not found in API yet. Status:', itemRes.status);
    const text = await itemRes.text();
    console.log('Response:', text.substring(0, 500));
    return;
  }

  const item = await itemRes.json();
  console.log('Title:', item.title);
  console.log('Price:', item.price?.value, item.price?.currency);
  console.log('Category:', item.categoryPath);
  console.log('Category ID:', item.categoryId);
  console.log('Condition:', item.condition);
  console.log('\nItem Specifics:');
  if (item.localizedAspects) {
    item.localizedAspects.forEach(a => console.log('  ' + a.name + ':', a.value));
  }
}

checkItem().catch(e => console.log('Error:', e.message));
