import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('=== TASKS ===');
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, name, item_type, min_price, max_price, status')
    .eq('status', 'active');

  for (const task of tasks || []) {
    console.log(`\nTask: ${task.name}`);
    console.log(`  ID: ${task.id}`);
    console.log(`  Type: ${task.item_type}`);
    console.log(`  Min Price: ${task.min_price}`);
    console.log(`  Max Price: ${task.max_price}`);

    // Get matches for this task
    const tableName = `matches_${task.item_type}`;
    const { data: matches } = await supabase
      .from(tableName)
      .select('ebay_title, listed_price, found_at')
      .eq('task_id', task.id)
      .order('found_at', { ascending: false })
      .limit(10);

    console.log(`\n  Recent matches (${matches?.length || 0}):`);
    for (const match of matches || []) {
      const belowMin = task.min_price && match.listed_price < task.min_price;
      const flag = belowMin ? ' ⚠️ BELOW MIN!' : '';
      console.log(`    $${match.listed_price}${flag} - ${match.ebay_title.substring(0, 50)}...`);
      console.log(`      Found: ${match.found_at}`);
    }
  }
}

diagnose();
