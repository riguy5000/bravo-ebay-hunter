import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  // Last 10 minutes
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, count } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact' })
    .gte('called_at', cutoff);

  console.log('Calls in last 10 minutes:', count || 0);

  if (data && data.length > 0) {
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    data.forEach((r: any) => {
      byType[r.call_type] = (byType[r.call_type] || 0) + 1;
      bySource[r.source || 'null'] = (bySource[r.source || 'null'] || 0) + 1;
    });
    console.log('By type:', byType);
    console.log('By source:', bySource);
  }

  // Check eBay usage for API15 (one that has remaining quota)
  const { data: settings } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  const api15 = settings?.value_json?.keys?.find((k: any) => k.label === 'API15');
  if (api15) {
    const creds = Buffer.from(api15.app_id + ':' + api15.cert_id).toString('base64');
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + creds
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });
    const tokenData: any = await tokenRes.json();

    const analyticsRes = await fetch('https://api.ebay.com/developer/analytics/v1_beta/rate_limit/', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
    });
    const analytics: any = await analyticsRes.json();
    const browse = analytics.rateLimits?.find((r: any) => r.apiName === 'Browse');
    const rate = browse?.resources?.find((r: any) => r.name === 'buy.browse')?.rates?.[0];

    console.log('\nAPI15 eBay Browse usage:');
    console.log('  Count:', rate?.count, '/ 5000');
    console.log('  Remaining:', rate?.remaining);
  }

  process.exit(0);
})();
