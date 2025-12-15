import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const taskName = process.argv[2];

if (!taskName) {
  console.log('Usage: node clear-matches.js "Task Name"');
  console.log('Example: node clear-matches.js "Gold Scrap Scanner"');
  process.exit(1);
}

async function clearMatches() {
  // Find all tasks matching name
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, name, item_type')
    .ilike('name', `%${taskName}%`);

  if (!tasks || tasks.length === 0) {
    console.log(`Task "${taskName}" not found`);
    process.exit(1);
  }

  let totalDeleted = 0;

  for (const task of tasks) {
    const tableName = `matches_${task.item_type}`;

    // Get count
    const { count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('task_id', task.id);

    if (count === 0) {
      console.log(`No matches for "${task.name}" (${task.id.slice(0, 8)}...)`);
      continue;
    }

    // Delete
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('task_id', task.id);

    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log(`Deleted ${count} matches from "${task.name}" (${task.id.slice(0, 8)}...)`);
      totalDeleted += count;
    }
  }

  console.log(`\nTotal deleted: ${totalDeleted} matches`);
}

clearMatches();
