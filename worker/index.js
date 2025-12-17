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

// Track rate-limited keys and their cooldown times
const rateLimitedKeys = new Map(); // app_id -> cooldown expiry timestamp
const RATE_LIMIT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown

// Custom error for rate limiting
class RateLimitError extends Error {
  constructor(message, credentials) {
    super(message);
    this.name = 'RateLimitError';
    this.credentials = credentials;
  }
}

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
// API Usage Tracking (logged to database)
// ============================================
async function logApiUsage(apiKeyLabel, callType, endpoint = null) {
  try {
    const { error } = await supabase.from('api_usage').insert({
      api_key_label: apiKeyLabel || 'unknown',
      call_type: callType,
      endpoint: endpoint
    });
    if (error) {
      console.log(`  ⚠️ API usage log failed: ${error.message}`);
    }
  } catch (e) {
    console.log(`  ⚠️ API usage log error: ${e.message}`);
  }
}

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

// Extract karat value from title or item specifics
function extractKarat(title, itemSpecifics = {}) {
  const titleLower = title.toLowerCase();

  // Check item specifics first (more reliable)
  const metalPurity = itemSpecifics['metal purity']?.toLowerCase() || '';
  if (metalPurity) {
    const purityMatch = metalPurity.match(/(\d+)k/);
    if (purityMatch) return parseInt(purityMatch[1]);
  }

  // Check title for karat markers
  const karatPatterns = [
    /(\d+)\s*k(?:t|arat)?(?:\s|$|[^a-z])/i,  // 10k, 14kt, 18 karat, etc.
  ];

  for (const pattern of karatPatterns) {
    const match = titleLower.match(pattern);
    if (match) {
      const karat = parseInt(match[1]);
      if ([10, 14, 18, 22, 24].includes(karat)) {
        return karat;
      }
    }
  }

  return null;
}

// Extract weight from title (in grams)
function extractWeight(title, itemSpecifics = {}) {
  // Check item specifics first - eBay uses many different field names
  // Priority order: most specific → most general
  const weightSpec = itemSpecifics['total weight'] ||
                     itemSpecifics['gram weight'] ||
                     itemSpecifics['total gram weight'] ||
                     itemSpecifics['metal weight(grams)'] ||
                     itemSpecifics['item weight'] ||
                     itemSpecifics['weight'] ||
                     itemSpecifics['total carat weight'] ||
                     itemSpecifics['item weight (approx.)'] ||
                     itemSpecifics['approximate weight'] ||
                     itemSpecifics['metal weight'] || '';

  if (weightSpec) {
    const specLower = weightSpec.toLowerCase();

    // Try to extract grams (handles "1.8 Grams", "5g", "3.4 gr")
    const gramMatch = specLower.match(/([\d.]+)\s*(?:g|gr|gram|grams)?/i);
    if (gramMatch) {
      const value = parseFloat(gramMatch[1]);
      // If the field name contains "gram" and there's no unit, assume grams
      const fieldNameImpliesGrams = ['gram weight', 'total gram weight', 'metal weight(grams)']
        .some(name => itemSpecifics[name]);
      if (gramMatch[2] || fieldNameImpliesGrams || specLower.includes('gram')) {
        return value;
      }
      // If just a number with no unit context, still return it as grams (most common)
      if (!specLower.includes('oz') && !specLower.includes('dwt') && !specLower.includes('ct')) {
        return value;
      }
    }

    // Try to extract oz and convert to grams (1 oz = 28.3495g)
    const ozMatch = specLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)/i);
    if (ozMatch) return parseFloat(ozMatch[1]) * 28.3495;

    // Try to extract dwt (pennyweight) and convert to grams (1 dwt = 1.555g)
    const dwtMatch = specLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
    if (dwtMatch) return parseFloat(dwtMatch[1]) * 1.555;
  }

  // Check title for weight
  const titleLower = title.toLowerCase();

  // Pattern for grams (more permissive)
  const gramMatch = titleLower.match(/([\d.]+)\s*(?:g|gr|gram|grams)\b/i);
  if (gramMatch) return parseFloat(gramMatch[1]);

  // Pattern for oz
  const ozMatch = titleLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)\b/i);
  if (ozMatch) return parseFloat(ozMatch[1]) * 28.3495;

  // Pattern for dwt
  const dwtMatch = titleLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
  if (dwtMatch) return parseFloat(dwtMatch[1]) * 1.555;

  return null;
}

// Cache for metal prices
let metalPricesCache = null;
let metalPricesCacheTime = 0;
const METAL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Get gold prices from database
async function getGoldPrices() {
  const now = Date.now();
  if (metalPricesCache && (now - metalPricesCacheTime) < METAL_CACHE_TTL) {
    return metalPricesCache;
  }

  try {
    const { data, error } = await supabase
      .from('metal_prices')
      .select('metal, price_gram_10k, price_gram_14k, price_gram_18k, price_gram_24k')
      .eq('metal', 'Gold')
      .single();

    if (error || !data) {
      console.log('  ⚠️ Could not fetch gold prices');
      return null;
    }

    metalPricesCache = data;
    metalPricesCacheTime = now;
    return data;
  } catch (err) {
    console.log('  ⚠️ Error fetching gold prices:', err.message);
    return null;
  }
}

// Calculate melt value based on karat, weight, and current gold price
function calculateMeltValue(karat, weightG, goldPrices) {
  if (!karat || !weightG || !goldPrices) return null;

  const pricePerGram = {
    10: goldPrices.price_gram_10k,
    14: goldPrices.price_gram_14k,
    18: goldPrices.price_gram_18k,
    22: goldPrices.price_gram_18k * (22/18), // Estimate 22k from 18k
    24: goldPrices.price_gram_24k,
  }[karat];

  if (!pricePerGram) return null;

  return weightG * pricePerGram;
}

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

// Mark a key as rate-limited (local tracking with auto-reset)
function markKeyRateLimited(appId, label) {
  const expiresAt = Date.now() + RATE_LIMIT_COOLDOWN;
  rateLimitedKeys.set(appId, expiresAt);
  console.log(`  🚫 Key "${label || appId}" rate-limited. Cooldown until ${new Date(expiresAt).toLocaleTimeString()}`);
}

// Check if a key is currently rate-limited
function isKeyRateLimited(appId) {
  const expiresAt = rateLimitedKeys.get(appId);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    // Cooldown expired, remove from map
    rateLimitedKeys.delete(appId);
    console.log(`  ✅ Key cooldown expired, now available again`);
    return false;
  }
  return true;
}

// Get all available (non-rate-limited) eBay credentials
async function getAllEbayCredentials() {
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

  return config.keys;
}

// Get eBay API credentials from Supabase settings
async function getEbayCredentials(excludeAppId = null) {
  const allKeys = await getAllEbayCredentials();

  // Filter out rate-limited keys (both from DB status and local tracking)
  const availableKeys = allKeys.filter(k => {
    // Skip if DB marks it as rate_limited or error
    if (k.status === 'rate_limited' || k.status === 'error') return false;
    // Skip if locally tracked as rate-limited
    if (isKeyRateLimited(k.app_id)) return false;
    // Skip if we're explicitly excluding this key (used for retry with different key)
    if (excludeAppId && k.app_id === excludeAppId) return false;
    return true;
  });

  if (availableKeys.length === 0) {
    // Check if all keys are just temporarily rate-limited
    const allRateLimited = allKeys.every(k => isKeyRateLimited(k.app_id));
    if (allRateLimited) {
      // Find the earliest cooldown expiry
      const earliestExpiry = Math.min(...allKeys.map(k => rateLimitedKeys.get(k.app_id) || Infinity));
      const waitTime = Math.ceil((earliestExpiry - Date.now()) / 1000);
      throw new Error(`All API keys are rate-limited. Cooldown resets in ${waitTime} seconds.`);
    }
    throw new Error('No available eBay API credentials');
  }

  // Use random selection from available keys
  const index = Math.floor(Math.random() * availableKeys.length);
  return availableKeys[index];
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

// Build eBay search URL (metalOverride allows searching for specific metal)
function buildSearchUrl(task, metalOverride = null) {
  const baseUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
  const params = new URLSearchParams();

  // Get the type-specific filters
  const filters = task.watch_filters || task.jewelry_filters || task.gemstone_filters || {};

  // Build keywords
  let keywords = task.item_type;
  if (filters.brands?.length > 0 || filters.brand) {
    keywords = `${filters.brands?.[0] || filters.brand} ${keywords}`;
  }
  // Use metalOverride if provided, otherwise use first metal from filters
  if (metalOverride) {
    keywords = `${metalOverride} ${keywords}`;
  } else if (filters.metal?.length > 0) {
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

  // Condition filter - map UI values to eBay API condition values
  const conditionMapping = {
    'new': 'NEW',
    'pre-owned': 'USED',
    'pre owned': 'USED',
    'preowned': 'USED',
    'used': 'USED',
    'for parts or not working': 'FOR_PARTS_OR_NOT_WORKING',
    'for parts': 'FOR_PARTS_OR_NOT_WORKING',
    'not working': 'FOR_PARTS_OR_NOT_WORKING'
  };

  // Get conditions from filters (can be single value or array)
  let conditionValues = filters.condition || filters.conditions || [];
  if (typeof conditionValues === 'string') {
    conditionValues = [conditionValues];
  }

  if (conditionValues.length > 0) {
    const ebayConditions = conditionValues
      .map(c => conditionMapping[c.toLowerCase().trim()])
      .filter(Boolean); // Remove any undefined mappings

    if (ebayConditions.length > 0) {
      // Use pipe | for OR logic in eBay filter
      filterParts.push(`conditions:{${ebayConditions.join('|')}}`);
      console.log(`  🏷️ Filtering by conditions: ${ebayConditions.join(', ')}`);
    }
  }

  // Build aspect filters for jewelry-specific attributes
  // NOTE: eBay's aspect_filter only works for ONE category at a time
  // When searching across multiple subcategories, aspect filtering only applies to the specified categoryId
  // This means aspect filtering is limited when searching across multiple categories
  const aspectFilters = [];

  // Use first subcategory for aspect filtering (limited effectiveness across multiple categories)
  const aspectCategoryId = filters.subcategories?.[0] || filters.leafCategoryId || '164331';

  // Main Stone filter (e.g., "No Stone", "Diamond", etc.)
  if (filters.main_stones?.length > 0) {
    const stoneValues = filters.main_stones.join('|');
    aspectFilters.push(`Main Stone:{${stoneValues}}`);
    console.log(`  💎 Aspect filter - Main Stone: ${filters.main_stones.join(', ')}`);
  }

  // Metal Purity filter (e.g., "10k", "14k", "18k", "24k")
  if (filters.metal_purity?.length > 0) {
    const purityValues = filters.metal_purity.join('|');
    aspectFilters.push(`Metal Purity:{${purityValues}}`);
    console.log(`  ✨ Aspect filter - Metal Purity: ${filters.metal_purity.join(', ')}`);
  }

  // Brand filter
  if (filters.brands?.length > 0) {
    const brandValues = filters.brands.join('|');
    aspectFilters.push(`Brand:{${brandValues}}`);
    console.log(`  🏷️ Aspect filter - Brand: ${filters.brands.join(', ')}`);
  }

  // Era filter (Vintage, Antique, etc.)
  if (filters.era?.length > 0) {
    const eraValues = filters.era.join('|');
    aspectFilters.push(`Era:{${eraValues}}`);
    console.log(`  📅 Aspect filter - Era: ${filters.era.join(', ')}`);
  }

  // Setting Style filter
  if (filters.setting_style?.length > 0) {
    const settingValues = filters.setting_style.join('|');
    aspectFilters.push(`Setting Style:{${settingValues}}`);
    console.log(`  💍 Aspect filter - Setting Style: ${filters.setting_style.join(', ')}`);
  }

  // Add aspect_filter to params if we have any
  if (aspectFilters.length > 0) {
    const aspectFilterString = `categoryId:${aspectCategoryId},${aspectFilters.join(',')}`;
    params.set('aspect_filter', aspectFilterString);
    console.log(`  🔧 Aspect filter using parent category: ${aspectCategoryId}`);
  }

  if (filterParts.length > 0) {
    params.set('filter', filterParts.join(','));
  }

  return `${baseUrl}?${params.toString()}`;
}

// Search eBay (single search with optional metal override)
async function searchEbay(task, token, credentials, metalOverride = null) {
  // Check rate limit before making call
  if (!rateLimiter.canMakeCall()) {
    console.log('  ⚠️ Daily rate limit reached. Skipping search.');
    return [];
  }

  const url = buildSearchUrl(task, metalOverride);
  const metalInfo = metalOverride ? ` [${metalOverride}]` : '';
  console.log(`  🔍 Search${metalInfo}: ${url.substring(0, 150)}...`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json'
    }
  });

  // Record the API call
  rateLimiter.recordCall();

  // Log to database for tracking
  logApiUsage(credentials.label || credentials.app_id, 'search', 'browse/search');

  if (!response.ok) {
    // Handle rate limiting (429) specially
    if (response.status === 429) {
      throw new RateLimitError(`eBay API rate limited (429)`, credentials);
    }
    throw new Error(`eBay search error: ${response.status}`);
  }

  const data = await response.json();
  return data.itemSummaries || [];
}

// Search eBay for all selected metals and combine results
async function searchEbayAllMetals(task, token, credentials) {
  const filters = task.jewelry_filters || {};
  const metals = filters.metal || [];

  // If no metals selected or not a jewelry task, do a single search
  if (task.item_type !== 'jewelry' || metals.length <= 1) {
    return await searchEbay(task, token, credentials);
  }

  console.log(`  🔧 Searching for ${metals.length} metals: ${metals.join(', ')}`);

  // Search for each metal type
  const allItems = [];
  const seenItemIds = new Set();

  for (const metal of metals) {
    const items = await searchEbay(task, token, credentials, metal);
    console.log(`  📦 Found ${items.length} items for ${metal}`);

    // Add unique items only (deduplicate by itemId)
    for (const item of items) {
      if (!seenItemIds.has(item.itemId)) {
        seenItemIds.add(item.itemId);
        allItems.push(item);
      }
    }
  }

  console.log(`  📊 Total unique items across all metals: ${allItems.length}`);
  return allItems;
}

// Check cache for item details
async function getCachedItemDetails(itemId) {
  try {
    const { data, error } = await supabase
      .from('ebay_item_cache')
      .select('item_specifics, title')
      .eq('ebay_item_id', itemId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    // Return cached data in the same format as eBay API response
    return {
      localizedAspects: data.item_specifics,
      title: data.title,
      _fromCache: true
    };
  } catch (e) {
    return null;
  }
}

// Store item details in cache
async function cacheItemDetails(itemId, itemDetails) {
  try {
    // Extract the aspects we care about
    const itemSpecifics = itemDetails.localizedAspects || [];

    await supabase
      .from('ebay_item_cache')
      .upsert({
        ebay_item_id: itemId,
        item_specifics: itemSpecifics,
        title: itemDetails.title || '',
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }, {
        onConflict: 'ebay_item_id'
      });
  } catch (e) {
    // Cache errors shouldn't break the flow
    console.log(`  ⚠️ Cache write failed for ${itemId}: ${e.message}`);
  }
}

// Track cache stats for logging
let cacheStats = { hits: 0, misses: 0 };

function resetCacheStats() {
  cacheStats = { hits: 0, misses: 0 };
}

function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? Math.round((cacheStats.hits / total) * 100) : 0;
  return { ...cacheStats, hitRate };
}

// Fetch item details (including item specifics) from eBay - with caching
async function fetchItemDetails(itemId, token, credentials) {
  // Check cache first
  const cached = await getCachedItemDetails(itemId);
  if (cached) {
    cacheStats.hits++;
    return cached;
  }

  cacheStats.misses++;

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

  // Log to database for tracking
  logApiUsage(credentials.label || credentials.app_id, 'item_detail', 'browse/item');

  if (!response.ok) {
    // Handle rate limiting (429) specially
    if (response.status === 429) {
      throw new RateLimitError(`eBay API rate limited (429) during item fetch`, credentials);
    }
    console.log(`  ⚠️ Failed to fetch details for ${itemId}: ${response.status}`);
    return null;
  }

  const itemDetails = await response.json();

  // Store in cache for next time
  await cacheItemDetails(itemId, itemDetails);

  return itemDetails;
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

// Values that indicate "no stone" in eBay item specifics
const NO_STONE_VALUES = [
  'no stone',
  'none',
  'n/a',
  'not applicable',
  'not specified',
  'unknown',
  'no main stone',
  'no gemstone',
  ''
];

// Check if a value indicates "no stone"
function isNoStoneValue(value) {
  if (!value) return true; // Empty/missing means no stone
  return NO_STONE_VALUES.includes(value.toLowerCase().trim());
}

// Check if item passes the item specifics filters
// aspectFiltersActive: object indicating which aspects were filtered at API level
function passesItemSpecificsFilter(specs, filters, aspectFiltersActive = {}) {
  // Check Base Metal / Metal - NOT available as aspect filter, must check here
  const baseMetal = specs['base metal']?.toLowerCase() || '';
  const metal = specs['metal']?.toLowerCase() || '';

  // If base metal contains "plated", "filled", or non-gold metals, reject
  const badMetals = ['plated', 'filled', 'steel', 'brass', 'bronze', 'copper', 'alloy', 'tone'];
  for (const bad of badMetals) {
    if (baseMetal.includes(bad) || metal.includes(bad)) {
      return { pass: false, reason: `Base Metal/Metal contains "${bad}"` };
    }
  }

  // Always check Main Stone in post-processing
  // NOTE: We can't skip this even if aspect filter was used, because aspect_filter
  // only works for 1 category when searching across multiple subcategories.
  // So we MUST verify Main Stone in item specifics for all items.

  // Check Main Stone if user selected "No Stone" filter
  const wantsNoStone = filters.main_stones?.some(s =>
    s.toLowerCase().includes('no stone') ||
    s.toLowerCase() === 'none' ||
    s.toLowerCase() === 'no gemstone'
  );

  if (wantsNoStone) {
    const mainStone = specs['main stone'] || '';
    const gemstone = specs['gemstone'] || '';

    // Debug log to see what values we're checking
    if (mainStone || gemstone) {
      console.log(`    🔍 Stone check: Main Stone="${mainStone}", Gemstone="${gemstone}"`);
    }

    // Only check Main Stone and Gemstone fields
    // NOTE: We intentionally do NOT check "Main Stone Color" because that field
    // often contains metal/jewelry colors like "Pink" (rose gold), "Gold", "White"
    // which would cause false rejections for items without stones
    const hasStone = !isNoStoneValue(mainStone) || !isNoStoneValue(gemstone);

    if (hasStone) {
      return { pass: false, reason: `Has stone in specs: Main Stone="${mainStone}", Gemstone="${gemstone}"` };
    }
  }

  // Helper function to check if item value matches any of the filter values (case-insensitive)
  const matchesAnyFilter = (itemValue, filterValues) => {
    if (!itemValue || !filterValues || filterValues.length === 0) return true; // No filter = pass
    const itemLower = itemValue.toLowerCase();
    return filterValues.some(f => itemLower.includes(f.toLowerCase()) || f.toLowerCase().includes(itemLower));
  };

  // Helper function to extract karat number from various formats
  // Handles: "14k", "14K", "14 k", "14 K", "14 karat", "14kt", "14 kt", "14-karat", "14 Karat Gold", etc.
  const extractKaratNumber = (value) => {
    if (!value) return null;
    // Match patterns like: 10, 14, 18, 22, 24 followed by optional space/dash and k/kt/karat
    const match = value.match(/\b(10|14|18|22|24|9|8)\s*[-]?\s*(k|kt|karat|carat)\b/i);
    if (match) return parseInt(match[1]);
    // Also try just the number if it's a standalone karat value like "14K"
    const simpleMatch = value.match(/^(\d{1,2})\s*(k|kt|karat)$/i);
    if (simpleMatch) return parseInt(simpleMatch[1]);
    return null;
  };

  // Check Metal Purity (e.g., 10K, 14K, 18K, 24K) with smart karat matching
  if (filters.metal_purity && filters.metal_purity.length > 0) {
    const itemPurity = specs['metal purity'] || '';
    if (itemPurity) {
      const itemKarat = extractKaratNumber(itemPurity);
      const filterKarats = filters.metal_purity.map(extractKaratNumber).filter(Boolean);

      // If we could extract karat numbers, compare them
      if (itemKarat && filterKarats.length > 0) {
        if (!filterKarats.includes(itemKarat)) {
          return { pass: false, reason: `Metal Purity "${itemPurity}" (${itemKarat}K) not in selected: ${filters.metal_purity.join(', ')}` };
        }
      } else if (!matchesAnyFilter(itemPurity, filters.metal_purity)) {
        // Fall back to string matching if we couldn't parse karat numbers
        return { pass: false, reason: `Metal Purity "${itemPurity}" not in selected: ${filters.metal_purity.join(', ')}` };
      }
    }
  }

  // Check Brand
  if (filters.brands && filters.brands.length > 0) {
    const itemBrand = specs['brand'] || '';
    if (itemBrand && !matchesAnyFilter(itemBrand, filters.brands)) {
      return { pass: false, reason: `Brand "${itemBrand}" not in selected: ${filters.brands.join(', ')}` };
    }
  }

  // Check Color
  if (filters.colors && filters.colors.length > 0) {
    const itemColor = specs['color'] || specs['metal color'] || '';
    if (itemColor && !matchesAnyFilter(itemColor, filters.colors)) {
      return { pass: false, reason: `Color "${itemColor}" not in selected: ${filters.colors.join(', ')}` };
    }
  }

  // Check Era
  if (filters.era && filters.era.length > 0) {
    const itemEra = specs['era'] || specs['time period'] || '';
    if (itemEra && !matchesAnyFilter(itemEra, filters.era)) {
      return { pass: false, reason: `Era "${itemEra}" not in selected: ${filters.era.join(', ')}` };
    }
  }

  // Check Setting Style
  if (filters.setting_style && filters.setting_style.length > 0) {
    const itemStyle = specs['setting style'] || specs['style'] || '';
    if (itemStyle && !matchesAnyFilter(itemStyle, filters.setting_style)) {
      return { pass: false, reason: `Setting Style "${itemStyle}" not in selected: ${filters.setting_style.join(', ')}` };
    }
  }

  // Check Features
  if (filters.features && filters.features.length > 0) {
    const itemFeatures = specs['features'] || '';
    if (itemFeatures && !matchesAnyFilter(itemFeatures, filters.features)) {
      return { pass: false, reason: `Features "${itemFeatures}" not in selected: ${filters.features.join(', ')}` };
    }
  }

  // Helper function to extract weight and convert to grams
  // Handles: "5g", "5 g", "5 grams", "0.5 oz", "10 dwt", "15.5 pennyweight", etc.
  const extractWeightInGrams = (value) => {
    if (!value) return null;
    const valueLower = value.toLowerCase().trim();

    // Try to extract number and unit
    const match = valueLower.match(/^([\d.]+)\s*(g|gr|gram|grams|oz|ounce|ounces|dwt|pennyweight|pennyweights|ct|carat|carats|kg|kilogram|kilograms|lb|lbs|pound|pounds)?/i);
    if (!match) return null;

    const num = parseFloat(match[1]);
    if (isNaN(num)) return null;

    const unit = (match[2] || 'g').toLowerCase();

    // Convert to grams
    const conversions = {
      'g': 1,
      'gr': 1,           // Common abbreviation for grams
      'gram': 1,
      'grams': 1,
      'oz': 28.3495,      // 1 oz = 28.3495g
      'ounce': 28.3495,
      'ounces': 28.3495,
      'dwt': 1.55517,     // 1 pennyweight = 1.55517g (common in jewelry)
      'pennyweight': 1.55517,
      'pennyweights': 1.55517,
      'ct': 0.2,          // 1 carat = 0.2g (for gemstones)
      'carat': 0.2,
      'carats': 0.2,
      'kg': 1000,
      'kilogram': 1000,
      'kilograms': 1000,
      'lb': 453.592,
      'lbs': 453.592,
      'pound': 453.592,
      'pounds': 453.592,
    };

    const multiplier = conversions[unit] || 1;
    return Math.round(num * multiplier * 100) / 100; // Round to 2 decimal places
  };

  // Helper function to extract weight from title/description text
  // Looks for patterns like "1.8 Grams", "5.5g", "10 dwt" in free-form text
  const extractWeightFromText = (text) => {
    if (!text) return null;
    // Match weight patterns, but NOT measurements like "1.8mm" or "18k"
    // Look for number followed by weight unit (not k/kt/karat/mm/cm/inch)
    const match = text.match(/([\d.]+)\s*(grams?|gr|oz|ounces?|dwt|pennyweights?)\b/i);
    if (match) {
      return extractWeightInGrams(match[0]);
    }
    return null;
  };

  // Check Weight (min/max in grams) with smart unit conversion
  // Check in order: specs → title → description
  // Look for various weight field names eBay might use
  const weightSpec = specs['total weight'] || specs['item weight'] || specs['weight'] ||
                     specs['gram weight'] || specs['total gram weight'] || specs['metal weight(grams)'] ||
                     specs['total carat weight'] || specs['item weight (approx.)'] ||
                     specs['approximate weight'] || specs['metal weight'] || '';

  // Debug: log all spec keys that contain "weight" to help identify field names
  const weightKeys = Object.keys(specs).filter(k => k.includes('weight'));
  if (weightKeys.length > 0 && (filters.weight_min || filters.weight_max)) {
    console.log(`    📏 Weight fields found: ${weightKeys.map(k => `${k}="${specs[k]}"`).join(', ')}`);
  }

  let itemWeight = extractWeightInGrams(weightSpec);
  let weightSource = weightSpec;

  // If no weight in specs, try to extract from title
  if (!itemWeight && specs._title) {
    itemWeight = extractWeightFromText(specs._title);
    if (itemWeight) {
      weightSource = `title: "${specs._title.substring(0, 50)}..."`;
    }
  }

  // If still no weight, try to extract from description
  if (!itemWeight && specs._description) {
    // Strip HTML tags from description before parsing
    const cleanDesc = specs._description.replace(/<[^>]*>/g, ' ');
    itemWeight = extractWeightFromText(cleanDesc);
    if (itemWeight) {
      weightSource = `description`;
    }
  }

  if (itemWeight && itemWeight > 0) {
    if (filters.weight_min && itemWeight < filters.weight_min) {
      return { pass: false, reason: `Weight ${itemWeight}g (from ${weightSource}) below minimum ${filters.weight_min}g` };
    }
    if (filters.weight_max && itemWeight > filters.weight_max) {
      return { pass: false, reason: `Weight ${itemWeight}g (from ${weightSource}) above maximum ${filters.weight_max}g` };
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
  // Reset cache stats for this task
  resetCacheStats();

  const filters = task.watch_filters || task.jewelry_filters || task.gemstone_filters || {};
  const subcatCount = filters.subcategories?.length || 0;

  // Track which aspects are filtered at API level (no need to re-check)
  const aspectFiltersActive = {
    mainStone: filters.main_stones?.length > 0,
    metalPurity: filters.metal_purity?.length > 0,
    brand: filters.brands?.length > 0,
    era: filters.era?.length > 0,
    settingStyle: filters.setting_style?.length > 0
  };

  console.log(`\nProcessing: ${task.name} (${task.item_type})`);
  console.log(`  💲 Price filters: min=$${task.min_price || 'none'}, max=$${task.max_price || 'none'}`);
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
    const items = await searchEbayAllMetals(task, token, credentials);

    console.log(`  Found ${items.length} total items`);

    if (items.length === 0) return;

    const tableName = getTableName(task.item_type);
    let newMatches = 0;

    // Pre-fetch existing matched item IDs to skip them (saves API calls)
    const { data: existingMatches } = await supabase
      .from(tableName)
      .select('ebay_listing_id')
      .eq('task_id', task.id);
    const matchedItemIds = new Set((existingMatches || []).map(m => m.ebay_listing_id));

    // Pre-fetch rejected item IDs to skip them (saves API calls)
    const { data: rejectedItems } = await supabase
      .from('ebay_rejected_items')
      .select('ebay_item_id')
      .eq('task_id', task.id)
      .gt('expires_at', new Date().toISOString());
    const rejectedItemIds = new Set((rejectedItems || []).map(r => r.ebay_item_id));

    // Track skipped items for logging
    let skippedMatched = 0;
    let skippedRejected = 0;
    let detailFetchCount = 0;
    const maxDetailFetches = task.max_detail_fetches || 0; // 0 = unlimited

    if (maxDetailFetches > 0) {
      console.log(`  🔒 Max detail fetches per poll: ${maxDetailFetches}`);
    }

    for (const item of items) {
      // Check if we've hit the detail fetch limit
      if (maxDetailFetches > 0 && detailFetchCount >= maxDetailFetches) {
        console.log(`  ⏹️ Reached max detail fetch limit (${maxDetailFetches}), stopping`);
        break;
      }
      // Skip if already matched (no need to re-process)
      if (matchedItemIds.has(item.itemId)) {
        skippedMatched++;
        continue;
      }

      // Skip if previously rejected (no need to re-check)
      if (rejectedItemIds.has(item.itemId)) {
        skippedRejected++;
        continue;
      }
      // Extract price
      const price = parseFloat(item.price?.value || 0);

      // Skip if under min price or over max price
      if (task.min_price && price < task.min_price) {
        continue; // Silently skip items below min price
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
      let itemDetails = null;
      let specs = {};
      if (task.item_type === 'jewelry') {
        itemDetails = await fetchItemDetails(item.itemId, token, credentials);
        detailFetchCount++; // Count this fetch (even if it fails)
        if (!itemDetails) {
          continue; // Skip if we couldn't fetch details
        }

        specs = extractItemSpecifics(itemDetails);
        // Add title and description to specs for weight extraction from text
        specs._title = item.title;
        specs._description = itemDetails.description || '';
        const specsCheck = passesItemSpecificsFilter(specs, filters, aspectFiltersActive);

        if (!specsCheck.pass) {
          console.log(`  ❌ REJECTED (${specsCheck.reason}): ${item.title.substring(0, 40)}...`);

          // Cache the rejection so we don't re-check this item
          try {
            await supabase.from('ebay_rejected_items').upsert({
              ebay_item_id: item.itemId,
              task_id: task.id,
              rejection_reason: specsCheck.reason,
              rejected_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            }, { onConflict: 'ebay_item_id' });
          } catch (e) {
            // Don't let cache errors break the flow
          }

          continue;
        }
      }

      // Extract shipping cost from eBay data
      // eBay returns shipping in shippingOptions array or as a simple shippingCost
      let shippingCost = 0;
      if (item.shippingOptions && item.shippingOptions.length > 0) {
        // Get the first (usually cheapest) shipping option
        const shipping = item.shippingOptions[0];
        if (shipping.shippingCost?.value) {
          shippingCost = parseFloat(shipping.shippingCost.value) || 0;
        }
      } else if (item.shippingCost?.value) {
        shippingCost = parseFloat(item.shippingCost.value) || 0;
      }

      // Build match record
      const match = {
        task_id: task.id,
        user_id: task.user_id,
        ebay_listing_id: item.itemId,
        ebay_title: item.title,
        ebay_url: item.itemWebUrl,
        listed_price: price,
        shipping_cost: shippingCost,
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

        // Extract karat and weight from title and item specifics
        const karat = extractKarat(item.title, specs);
        const weightG = extractWeight(item.title, specs);

        if (karat) {
          match.karat = karat;
        }
        if (weightG) {
          match.weight_g = weightG;
        }

        // Calculate melt value if we have karat and weight
        if (karat && weightG) {
          const goldPrices = await getGoldPrices();
          if (goldPrices) {
            const meltValue = calculateMeltValue(karat, weightG, goldPrices);
            if (meltValue) {
              match.melt_value = meltValue;
              // Profit = melt value - (listed price + shipping)
              const totalCost = price + shippingCost;
              match.profit_scrap = meltValue - totalCost;
            }
          }
        }
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
        console.log(`  ✅ SAVED: $${price} (min=$${task.min_price || 'none'}) - ${item.title.substring(0, 50)}...`);
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

    // Log skip stats
    if (skippedMatched > 0 || skippedRejected > 0) {
      console.log(`  ⏭️ Skipped: ${skippedMatched} already matched, ${skippedRejected} previously rejected`);
    }

    // Log cache stats for jewelry tasks (where we fetch item details)
    if (task.item_type === 'jewelry') {
      const stats = getCacheStats();
      console.log(`  📦 Cache stats: ${stats.hits} hits, ${stats.misses} misses (${stats.hitRate}% hit rate)`);
    }

  } catch (error) {
    // Handle rate limiting specially - mark key and retry with different key
    if (error instanceof RateLimitError) {
      markKeyRateLimited(error.credentials.app_id, error.credentials.label);

      // Try to get another key and retry once
      try {
        const newCredentials = await getEbayCredentials(error.credentials.app_id);
        console.log(`  🔄 Retrying with different key: ${newCredentials.label || 'API Key'}`);
        return await processTask(task, newCredentials);
      } catch (retryError) {
        console.error(`  ❌ Retry failed: ${retryError.message}`);
      }
    } else {
      console.error(`  Error: ${error.message}`);
    }
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

// Cleanup expired cache entries
async function cleanupExpiredCache() {
  try {
    // Clean up expired item details cache
    const { data: cacheData } = await supabase
      .from('ebay_item_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('ebay_item_id');

    // Clean up expired rejected items cache
    const { data: rejectedData } = await supabase
      .from('ebay_rejected_items')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('ebay_item_id');

    const cacheCount = cacheData?.length || 0;
    const rejectedCount = rejectedData?.length || 0;

    if (cacheCount > 0 || rejectedCount > 0) {
      console.log(`  🧹 Cleaned up ${cacheCount} expired cache entries, ${rejectedCount} expired rejections`);
    }
  } catch (e) {
    // Cache cleanup errors shouldn't break the flow
  }
}

// Main polling loop
async function poll() {
  lastPollTime = new Date().toISOString();
  lastPollStatus = 'running';

  try {
    // Cleanup expired cache entries periodically
    await cleanupExpiredCache();

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
