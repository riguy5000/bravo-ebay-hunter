const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// eBay Fine Jewelry category IDs - these are the CORRECT ones
const FINE_JEWELRY_CATEGORIES = {
  // Fine Necklaces & Pendants (main: 164330)
  '164330': 'Fine Necklaces & Pendants',
  '261993': 'Fine Necklaces & Pendants > Diamond',
  '164332': 'Fine Necklaces & Pendants > Gemstone',
  '164333': 'Fine Necklaces & Pendants > Pearl',
  '164334': 'Fine Necklaces & Pendants > Metal without Stones',

  // Fine Rings (main: 67681)
  '67681': 'Fine Rings',
  '164343': 'Fine Rings > Diamond',
  '164344': 'Fine Rings > Gemstone',
  '164345': 'Fine Rings > Pearl',
  '164346': 'Fine Rings > Metal without Stones',

  // Fine Bracelets (main: 10972)
  '10972': 'Fine Bracelets',
  '164336': 'Fine Bracelets > Diamond',
  '164337': 'Fine Bracelets > Gemstone',
  '164338': 'Fine Bracelets > Pearl',
  '164339': 'Fine Bracelets > Metal without Stones',

  // Fine Earrings (main: 10985)
  '10985': 'Fine Earrings',
  '164395': 'Fine Earrings > Diamond',
  '164396': 'Fine Earrings > Gemstone',
  '164397': 'Fine Earrings > Pearl',
  '164398': 'Fine Earrings > Metal without Stones',

  // Fine Pins & Brooches (main: 10986)
  '10986': 'Fine Pins & Brooches',

  // Fine Jewelry Sets (main: 10290)
  '10290': 'Fine Jewelry Sets',

  // Other Fine categories
  '45077': 'Fine Anklets',
  '45078': 'Fine Body Jewelry',
  '45079': 'Fine Charms & Charm Bracelets',
  '45080': 'Fine Other Fine Jewelry',
  '45081': 'Fine Jewelry Mixed Lots',

  // Fine Watches (if needed)
  '155123': 'Fine Watches',
  '155124': 'Fine Watches > Wristwatches',
  '155125': 'Fine Watches > Pocket Watches',
  '155126': 'Fine Watches > Watch Parts',

  // Loose gemstones (usually excluded for scrap)
  '164694': 'Loose Gemstones',

  // Wedding & Anniversary (subset of fine jewelry)
  '48579': 'Wedding Rings',
  '48580': 'Engagement Rings',
  '48581': 'Bridal Sets',
};

async function checkSubcategories() {
  // Get the task
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  for (const task of tasks) {
    console.log(`\n=== Task: ${task.name} ===`);

    const filters = task.watch_filters || task.jewelry_filters || {};
    const subcategories = filters.subcategories || [];

    console.log(`\nConfigured subcategories (${subcategories.length}):`);

    for (const catId of subcategories) {
      const catIdStr = String(catId);
      const name = FINE_JEWELRY_CATEGORIES[catIdStr];
      if (name) {
        console.log(`  ✅ ${catIdStr}: ${name}`);
      } else {
        console.log(`  ❌ ${catIdStr}: UNKNOWN - NOT A FINE JEWELRY CATEGORY!`);
      }
    }

    // Show what's missing
    console.log(`\nMissing Metal without Stones categories:`);
    const metalWithoutStones = ['164334', '164346', '164339', '164398'];
    for (const catId of metalWithoutStones) {
      if (!subcategories.map(String).includes(catId)) {
        console.log(`  ⚠️ ${catId}: ${FINE_JEWELRY_CATEGORIES[catId]} - NOT INCLUDED`);
      }
    }
  }
}

checkSubcategories().catch(console.error);
