const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Get matches created after we stopped the edge function (around 20:05 UTC)
  const { data: matches } = await supabase
    .from('matches_jewelry')
    .select('*')
    .gt('found_at', '2025-12-22T20:05:00Z')
    .order('found_at', { ascending: false })
    .limit(15);

  console.log('Matches since Edge Function was stopped (after 20:05 UTC):');
  if (!matches || matches.length === 0) {
    console.log('  (none found)');
    return;
  }
  matches.forEach((m, i) => {
    const weight = m.weight_g ? m.weight_g + 'g' : 'NO WEIGHT';
    const purity = m.karat || 'NO PURITY';
    const time = new Date(m.found_at).toISOString();
    console.log(`${i+1}. [${time}] ${weight} | ${purity} | ${(m.ebay_title || 'no title').substring(0, 40)}`);
  });
}
check();
