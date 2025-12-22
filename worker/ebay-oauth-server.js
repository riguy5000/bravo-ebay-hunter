import 'dotenv/config';
import http from 'http';
import https from 'https';
import { URL } from 'url';

// ============================================
// eBay OAuth Configuration
// ============================================
const EBAY_APP_ID = process.env.EBAY_APP_ID || 'YOUR_APP_ID';
const EBAY_CERT_ID = process.env.EBAY_CERT_ID || 'YOUR_CERT_ID';
const REDIRECT_URI = process.env.EBAY_REDIRECT_URI || 'http://localhost:3333/callback';
const EBAY_OAUTH_URL = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';

// Scopes needed for Browse API
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/buy.browse'
].join(' ');

const PORT = 3333;

// ============================================
// Helper: Exchange auth code for token
// ============================================
async function exchangeCodeForToken(authCode) {
  const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(EBAY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================
// HTTP Server
// ============================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Home page - shows link to start OAuth
  if (url.pathname === '/') {
    const authUrl = `${EBAY_OAUTH_URL}?` + new URLSearchParams({
      client_id: EBAY_APP_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES
    }).toString();

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>eBay OAuth</title></head>
      <body style="font-family: sans-serif; padding: 40px;">
        <h1>eBay OAuth Token Generator</h1>
        <p>Click the button below to authorize with eBay:</p>
        <a href="${authUrl}" style="display: inline-block; padding: 15px 30px; background: #0064d2; color: white; text-decoration: none; border-radius: 5px; font-size: 18px;">
          Authorize with eBay
        </a>
        <h3>Configuration:</h3>
        <ul>
          <li>App ID: ${EBAY_APP_ID.substring(0, 10)}...</li>
          <li>Redirect URI: ${REDIRECT_URI}</li>
        </ul>
        <p style="color: #666;">Make sure your eBay Developer Account has <code>${REDIRECT_URI}</code> listed as an accepted redirect URI.</p>
      </body>
      </html>
    `);
    return;
  }

  // Callback endpoint - receives auth code from eBay
  if (url.pathname === '/callback') {
    const authCode = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDesc = url.searchParams.get('error_description');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1 style="color: red;">Authorization Failed</h1>
          <p><strong>Error:</strong> ${error}</p>
          <p><strong>Description:</strong> ${errorDesc || 'No description'}</p>
          <a href="/">Try Again</a>
        </body>
        </html>
      `);
      return;
    }

    if (!authCode) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Missing Code</title></head>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1 style="color: red;">Missing Authorization Code</h1>
          <p>No authorization code received from eBay.</p>
          <a href="/">Try Again</a>
        </body>
        </html>
      `);
      return;
    }

    console.log('Received auth code:', authCode.substring(0, 20) + '...');

    try {
      const tokenResponse = await exchangeCodeForToken(authCode);

      if (tokenResponse.error) {
        throw new Error(`${tokenResponse.error}: ${tokenResponse.error_description}`);
      }

      console.log('\n========================================');
      console.log('ACCESS TOKEN (save this!):');
      console.log('========================================');
      console.log(tokenResponse.access_token);
      console.log('\n========================================');
      console.log('REFRESH TOKEN (save this too!):');
      console.log('========================================');
      console.log(tokenResponse.refresh_token);
      console.log('\nExpires in:', tokenResponse.expires_in, 'seconds');
      console.log('========================================\n');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>OAuth Success</title></head>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1 style="color: green;">Authorization Successful!</h1>

          <h3>Access Token:</h3>
          <textarea readonly style="width: 100%; height: 150px; font-family: monospace; font-size: 12px;">${tokenResponse.access_token}</textarea>

          <h3>Refresh Token:</h3>
          <textarea readonly style="width: 100%; height: 100px; font-family: monospace; font-size: 12px;">${tokenResponse.refresh_token}</textarea>

          <h3>Token Info:</h3>
          <ul>
            <li>Expires in: ${tokenResponse.expires_in} seconds (${(tokenResponse.expires_in / 3600).toFixed(1)} hours)</li>
            <li>Token type: ${tokenResponse.token_type}</li>
          </ul>

          <p style="color: #666;">The tokens have also been printed to the console.</p>
        </body>
        </html>
      `);
    } catch (err) {
      console.error('Token exchange error:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Token Error</title></head>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1 style="color: red;">Token Exchange Failed</h1>
          <p>${err.message}</p>
          <a href="/">Try Again</a>
        </body>
        </html>
      `);
    }
    return;
  }

  // 404 for other paths
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`
========================================
  eBay OAuth Server Running
========================================

1. Open in browser: http://localhost:${PORT}

2. Make sure your eBay Developer Account has this redirect URI:
   ${REDIRECT_URI}

3. Set these environment variables (or edit this file):
   EBAY_APP_ID=${EBAY_APP_ID.substring(0, 10)}...
   EBAY_CERT_ID=${EBAY_CERT_ID ? '(set)' : '(not set)'}

========================================
`);
});
