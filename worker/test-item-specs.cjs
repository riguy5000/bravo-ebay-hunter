// Test script to fetch item specs from eBay
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getEbayToken() {
  const { data, error } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  console.log('Settings query result:', { data, error });

  if (!data?.value_json?.keys) throw new Error('No eBay credentials found');

  const keys = data.value_json.keys;
  const creds = keys[0];
  console.log('Using credentials for app:', creds.app_id);

  const auth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');

  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });

  const tokenData = await response.json();
  if (tokenData.error) {
    console.error('Token error:', tokenData);
    throw new Error(`Token error: ${tokenData.error}`);
  }
  console.log('Got token, expires in:', tokenData.expires_in);
  return tokenData.access_token;
}

async function fetchItemDetails(itemId, token) {
  const response = await fetch(`https://api.ebay.com/buy/browse/v1/item/${itemId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    }
  });

  if (!response.ok) {
    console.error('Error:', response.status, await response.text());
    return null;
  }

  return response.json();
}

async function main() {
  // Test with the Padparadscha Sapphire that was saved
  const itemId = 'v1|358045290811|0';

  console.log(`\nFetching item: ${itemId}\n`);

  const token = await getEbayToken();
  const item = await fetchItemDetails(itemId, token);

  if (!item) {
    console.log('Failed to fetch item');
    return;
  }

  console.log('Title:', item.title);
  console.log('\n' + '='.repeat(60));
  console.log('Item Specifics (localizedAspects):');
  console.log('='.repeat(60) + '\n');

  if (item.localizedAspects) {
    for (const aspect of item.localizedAspects) {
      console.log(`  ${aspect.name}: ${aspect.value}`);
    }
  } else {
    console.log('  No localizedAspects found!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Looking for carat-related fields:');
  console.log('='.repeat(60) + '\n');

  const caratFields = ['Total Carat Weight', 'Carat Weight', 'Carat', 'Stone Weight', 'Main Stone Weight'];

  if (item.localizedAspects) {
    for (const aspect of item.localizedAspects) {
      if (caratFields.some(f => aspect.name.toLowerCase().includes(f.toLowerCase()))) {
        console.log(`  FOUND: ${aspect.name} = ${aspect.value}`);
      }
    }
  }

  // Also check description for carat mentions
  if (item.description) {
    const descLower = item.description.toLowerCase();
    const caratMatch = descLower.match(/(\d+\.?\d*)\s*(?:ct|carat|carats)/);
    if (caratMatch) {
      console.log(`\n  Description mentions: "${caratMatch[0]}"`);
    }
  }
}

main().catch(console.error);
