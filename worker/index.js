import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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
  const url = buildSearchUrl(task);
  console.log(`  🔍 Search URL: ${url.substring(0, 150)}...`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`eBay search error: ${response.status}`);
  }

  const data = await response.json();
  return data.itemSummaries || [];
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
  if (task.exclude_keywords?.length > 0) {
    console.log(`  🚫 Excluding: ${task.exclude_keywords.join(', ')}`);
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

      // Skip if over max price
      if (task.max_price && price > task.max_price) continue;

      // Skip if title contains excluded keywords
      if (task.exclude_keywords && task.exclude_keywords.length > 0) {
        const titleLower = item.title.toLowerCase();
        const matchedKeyword = task.exclude_keywords.find(keyword =>
          titleLower.includes(keyword.toLowerCase())
        );
        if (matchedKeyword) {
          console.log(`  ⛔ EXCLUDED (${matchedKeyword}): ${item.title.substring(0, 40)}...`);
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

  } catch (error) {
    console.error('Poll error:', error.message);
  }
}

// Start the worker
async function start() {
  // Initial poll
  await poll();

  // Continue polling
  setInterval(poll, POLL_INTERVAL);

  console.log(`\nWorker running. Polling every ${POLL_INTERVAL / 1000} seconds...`);
  console.log('Press Ctrl+C to stop.\n');
}

start();
