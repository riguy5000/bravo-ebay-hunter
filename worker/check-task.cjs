// Quick script to check task configuration
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, name, item_type, gemstone_filters, max_price')
    .eq('item_type', 'gemstone');

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const task of tasks) {
    console.log('\n' + '='.repeat(60));
    console.log(`Task: ${task.name}`);
    console.log(`ID: ${task.id}`);
    console.log(`Max Price: $${task.max_price || 'none'}`);
    console.log('='.repeat(60));
    console.log('\nGemstone Filters:');
    console.log(JSON.stringify(task.gemstone_filters, null, 2));
  }
}

main();
