const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const itemId = process.argv[2] || '177699948555';

  // Search by item ID
  const { data } = await supabase
    .from('matches_jewelry')
    .select('*')
    .ilike('ebay_item_id', '%' + itemId + '%')
    .limit(5);

  console.log('Matches with item ID', itemId + ':');
  if (!data || data.length === 0) {
    console.log('  (none found - item may have been rejected for low margin)');
  } else {
    data.forEach(m => {
      console.log('Title:', m.ebay_title);
      console.log('Weight:', m.weight_g, 'g');
      console.log('Karat:', m.karat);
      console.log('Price: $' + m.ebay_price);
      console.log('Found at:', m.found_at);
    });
  }
}
check();
