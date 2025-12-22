const fs = require('fs');

async function test() {
  // Read .env for credentials
  const env = fs.readFileSync('.env', 'utf8');
  const appId = env.match(/EBAY_APP_ID=(.+)/)?.[1]?.trim();
  const certId = env.match(/EBAY_CERT_ID=(.+)/)?.[1]?.trim();

  if (!appId || !certId) {
    console.log('Missing credentials');
    return;
  }

  // Get token
  const auth = Buffer.from(appId + ':' + certId).toString('base64');
  const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + auth
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });
  const tokenData = await tokenRes.json();
  console.log('Token obtained:', !!tokenData.access_token);

  // Fetch item directly
  const itemRes = await fetch('https://api.ebay.com/buy/browse/v1/item/v1|177690023535|0', {
    headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
  });
  const item = await itemRes.json();
  console.log('Status:', itemRes.status);
  console.log('Title:', item.title);
  console.log('Price:', item.price?.value);
  console.log('Category:', item.categoryPath);
  console.log('CategoryId:', item.categoryId);
  console.log('Condition:', item.condition);
  console.log('Item Specifics:', JSON.stringify(item.localizedAspects?.slice(0,5), null, 2));
}

test().catch(e => console.log('Error:', e.message));
