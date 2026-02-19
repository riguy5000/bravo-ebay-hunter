import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  // Get all keys from settings
  const { data: settings } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  if (!settings?.value_json?.keys) {
    console.log('No keys found');
    process.exit(1);
  }

  const keys = settings.value_json.keys;
  console.log('📊 Checking eBay usage for all keys...\n');
  console.log('Key'.padEnd(12) + 'eBay Count'.padEnd(14) + 'Remaining'.padEnd(12) + 'Our Count'.padEnd(12) + 'Status');
  console.log('-'.repeat(65));

  let totalEbayCount = 0;
  let totalRemaining = 0;

  for (const key of keys) {
    try {
      // Get OAuth token for this key
      const credentials = Buffer.from(`${key.app_id}:${key.cert_id}`).toString('base64');
      const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'https://api.ebay.com/oauth/api_scope'
        })
      });

      if (!tokenResponse.ok) {
        console.log(`${(key.label || '?').padEnd(12)}${'AUTH ERR'.padEnd(14)}${'-'.padEnd(12)}${String(key.calls_today || 0).padEnd(12)}${key.status || '?'}`);
        continue;
      }

      const tokenData: any = await tokenResponse.json();

      // Get Analytics data
      const analyticsResponse = await fetch('https://api.ebay.com/developer/analytics/v1_beta/rate_limit/', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!analyticsResponse.ok) {
        console.log(`${(key.label || '?').padEnd(12)}${'API ERR'.padEnd(14)}${'-'.padEnd(12)}${String(key.calls_today || 0).padEnd(12)}${key.status || '?'}`);
        continue;
      }

      const analyticsData: any = await analyticsResponse.json();

      // Find Browse API stats
      const browseApi = analyticsData.rateLimits?.find((r: any) => r.apiName === 'Browse');
      const browseResource = browseApi?.resources?.find((r: any) => r.name === 'buy.browse');
      const browseRate = browseResource?.rates?.[0];

      if (browseRate) {
        const ebayCount = browseRate.count || 0;
        const remaining = browseRate.remaining || 0;
        totalEbayCount += ebayCount;
        totalRemaining += remaining;

        const countStr = String(ebayCount).padEnd(14);
        const remainingStr = String(remaining).padEnd(12);
        const ourCount = String(key.calls_today || 0).padEnd(12);
        const status = key.status || '?';

        console.log(`${(key.label || '?').padEnd(12)}${countStr}${remainingStr}${ourCount}${status}`);
      } else {
        console.log(`${(key.label || '?').padEnd(12)}${'NO DATA'.padEnd(14)}${'-'.padEnd(12)}${String(key.calls_today || 0).padEnd(12)}${key.status || '?'}`);
      }

      // Small delay to avoid hammering
      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      console.log(`${(key.label || '?').padEnd(12)}${'ERROR'.padEnd(14)}${'-'.padEnd(12)}${String(key.calls_today || 0).padEnd(12)}${key.status || '?'}`);
    }
  }

  console.log('-'.repeat(65));
  console.log(`${'TOTAL'.padEnd(12)}${String(totalEbayCount).padEnd(14)}${String(totalRemaining).padEnd(12)}`);
  console.log(`\nDaily limit per key: 5,000`);
  console.log(`Resets at: Midnight Pacific (8 AM UTC)`);

  process.exit(0);
})();
