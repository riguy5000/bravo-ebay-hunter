import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import http from 'http';

// ============================================
// Environment Validation
// ============================================
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  console.error('\nCreate a .env file in the worker directory with these values.');
  process.exit(1);
}

// Configuration
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10') * 1000; // Convert to ms
const MAX_CONCURRENT_TASKS = parseInt(process.env.MAX_CONCURRENT_TASKS || '5'); // Max tasks to run at once
const STAGGER_DELAY = parseInt(process.env.STAGGER_DELAY || '500'); // ms between each task start

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cache for eBay tokens (they last 2 hours)
const tokenCache = new Map();

// Track if we're shutting down
let isShuttingDown = false;
let pollInterval = null;

// ============================================
// Rate Limiting (eBay allows 5,000 calls/day)
// ============================================
const DAILY_LIMIT = parseInt(process.env.EBAY_DAILY_LIMIT || '4500'); // Leave buffer
const rateLimiter = {
  calls: 0,
  resetTime: Date.now() + 24 * 60 * 60 * 1000,

  canMakeCall() {
    // Reset counter if past reset time
    if (Date.now() > this.resetTime) {
      this.calls = 0;
      this.resetTime = Date.now() + 24 * 60 * 60 * 1000;
      console.log('📊 Rate limit counter reset for new day');
    }
    return this.calls < DAILY_LIMIT;
  },

  recordCall() {
    this.calls++;
    if (this.calls % 100 === 0) {
      console.log(`📊 API calls today: ${this.calls}/${DAILY_LIMIT}`);
    }
  },

  getRemainingCalls() {
    return Math.max(0, DAILY_LIMIT - this.calls);
  }
};

// ============================================
// Auto-Exclusions for Jewelry
// ============================================

// ⚙️ TOGGLE: Require karat markers (10k, 14k, etc.) for gold jewelry
// Set to false to disable karat requirement and go back to previous behavior
const REQUIRE_KARAT_MARKERS = true;

// Valid karat markers that indicate real gold
// Note: Removed hallmark numbers (375, 585, 750, etc.) as they're often misused by cheap jewelry sellers
const KARAT_MARKERS = [
  '10k', '10kt', '10 k', '10 kt', '10 karat',
  '14k', '14kt', '14 k', '14 kt', '14 karat',
  '18k', '18kt', '18 k', '18 kt', '18 karat',
  '22k', '22kt', '22 k', '22 kt', '22 karat',
  '24k', '24kt', '24 k', '24 kt', '24 karat',
  'solid gold', 'pure gold', 'real gold',
];

// Costume/fashion jewelry keywords to always exclude
const COSTUME_JEWELRY_EXCLUSIONS = [
  'snap jewelry',
  'snap button',
  'rhinestone',
  'costume',
  'fashion jewelry',
  'acrylic',
  'plastic',
  'glass bead',
  'simulated',
  'faux',
  'fake',
  'imitation',
  'cubic zirconia',
  'cz stone',
  ' cz ',        // Standalone CZ (with spaces to avoid matching words like "czech")
  'crystal bead',
  'resin',
  'enamel',
  'leather',
  'cord',
  'rope chain',
  'paracord',
  // Gold plating/filling abbreviations (not solid gold)
  ' gf ',        // Gold Filled
  ' gf',         // Gold Filled at end
  'gold gf',     // "Rose Gold GF"
  ' gp ',        // Gold Plated
  ' gp',         // Gold Plated at end
  'gold gp',     // "Rose Gold GP"
  ' hge ',       // Heavy Gold Electroplate
  ' rgp ',       // Rolled Gold Plate
  ' gep ',       // Gold Electroplated
  'gold tone',   // Not real gold
  'goldtone',    // Not real gold
];

// Map of metal categories to keywords that identify them in listings
const METAL_KEYWORDS = {
  // Precious metals (gold)
  'Yellow Gold': ['yellow gold'],
  'White Gold': ['white gold'],
  'Rose Gold': ['rose gold'],
  'Gold': ['gold', '10k', '14k', '18k', '24k', '10kt', '14kt', '18kt', '24kt'],

  // Precious metals (other)
  'Sterling Silver': ['sterling silver', '925 silver', '.925'],
  'Silver': ['silver'],
  'Platinum': ['platinum'],
  'Palladium': ['palladium'],

  // Base/fashion metals (to exclude for scrap hunting)
  'Stainless Steel': ['stainless steel', 'stainless'],
  'Steel': ['steel'],
  'Titanium': ['titanium'],
  'Tungsten': ['tungsten', 'tungsten carbide'],
  'Brass': ['brass'],
  'Bronze': ['bronze'],
  'Copper': ['copper'],
  'Pewter': ['pewter'],
  'Aluminum': ['aluminum', 'aluminium'],
  'Nickel': ['nickel'],
  'Alloy': ['alloy', 'metal alloy'],

  // Plated/filled (usually excluded anyway)
  'Gold Plated': ['gold plated', 'gold-plated', 'plated'],
  'Gold Filled': ['gold filled', 'gold-filled', 'filled'],
  'Silver Plated': ['silver plated', 'silver-plated'],
  'Rhodium Plated': ['rhodium plated', 'rhodium-plated'],
  'Vermeil': ['vermeil'],
};

// Get exclusion keywords based on metals NOT selected
function getMetalExclusionKeywords(selectedMetals) {
  if (!selectedMetals || selectedMetals.length === 0) {
    return []; // No metals selected = no auto-exclusions
  }

  const exclusions = new Set();
  const selectedLower = selectedMetals.map(m => m.toLowerCase());

  for (const [metalName, keywords] of Object.entries(METAL_KEYWORDS)) {
    // Check if this metal (or a parent category) is selected
    const isSelected = selectedLower.some(selected =>
      metalName.toLowerCase().includes(selected) ||
      selected.includes(metalName.toLowerCase())
    );

    if (!isSelected) {
      // Add keywords for unselected metals
      // But be smart - don't add generic terms that might match selected metals
      for (const keyword of keywords) {
        // Skip if keyword might match a selected metal
        const mightMatchSelected = selectedLower.some(selected =>
          keyword.includes(selected.split(' ')[0]) ||
          selected.includes(keyword.split(' ')[0])
        );

        if (!mightMatchSelected) {
          exclusions.add(keyword);
        }
      }
    }
  }

  return Array.from(exclusions);
}

// ============================================
// Health Check Server
// ============================================
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3001');
let lastPollTime = null;
let lastPollStatus = 'starting';

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const health = {
      status: isShuttingDown ? 'shutting_down' : 'healthy',
      uptime: process.uptime(),
      lastPoll: lastPollTime,
      lastPollStatus,
      apiCallsToday: rateLimiter.calls,
      apiCallsRemaining: rateLimiter.getRemainingCalls(),
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

healthServer.listen(HEALTH_PORT, () => {
  console.log(`Health check: http://localhost:${HEALTH_PORT}/health`);
});

console.log('='.repeat(50));
console.log('eBay Hunter Worker Starting...');
console.log(`Poll interval: ${POLL_INTERVAL / 1000} seconds`);
console.log(`Max concurrent tasks: ${MAX_CONCURRENT_TASKS}`);
console.log(`Stagger delay: ${STAGGER_DELAY}ms between tasks`);
console.log('='.repeat(50));

// Get eBay API credentials from Supabase settings
async function getEbayCredentials() {
  const { data, error } = await supabase
    .from('settings')
    .select('value_json')
    .eq('key', 'ebay_keys')
    .single();

  if (error || !data?.value_json) {
    throw new Error('eBay API keys not configured in settings');
  }

  const config = data.value_json;
  if (!config.keys || config.keys.length === 0) {
    throw new Error('No eBay API credentials found');
  }

  // Filter out rate-limited or errored keys
  const availableKeys = config.keys.filter(k =>
    k.status !== 'rate_limited' && k.status !== 'error'
  );

  const keysToUse = availableKeys.length > 0 ? availableKeys : config.keys;

  // Use round-robin or random selection
  const index = Math.floor(Math.random() * keysToUse.length);
  return keysToUse[index];
}

// Get eBay OAuth token
async function getEbayToken(credentials) {
  const cacheKey = credentials.app_id;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  console.log(`Fetching new eBay OAuth token for ${credentials.label || 'API Key'}...`);

  const authString = Buffer.from(`${credentials.app_id}:${credentials.cert_id}`).toString('base64');

  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });

  if (!response.ok) {
    throw new Error(`eBay token error: ${response.status}`);
  }

  const data = await response.json();

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000 // Refresh 1 min early
  });

  return data.access_token;
}

// Build eBay search URL
function buildSearchUrl(task) {
  const baseUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
  const params = new URLSearchParams();

  // Get the type-specific filters
  const filters = task.watch_filters || task.jewelry_filters || task.gemstone_filters || {};

  // Build keywords
  let keywords = task.item_type;
  if (filters.brands?.length > 0 || filters.brand) {
    keywords = `${filters.brands?.[0] || filters.brand} ${keywords}`;
  }
  if (filters.metal?.length > 0) {
    keywords = `${filters.metal[0]} ${keywords}`;
  }
  if (filters.keywords) {
    keywords += ` ${filters.keywords}`;
  }

  params.set('q', keywords);
  params.set('limit', '200');

  // Build filter string
  const filterParts = [];

  // Price filter
  if (task.max_price) {
    filterParts.push(`price:[..${task.max_price}]`);
    filterParts.push('priceCurrency:USD');
  }

  // Category filter - use subcategories if selected
  if (filters.subcategories?.length > 0) {
    // Join multiple category IDs with pipe for OR logic
    const categoryIds = filters.subcategories.join(',');
    filterParts.push(`categoryIds:{${categoryIds}}`);
    console.log(`  📂 Filtering by categories: ${categoryIds}`);
  } else if (filters.leafCategoryId) {
    // Single category from old format
    filterParts.push(`categoryIds:{${filters.leafCategoryId}}`);
    console.log(`  📂 Filtering by category: ${filters.leafCategoryId}`);
  } else {
    // Fallback to broad category
    const defaultCategories = {
      jewelry: '281',    // Jewelry & Watches
      watch: '14324',    // Wristwatches
      gemstone: '164694' // Loose Gemstones
    };
    if (defaultCategories[task.item_type]) {
      filterParts.push(`categoryIds:{${defaultCategories[task.item_type]}}`);
    }
  }

  if (filterParts.length > 0) {
    params.set('filter', filterParts.join(','));
  }

  return `${baseUrl}?${params.toString()}`;
}

// Search eBay
async function searchEbay(task, token) {
  // Check rate limit before making call
  if (!rateLimiter.canMakeCall()) {
    console.log('  ⚠️ Daily rate limit reached. Skipping search.');
    return [];
  }

  const url = buildSearchUrl(task);
  console.log(`  🔍 Search URL: ${url.substring(0, 150)}...`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json'
    }
  });

  // Record the API call
  rateLimiter.recordCall();

  if (!response.ok) {
    throw new Error(`eBay search error: ${response.status}`);
  }

  const data = await response.json();
  return data.itemSummaries || [];
}

// Fetch item details (including item specifics) from eBay
async function fetchItemDetails(itemId, token) {
  if (!rateLimiter.canMakeCall()) {
    return null;
  }

  const url = `https://api.ebay.com/buy/browse/v1/item/${itemId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json'
    }
  });

  rateLimiter.recordCall();

  if (!response.ok) {
    console.log(`  ⚠️ Failed to fetch details for ${itemId}: ${response.status}`);
    return null;
  }

  return await response.json();
}

// Extract item specifics into a simple object
function extractItemSpecifics(itemDetails) {
  if (!itemDetails?.localizedAspects) return {};

  const specs = {};
  for (const aspect of itemDetails.localizedAspects) {
    // Normalize the name to lowercase for easier matching
    specs[aspect.name.toLowerCase()] = aspect.value;
  }
  return specs;
}

// Check if item passes the item specifics filters
function passesItemSpecificsFilter(specs, filters) {
  // Check Base Metal / Metal
  const baseMetal = specs['base metal']?.toLowerCase() || '';
  const metal = specs['metal']?.toLowerCase() || '';

  // If base metal contains "plated", "filled", or non-gold metals, reject
  const badMetals = ['plated', 'filled', 'steel', 'brass', 'bronze', 'copper', 'alloy', 'tone'];
  for (const bad of badMetals) {
    if (baseMetal.includes(bad) || metal.includes(bad)) {
      return { pass: false, reason: `Base Metal/Metal contains "${bad}"` };
    }
  }

  // Check Main Stone if user selected "No Stone" or similar
  if (filters.main_stones?.includes('No Stone') || filters.main_stone === 'None') {
    const mainStone = specs['main stone']?.toLowerCase() || '';
    // If there's a main stone listed and it's not "none" or empty, reject
    if (mainStone && mainStone !== 'none' && mainStone !== 'no stone') {
      return { pass: false, reason: `Has main stone: "${specs['main stone']}"` };
    }
  }

  return { pass: true, reason: null };
}

// Get table name for item type
function getTableName(itemType) {
  return `matches_${itemType}`;
}

// Process a single task
async function processTask(task, credentials) {
  const filters = task.watch_filters || task.jewelry_filters || task.gemstone_filters || {};
  const subcatCount = filters.subcategories?.length || 0;
  console.log(`\nProcessing: ${task.name} (${task.item_type})`);
  if (subcatCount > 0) {
    console.log(`  📂 Searching ${subcatCount} subcategories`);
  }

  // Build combined exclusion list (manual + auto exclusions)
  let allExclusions = [...(task.exclude_keywords || [])];

  // For jewelry tasks, add auto-exclusions
  if (task.item_type === 'jewelry') {
    // Always exclude costume jewelry
    allExclusions = [...allExclusions, ...COSTUME_JEWELRY_EXCLUSIONS];
    console.log(`  🚫 Auto-excluding costume jewelry (${COSTUME_JEWELRY_EXCLUSIONS.length} terms)`);

    // Log karat requirement status
    if (REQUIRE_KARAT_MARKERS && filters.metal?.some(m => m.toLowerCase().includes('gold'))) {
      console.log(`  ✅ Requiring karat markers (10k, 14k, 18k, etc.)`);
    }

    // Auto-exclude metals not selected (if any metals are selected)
    if (filters.metal?.length > 0) {
      const autoMetalExclusions = getMetalExclusionKeywords(filters.metal);
      if (autoMetalExclusions.length > 0) {
        console.log(`  🔧 Selected metals: ${filters.metal.join(', ')}`);
        console.log(`  🚫 Auto-excluding metals: ${autoMetalExclusions.slice(0, 5).join(', ')}${autoMetalExclusions.length > 5 ? '...' : ''}`);
        allExclusions = [...allExclusions, ...autoMetalExclusions];
      }
    }
  }

  if (task.exclude_keywords?.length > 0) {
    console.log(`  🚫 Manual exclusions: ${task.exclude_keywords.join(', ')}`);
  }

  try {
    const token = await getEbayToken(credentials);
    const items = await searchEbay(task, token);

    console.log(`  Found ${items.length} items`);

    if (items.length === 0) return;

    const tableName = getTableName(task.item_type);
    let newMatches = 0;

    for (const item of items) {
      // Extract price
      const price = parseFloat(item.price?.value || 0);

      // Skip if under min price or over max price
      if (task.min_price && price < task.min_price) {
        console.log(`  💰 SKIPPED (price $${price} < min $${task.min_price}): ${item.title.substring(0, 30)}...`);
        continue;
      }
      if (task.max_price && price > task.max_price) continue;

      // Skip if title contains excluded keywords (manual + auto metal exclusions)
      const titleLower = item.title.toLowerCase();

      // Check exclusions and skip if matched
      if (allExclusions.length > 0) {
        const matchedKeyword = allExclusions.find(keyword =>
          titleLower.includes(keyword.toLowerCase())
        );
        if (matchedKeyword) {
          continue; // Silently skip excluded items
        }
      }

      // For jewelry with gold metals selected, require karat markers
      if (REQUIRE_KARAT_MARKERS && task.item_type === 'jewelry') {
        const hasGoldSelected = filters.metal?.some(m =>
          m.toLowerCase().includes('gold')
        ) || false;

        if (hasGoldSelected) {
          const hasKaratMarker = KARAT_MARKERS.some(marker =>
            titleLower.includes(marker.toLowerCase())
          );

          if (!hasKaratMarker) {
            continue; // Skip items without karat markers
          }
        }
      }

      // For jewelry tasks, fetch item details and check item specifics
      if (task.item_type === 'jewelry') {
        const itemDetails = await fetchItemDetails(item.itemId, token);
        if (!itemDetails) {
          continue; // Skip if we couldn't fetch details
        }

        const specs = extractItemSpecifics(itemDetails);
        const specsCheck = passesItemSpecificsFilter(specs, filters);

        if (!specsCheck.pass) {
          console.log(`  ❌ REJECTED (${specsCheck.reason}): ${item.title.substring(0, 40)}...`);
          continue;
        }
      }

      // Check for duplicate
      const { data: existing, error: dupeCheckError } = await supabase
        .from(tableName)
        .select('id')
        .eq('ebay_listing_id', item.itemId)
        .eq('task_id', task.id)
        .maybeSingle();

      // Skip if already exists OR if there was an error checking (be safe)
      if (existing || dupeCheckError) {
        if (dupeCheckError) {
          console.log(`  ⚠️ Dupe check error: ${dupeCheckError.message}`);
        }
        continue;
      }

      // Build match record
      const match = {
        task_id: task.id,
        user_id: task.user_id,
        ebay_listing_id: item.itemId,
        ebay_title: item.title,
        ebay_url: item.itemWebUrl,
        listed_price: price,
        currency: item.price?.currency || 'USD',
        buy_format: item.buyingOptions?.join(', ') || 'Unknown',
        seller_feedback: item.seller?.feedbackScore || 0,
        found_at: new Date().toISOString(),
        status: 'new'
      };

      // Add type-specific fields
      if (task.item_type === 'watch') {
        match.case_material = 'Unknown';
        match.band_material = 'Unknown';
        match.movement = 'Unknown';
        match.dial_colour = 'Unknown';
      } else if (task.item_type === 'jewelry') {
        match.metal_type = 'Unknown';
      } else if (task.item_type === 'gemstone') {
        match.shape = 'Unknown';
        match.colour = 'Unknown';
        match.clarity = 'Unknown';
        match.cut_grade = 'Unknown';
        match.cert_lab = 'Unknown';
      }

      const { error } = await supabase.from(tableName).insert(match);

      if (!error) {
        newMatches++;
        console.log(`  + NEW: $${price} - ${item.title.substring(0, 50)}...`);
      } else if (error.code === '23505') {
        // Unique constraint violation - duplicate, just skip silently
        continue;
      } else {
        console.log(`  ⚠️ Insert error: ${error.message}`);
      }
    }

    // Update last_run
    await supabase
      .from('tasks')
      .update({ last_run: new Date().toISOString() })
      .eq('id', task.id);

    console.log(`  Saved ${newMatches} new matches`);

  } catch (error) {
    console.error(`  Error: ${error.message}`);
  }
}

// Helper: delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: process a batch of tasks with staggered starts
async function processTaskBatch(tasks, credentials) {
  const promises = tasks.map((task, index) => {
    return new Promise(async (resolve) => {
      // Stagger the start of each task
      await delay(index * STAGGER_DELAY);
      await processTask(task, credentials);
      resolve();
    });
  });

  await Promise.all(promises);
}

// Main polling loop
async function poll() {
  lastPollTime = new Date().toISOString();
  lastPollStatus = 'running';

  try {
    // Get eBay credentials
    const credentials = await getEbayCredentials();

    // Fetch active tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching tasks:', error.message);
      return;
    }

    if (!tasks || tasks.length === 0) {
      console.log(`[${new Date().toLocaleTimeString()}] No active tasks`);
      return;
    }

    console.log(`\n[${new Date().toLocaleTimeString()}] Processing ${tasks.length} active task(s) (staggered parallel)...`);

    // Process tasks in batches with staggered parallel execution
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENT_TASKS) {
      const batch = tasks.slice(i, i + MAX_CONCURRENT_TASKS);
      const batchNum = Math.floor(i / MAX_CONCURRENT_TASKS) + 1;
      const totalBatches = Math.ceil(tasks.length / MAX_CONCURRENT_TASKS);

      if (totalBatches > 1) {
        console.log(`\n  Batch ${batchNum}/${totalBatches} (${batch.length} tasks):`);
      }

      await processTaskBatch(batch, credentials);
    }

    lastPollStatus = 'success';
  } catch (error) {
    console.error('Poll error:', error.message);
    lastPollStatus = `error: ${error.message}`;
  }
}

// Start the worker
async function start() {
  // Initial poll
  await poll();

  // Continue polling
  pollInterval = setInterval(poll, POLL_INTERVAL);

  console.log(`\nWorker running. Polling every ${POLL_INTERVAL / 1000} seconds...`);
  console.log('Press Ctrl+C to stop.\n');
}

// ============================================
// Graceful Shutdown
// ============================================
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n\n${'='.repeat(50)}`);
  console.log(`Received ${signal}. Shutting down gracefully...`);

  // Stop polling
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  // Close health server
  healthServer.close();

  // Give current operations time to complete
  console.log('Waiting for current operations to complete...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('Worker stopped.');
  console.log('='.repeat(50));
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // kill command
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});

start();
