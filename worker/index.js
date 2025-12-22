import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================
// File Logging Setup
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file with timestamp
const logFileName = `worker-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
const logFilePath = path.join(logsDir, logFileName);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Helper to format log messages
function formatLogMessage(args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  return `[${timestamp}] ${message}`;
}

// Override console.log to also write to file
console.log = (...args) => {
  const formattedMessage = formatLogMessage(args);
  logStream.write(formattedMessage + '\n');
  originalConsoleLog.apply(console, args);
};

// Override console.error to also write to file
console.error = (...args) => {
  const formattedMessage = '[ERROR] ' + formatLogMessage(args);
  logStream.write(formattedMessage + '\n');
  originalConsoleError.apply(console, args);
};

console.log(`📝 Logging to: ${logFilePath}`);

// ============================================
// Memory & Performance Monitoring
// ============================================
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    heapUsed: formatBytes(mem.heapUsed),
    heapTotal: formatBytes(mem.heapTotal),
    rss: formatBytes(mem.rss),
    external: formatBytes(mem.external),
    heapUsedRaw: mem.heapUsed,
    rssRaw: mem.rss
  };
}

function logMemoryStats(context = '') {
  const stats = getMemoryStats();
  const prefix = context ? `[${context}] ` : '';
  console.log(`📊 ${prefix}Memory: Heap ${stats.heapUsed}/${stats.heapTotal} | RSS ${stats.rss} | External ${stats.external}`);
  return stats;
}

// Track poll cycle performance
let pollCycleCount = 0;
let totalPollTime = 0;
let maxPollTime = 0;
let minPollTime = Infinity;

function logPollPerformance(durationMs) {
  pollCycleCount++;
  totalPollTime += durationMs;
  maxPollTime = Math.max(maxPollTime, durationMs);
  minPollTime = Math.min(minPollTime, durationMs);

  const avgTime = totalPollTime / pollCycleCount;
  console.log(`⏱️ Poll #${pollCycleCount} took ${durationMs.toFixed(0)}ms (avg: ${avgTime.toFixed(0)}ms, min: ${minPollTime.toFixed(0)}ms, max: ${maxPollTime.toFixed(0)}ms)`);
}

// Log memory every 5 minutes
setInterval(() => {
  logMemoryStats('Periodic');
}, 5 * 60 * 1000);

// Log startup memory
console.log('🚀 Worker starting...');
logMemoryStats('Startup');

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
const MAIN_LOOP_INTERVAL = parseInt(process.env.MAIN_LOOP_INTERVAL || '1') * 1000; // Main loop runs every 1 second by default
const MAX_CONCURRENT_TASKS = parseInt(process.env.MAX_CONCURRENT_TASKS || '3'); // Max tasks to run at once
const STAGGER_DELAY = parseInt(process.env.STAGGER_DELAY || '200'); // ms between each task start
const DEFAULT_POLL_INTERVAL = 60; // Default task poll interval in seconds if not specified

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

// Track currently running tasks to prevent concurrent execution of the same task
const runningTasks = new Set();

// Slack webhook URL (optional - for notifications)
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Shopping API test function - defined here but called at end of file
// (needs getEbayCredentials and getEbayToken to be defined first)

// ============================================
// Slack Notifications
// ============================================
async function sendSlackNotification(match, item, karat, weightG, shippingCost, meltValue) {
  if (!SLACK_WEBHOOK_URL) return; // Skip if no webhook configured

  try {
    const totalCost = match.listed_price + shippingCost;
    const breakEven = meltValue ? meltValue * 0.97 : null;
    const profit = breakEven ? breakEven - totalCost : null;
    const profitPct = profit && totalCost > 0 ? ((profit / totalCost) * 100).toFixed(0) : null;

    const shippingText = shippingCost > 0
      ? `$${match.listed_price} + $${shippingCost} shipping = *$${totalCost}*`
      : `*$${totalCost}* (free shipping)`;

    const message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎯 New Gold Deal Found!",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${match.ebay_title.substring(0, 100)}${match.ebay_title.length > 100 ? '...' : ''}*`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*💰 Price:*\n${shippingText}`
            },
            {
              type: "mrkdwn",
              text: `*📊 Break-even:*\n${breakEven ? `$${breakEven.toFixed(0)}` : 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*✨ Karat:*\n${karat ? `${karat}K` : 'Unknown'}`
            },
            {
              type: "mrkdwn",
              text: `*⚖️ Weight:*\n${weightG ? `${weightG.toFixed(1)}g` : 'Unknown'}`
            },
            {
              type: "mrkdwn",
              text: `*💵 Profit:*\n${profit ? `$${profit.toFixed(0)} (${profitPct}%)` : 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*🏷️ Seller:*\n${item.seller?.feedbackScore || 'N/A'} feedback`
            }
          ]
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "🔗 View on eBay",
                emoji: true
              },
              url: match.ebay_url,
              style: "primary"
            }
          ]
        }
      ]
    };

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.log(`  ⚠️ Slack notification failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`  ⚠️ Slack notification error: ${error.message}`);
  }
}

// ============================================

// Test seller notification
const TEST_SELLER_ID = 'pe952597';
async function sendTestSellerNotification(item, status, reason, karat, weightG, price, shippingCost, meltValue) {
  if (!SLACK_WEBHOOK_URL) return;
  const sellerName = item.seller?.username || 'unknown';
  if (sellerName.toLowerCase() !== TEST_SELLER_ID.toLowerCase()) return;
  try {
    const detectedAt = new Date().toISOString();
    const statusEmoji = status === 'SAVED' ? '✅' : '🧪';
    const statusText = status === 'SAVED' ? 'SAVED AS MATCH' : 'REJECTED: ' + reason;
    const message = {
      blocks: [
        { type: "header", text: { type: "plain_text", text: statusEmoji + " Test Listing Detected!", emoji: true } },
        { type: "section", text: { type: "mrkdwn", text: "*" + item.title.substring(0, 100) + "*" } },
        { type: "section", fields: [
          { type: "mrkdwn", text: "*Status:* " + statusText },
          { type: "mrkdwn", text: "*Detected At:* " + detectedAt },
          { type: "mrkdwn", text: "*Price:* $" + price },
          { type: "mrkdwn", text: "*Melt Value:* " + (meltValue ? "$" + meltValue.toFixed(0) : "N/A") },
          { type: "mrkdwn", text: "*Karat:* " + (karat ? karat + "K" : "Unknown") },
          { type: "mrkdwn", text: "*Weight:* " + (weightG ? weightG.toFixed(1) + "g" : "Unknown") }
        ]},
        { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "View on eBay", emoji: true }, url: item.itemWebUrl, style: "primary" }]}
      ]
    };
    await fetch(SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
  } catch (e) { console.log('Test notification error:', e.message); }
}

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
const DAILY_RATE_LIMIT = 5000; // eBay Browse API daily limit per key

// Update API key's daily call count in settings
async function updateKeyCallCount(appId) {
  try {
    const { data, error: fetchError } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (fetchError || !data?.value_json) return;

    const config = data.value_json;
    const today = new Date().toISOString().split('T')[0];

    const updatedKeys = config.keys.map(key => {
      if (key.app_id === appId) {
        // Reset counter if it's a new day
        const needsReset = key.calls_reset_date !== today;
        const currentCalls = needsReset ? 0 : (key.calls_today || 0);
        const newCallCount = currentCalls + 1;

        return {
          ...key,
          calls_today: newCallCount,
          calls_reset_date: today
        };
      }
      return key;
    });

    await supabase
      .from('settings')
      .upsert({
        key: 'ebay_keys',
        value_json: { ...config, keys: updatedKeys },
        updated_at: new Date().toISOString()
      });
  } catch (e) {
    // Silent fail - don't break main flow
  }
}

async function logApiUsage(apiKeyLabel, callType, endpoint = null, appId = null) {
  try {
    // Log to api_usage table for historical tracking
    const { error } = await supabase.from('api_usage').insert({
      api_key_label: apiKeyLabel || 'unknown',
      call_type: callType,
      endpoint: endpoint
    });
    if (error) {
      console.log(`  ⚠️ API usage log failed: ${error.message}`);
    }

    // Update the key's daily call count if appId provided
    if (appId) {
      await updateKeyCallCount(appId);
    }
  } catch (e) {
    console.log(`  ⚠️ API usage log error: ${e.message}`);
  }
}

// ============================================
// Auto-Exclusions for Jewelry
// ============================================

// ⚙️ TOGGLE: Require karat markers (10k, 14k, etc.) in TITLE for gold jewelry
// Set to false to check metal purity in item specifics instead (more API calls but catches more items)
const REQUIRE_KARAT_MARKERS = false;

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
// DEBUG_KARAT: Set to true to enable verbose logging for karat extraction
const DEBUG_KARAT = true;

function extractKarat(title, itemSpecifics = {}) {
  const debugLog = (msg) => { if (DEBUG_KARAT) console.log(`    🔬 [KARAT] ${msg}`); };

  const titleLower = title.toLowerCase();

  // Check item specifics first (more reliable)
  const metalPurity = itemSpecifics['metal purity']?.toLowerCase() || '';
  debugLog(`Item specs "metal purity": "${metalPurity || '(not set)'}"`);

  if (metalPurity) {
    // Match patterns: 14k, 14K, 14kt, 14 karat, 9ct (British), etc.
    const purityMatch = metalPurity.match(/(\d+)\s*(?:k|kt|karat|ct|carat)/i);
    if (purityMatch) {
      const karat = parseInt(purityMatch[1]);
      debugLog(`Extracted ${karat}k from item specs`);
      return karat;
    } else {
      debugLog(`Could not parse karat from: "${metalPurity}"`);
    }
  }

  // Check title for karat markers
  debugLog(`Checking title: "${title.substring(0, 60)}..."`);

  // Valid karat values (including 9k for British gold)
  const validKarats = [8, 9, 10, 14, 18, 22, 24];

  const karatPatterns = [
    { pattern: /(\d+)\s*k(?:t|arat)?(?:\s|$|[^a-z])/i, name: 'Xk/kt/karat' },
    { pattern: /(\d+)\s*ct(?:\s|$|[^a-z])/i, name: 'Xct (British)' },        // British notation
    { pattern: /(\d+)\s*carat(?:\s|$|[^a-z])/i, name: 'X carat' },
  ];

  for (const { pattern, name } of karatPatterns) {
    const match = titleLower.match(pattern);
    if (match) {
      const karat = parseInt(match[1]);
      debugLog(`Pattern "${name}" matched: ${karat}`);
      if (validKarats.includes(karat)) {
        debugLog(`Valid karat ${karat}k found in title`);
        return karat;
      } else {
        debugLog(`Karat ${karat} not in valid list: [${validKarats.join(', ')}]`);
      }
    }
  }

  debugLog(`No karat pattern matched in title`);
  return null;
}

// Detect the primary metal type from title and item specifics
// Returns: 'gold', 'silver', 'platinum', 'palladium', or null
function detectMetalType(title, itemSpecifics = {}) {
  const titleLower = title.toLowerCase();
  const metal = (itemSpecifics['metal'] || itemSpecifics['material'] || itemSpecifics['metal type'] || '').toLowerCase();
  const metalPurity = (itemSpecifics['metal purity'] || '').toLowerCase();
  const combined = `${titleLower} ${metal} ${metalPurity}`;

  // Check for platinum first (most valuable)
  if (combined.includes('platinum') || combined.includes('plat') ||
      metalPurity.includes('950') || metalPurity.includes('900') || metalPurity.includes('850')) {
    // Make sure it's not "platinum plated"
    if (!combined.includes('plated') && !combined.includes('plate')) {
      return 'platinum';
    }
  }

  // Check for gold (check karat markers)
  if (combined.match(/\b(10|14|18|22|24)\s*k(t|arat)?\b/i) ||
      combined.includes('gold') || combined.includes('yellow gold') ||
      combined.includes('white gold') || combined.includes('rose gold')) {
    // Make sure it's not plated/filled
    if (!combined.includes('plated') && !combined.includes('filled') &&
        !combined.includes('vermeil') && !combined.includes('gold tone')) {
      return 'gold';
    }
  }

  // Check for silver
  if (combined.includes('sterling') || combined.includes('.925') ||
      combined.includes('925 silver') || metalPurity.includes('925') ||
      metalPurity.includes('999') || metalPurity.includes('900') ||
      (combined.includes('silver') && !combined.includes('plated'))) {
    // Make sure it's not silver plated
    if (!combined.includes('silver plated') && !combined.includes('silver-plated')) {
      return 'silver';
    }
  }

  // Check for palladium
  if (combined.includes('palladium')) {
    return 'palladium';
  }

  return null;
}

// Extract silver purity from title or item specifics
// Common values: 999 (fine), 925 (sterling), 900 (coin), 800 (European)
function extractSilverPurity(title, itemSpecifics = {}) {
  const titleLower = title.toLowerCase();
  const metalPurity = (itemSpecifics['metal purity'] || '').toLowerCase();
  const combined = `${titleLower} ${metalPurity}`;

  // Check for specific purity markers
  if (combined.includes('999') || combined.includes('fine silver') || combined.includes('pure silver')) {
    return 999;
  }
  if (combined.includes('925') || combined.includes('sterling') || combined.includes('.925')) {
    return 925;
  }
  if (combined.includes('900') || combined.includes('coin silver')) {
    return 900;
  }
  if (combined.includes('800')) {
    return 800;
  }

  // Default to sterling (925) if just "silver" is mentioned
  if (combined.includes('silver')) {
    return 925;
  }

  return null;
}

// Extract platinum purity from title or item specifics
// Common values: 950 (most jewelry), 900, 850
function extractPlatinumPurity(title, itemSpecifics = {}) {
  const titleLower = title.toLowerCase();
  const metalPurity = (itemSpecifics['metal purity'] || '').toLowerCase();
  const combined = `${titleLower} ${metalPurity}`;

  // Check for specific purity markers
  if (combined.includes('950') || combined.includes('pt950')) {
    return 950;
  }
  if (combined.includes('900') || combined.includes('pt900')) {
    return 900;
  }
  if (combined.includes('850') || combined.includes('pt850')) {
    return 850;
  }

  // Default to 950 if just "platinum" is mentioned (most common for jewelry)
  if (combined.includes('platinum') || combined.includes('plat')) {
    return 950;
  }

  return null;
}

// Extract weight from title, item specifics, or description (in grams)
// DEBUG_WEIGHT: Set to true to enable verbose logging for weight extraction
const DEBUG_WEIGHT = true;

function extractWeight(title, itemSpecifics = {}, description = '') {
  const debugLog = (msg) => { if (DEBUG_WEIGHT) console.log(`    🔬 [WEIGHT] ${msg}`); };

  // Check item specifics first - eBay uses many different field names
  // Priority order: most specific → most general
  const weightFieldNames = [
    'total weight', 'gram weight', 'total gram weight', 'metal weight(grams)',
    'item weight', 'weight', 'total carat weight', 'item weight (approx.)',
    'approximate weight', 'metal weight', 'chain weight', 'necklace weight',
    'ring weight', 'bracelet weight', 'gold weight', 'total metal weight',
    'net weight', 'jewelry weight'
  ];

  let weightSpec = '';
  let foundField = '';
  for (const field of weightFieldNames) {
    if (itemSpecifics[field]) {
      weightSpec = itemSpecifics[field];
      foundField = field;
      break;
    }
  }

  if (weightSpec) {
    debugLog(`Found in item specs - "${foundField}": "${weightSpec}"`);
    const specLower = weightSpec.toLowerCase();

    // Try to extract grams (handles "1.8 Grams", "5g", "3.4 gr")
    const gramMatch = specLower.match(/([\d.]+)\s*(?:g|gr|gram|grams)?/i);
    if (gramMatch) {
      const value = parseFloat(gramMatch[1]);
      // If the field name contains "gram" and there's no unit, assume grams
      const fieldNameImpliesGrams = ['gram weight', 'total gram weight', 'metal weight(grams)']
        .some(name => itemSpecifics[name]);
      if (gramMatch[2] || fieldNameImpliesGrams || specLower.includes('gram')) {
        debugLog(`Extracted ${value}g from item specs (gram pattern)`);
        console.log(`    📏 Weight fields found: ${foundField}="${weightSpec}"`);
        return value;
      }
      // If just a number with no unit context, still return it as grams (most common)
      if (!specLower.includes('oz') && !specLower.includes('dwt') && !specLower.includes('ct')) {
        debugLog(`Extracted ${value}g from item specs (number only)`);
        console.log(`    📏 Weight fields found: ${foundField}="${weightSpec}"`);
        return value;
      }
    }

    // Try to extract oz and convert to grams (1 oz = 28.3495g)
    const ozMatch = specLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)/i);
    if (ozMatch) {
      const value = parseFloat(ozMatch[1]) * 28.3495;
      debugLog(`Extracted ${ozMatch[1]}oz = ${value.toFixed(2)}g from item specs`);
      return value;
    }

    // Try to extract dwt (pennyweight) and convert to grams (1 dwt = 1.555g)
    const dwtMatch = specLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
    if (dwtMatch) {
      const value = parseFloat(dwtMatch[1]) * 1.555;
      debugLog(`Extracted ${dwtMatch[1]}dwt = ${value.toFixed(2)}g from item specs`);
      return value;
    }

    debugLog(`Could not parse weight from spec value: "${weightSpec}"`);
  } else {
    debugLog(`No weight field in item specs. Available fields: ${Object.keys(itemSpecifics).filter(k => !k.startsWith('_')).join(', ')}`);
  }

  // Check title for weight
  const titleLower = title.toLowerCase();
  debugLog(`Checking title: "${title.substring(0, 60)}..."`);

  // Pattern for grams (more permissive)
  let gramMatch = titleLower.match(/([\d.]+)\s*(?:g|gr|gram|grams)\b/i);
  if (gramMatch) {
    debugLog(`Found ${gramMatch[1]}g in title`);
    console.log(`    📏 Found weight ${gramMatch[1]}g in title`);
    return parseFloat(gramMatch[1]);
  }

  // Pattern for oz
  let ozMatch = titleLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)\b/i);
  if (ozMatch) {
    const value = parseFloat(ozMatch[1]) * 28.3495;
    debugLog(`Found ${ozMatch[1]}oz = ${value.toFixed(2)}g in title`);
    return value;
  }

  // Pattern for dwt
  let dwtMatch = titleLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
  if (dwtMatch) {
    const value = parseFloat(dwtMatch[1]) * 1.555;
    debugLog(`Found ${dwtMatch[1]}dwt = ${value.toFixed(2)}g in title`);
    return value;
  }

  debugLog(`No weight pattern in title`);

  // Check description for weight (strip HTML first)
  if (description) {
    debugLog(`Description length: ${description.length} chars`);

    // Also decode HTML entities
    const cleanDesc = description
      .replace(/<[^>]*>/g, ' ')           // Strip HTML tags
      .replace(/&nbsp;/gi, ' ')           // Replace non-breaking spaces
      .replace(/&amp;/gi, '&')            // Replace ampersands
      .replace(/&lt;/gi, '<')             // Replace less than
      .replace(/&gt;/gi, '>')             // Replace greater than
      .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n))  // Numeric entities
      .replace(/\s+/g, ' ')               // Normalize whitespace
      .toLowerCase();

    debugLog(`Cleaned description preview: "${cleanDesc.substring(0, 150)}..."`);

    // Look for weight patterns in description
    // More specific patterns first: "weight: X.Xg", "weighs X.X grams", etc.
    const weightPatterns = [
      { pattern: /(?:weight|weighs|wt)[:\s]+(\d+\.?\d*)\s*(?:g|gr|gram|grams)\b/i, name: 'weight: Xg' },
      { pattern: /(\d+\.?\d*)\s*(?:g|gr|gram|grams)\s*(?:total|weight)/i, name: 'Xg total' },
      { pattern: /(?:total|approx\.?|approximately)\s*(\d+\.?\d*)\s*(?:g|gr|gram|grams)\b/i, name: 'approx Xg' },
      { pattern: /(\d+\.?\d*)\s*(?:g|gr|gram|grams)\b/i, name: 'Xg anywhere' },
    ];

    for (const { pattern, name } of weightPatterns) {
      const match = cleanDesc.match(pattern);
      debugLog(`Pattern "${name}": ${match ? `MATCHED "${match[0]}"` : 'no match'}`);
      if (match) {
        const value = parseFloat(match[1]);
        if (value > 0 && value < 1000) { // Sanity check
          console.log(`    📏 Found weight ${value}g in description`);
          return value;
        } else {
          debugLog(`Value ${value} failed sanity check (0 < x < 1000)`);
        }
      }
    }

    // Check for oz in description
    ozMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*(\d+\.?\d*)\s*(?:oz|ounce|ounces)\b/i);
    if (ozMatch) {
      const value = parseFloat(ozMatch[1]) * 28.3495;
      console.log(`    📏 Found weight ${ozMatch[1]}oz (${value.toFixed(2)}g) in description`);
      return value;
    }

    // Check for dwt in description (also handle "penny weight" with space)
    dwtMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*(\d+\.?\d*)\s*(?:dwt|penny\s*weight)/i);
    if (dwtMatch) {
      const value = parseFloat(dwtMatch[1]) * 1.555;
      console.log(`    📏 Found weight ${dwtMatch[1]}dwt (${value.toFixed(2)}g) in description`);
      return value;
    }

    debugLog(`No weight pattern matched in description`);
  } else {
    debugLog(`No description provided`);
  }

  return null;
}

// ============================================
// WATCH-SPECIFIC EXTRACTION FUNCTIONS
// ============================================

// Extract watch case material from item specifics
function extractWatchCaseMaterial(title, itemSpecifics = {}) {
  // Check item specifics first (most reliable)
  const caseMaterial = itemSpecifics['case material'] ||
                       itemSpecifics['case/bezel material'] ||
                       itemSpecifics['material'] || '';
  if (caseMaterial) {
    return caseMaterial;
  }

  // Try to extract from title
  const titleLower = title.toLowerCase();
  const materials = [
    'stainless steel', 'steel', 'titanium', 'gold', 'rose gold', 'white gold',
    'yellow gold', 'platinum', 'ceramic', 'carbon fiber', 'bronze', 'brass',
    'plastic', 'resin', 'aluminum', 'silver'
  ];

  for (const material of materials) {
    if (titleLower.includes(material)) {
      // Capitalize first letter of each word
      return material.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return null;
}

// Extract watch band/strap material from item specifics
function extractWatchBandMaterial(title, itemSpecifics = {}) {
  // Check item specifics first
  const bandMaterial = itemSpecifics['band material'] ||
                       itemSpecifics['band/strap material'] ||
                       itemSpecifics['strap material'] ||
                       itemSpecifics['bracelet material'] || '';
  if (bandMaterial) {
    return bandMaterial;
  }

  // Try to extract from title
  const titleLower = title.toLowerCase();
  const materials = [
    'leather', 'rubber', 'silicone', 'nato', 'nylon', 'canvas',
    'stainless steel', 'steel', 'mesh', 'bracelet', 'gold', 'titanium'
  ];

  for (const material of materials) {
    if (titleLower.includes(material + ' band') ||
        titleLower.includes(material + ' strap') ||
        titleLower.includes(material + ' bracelet')) {
      return material.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return null;
}

// Extract watch movement type from item specifics
function extractWatchMovement(title, itemSpecifics = {}) {
  // Check item specifics first
  const movement = itemSpecifics['movement'] ||
                   itemSpecifics['watch movement'] ||
                   itemSpecifics['movement type'] || '';
  if (movement) {
    return movement;
  }

  // Try to extract from title
  const titleLower = title.toLowerCase();
  const movements = [
    { pattern: /automatic/i, value: 'Automatic' },
    { pattern: /self[- ]?wind/i, value: 'Automatic' },
    { pattern: /mechanical/i, value: 'Mechanical' },
    { pattern: /manual[- ]?wind/i, value: 'Manual' },
    { pattern: /hand[- ]?wound/i, value: 'Manual' },
    { pattern: /quartz/i, value: 'Quartz' },
    { pattern: /solar/i, value: 'Solar' },
    { pattern: /kinetic/i, value: 'Kinetic' },
    { pattern: /eco[- ]?drive/i, value: 'Eco-Drive' },
    { pattern: /spring drive/i, value: 'Spring Drive' }
  ];

  for (const { pattern, value } of movements) {
    if (pattern.test(title)) {
      return value;
    }
  }

  return null;
}

// Extract watch dial color from item specifics
function extractWatchDialColor(title, itemSpecifics = {}) {
  // Check item specifics first
  const dialColor = itemSpecifics['dial color'] ||
                    itemSpecifics['dial colour'] ||
                    itemSpecifics['face color'] || '';
  if (dialColor) {
    return dialColor;
  }

  // Try to extract from title - look for "X dial" pattern
  const titleLower = title.toLowerCase();
  const colorMatch = titleLower.match(/(black|white|blue|green|silver|gold|grey|gray|red|brown|champagne|mother of pearl|mop)\s*dial/i);
  if (colorMatch) {
    const color = colorMatch[1];
    return color.charAt(0).toUpperCase() + color.slice(1);
  }

  return null;
}

// Extract watch year/manufacture date from item specifics
function extractWatchYear(title, itemSpecifics = {}) {
  // Check item specifics first (multiple possible field names)
  const yearFields = [
    'year manufactured', 'year', 'year of manufacture',
    'manufacture year', 'model year', 'production year'
  ];

  for (const field of yearFields) {
    const value = itemSpecifics[field];
    if (value) {
      // Try to extract 4-digit year
      const yearMatch = value.match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year >= 1800 && year <= new Date().getFullYear() + 1) {
          return year;
        }
      }
    }
  }

  // Try to extract from title (e.g., "1965 Rolex", "Rolex 2020", etc.)
  const yearMatch = title.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1900 && year <= new Date().getFullYear() + 1) {
      return year;
    }
  }

  return null;
}

// Extract watch brand from item specifics
function extractWatchBrand(title, itemSpecifics = {}) {
  // Check item specifics first
  const brand = itemSpecifics['brand'] || '';
  if (brand && brand.toLowerCase() !== 'unbranded') {
    return brand;
  }

  // Common watch brands to look for in title
  const brands = [
    'Rolex', 'Omega', 'Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin',
    'Jaeger-LeCoultre', 'IWC', 'Cartier', 'Breitling', 'TAG Heuer', 'Tudor',
    'Panerai', 'Hublot', 'Zenith', 'Grand Seiko', 'Seiko', 'Citizen', 'Casio',
    'Tissot', 'Longines', 'Hamilton', 'Oris', 'Bell & Ross', 'Nomos',
    'Sinn', 'Fortis', 'Junghans', 'Movado', 'Bulova', 'Timex', 'Fossil',
    'Michael Kors', 'Invicta', 'Orient', 'Rado', 'Maurice Lacroix',
    'Frederique Constant', 'Baume & Mercier', 'Chopard', 'Girard-Perregaux'
  ];

  const titleLower = title.toLowerCase();
  for (const b of brands) {
    if (titleLower.includes(b.toLowerCase())) {
      return b;
    }
  }

  return null;
}

// Extract watch model from item specifics
function extractWatchModel(title, itemSpecifics = {}) {
  // Check item specifics first
  const model = itemSpecifics['model'] || itemSpecifics['model number'] || '';
  if (model) {
    return model;
  }

  // Model extraction from title is complex and brand-specific
  // Return null for now - can be enhanced later
  return null;
}

// Cache for metal prices
let metalPricesCache = null;
let metalPricesCacheTime = 0;
const METAL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Get ALL metal prices from database (gold, silver, platinum, palladium)
async function getMetalPrices() {
  const now = Date.now();
  if (metalPricesCache && (now - metalPricesCacheTime) < METAL_CACHE_TTL) {
    return metalPricesCache;
  }

  try {
    const { data, error } = await supabase
      .from('metal_prices')
      .select('metal, price_gram_10k, price_gram_14k, price_gram_18k, price_gram_24k');

    if (error || !data || data.length === 0) {
      console.log('  ⚠️ Could not fetch metal prices');
      return null;
    }

    // Convert to a map by metal name for easy access
    const pricesMap = {};
    data.forEach(row => {
      pricesMap[row.metal] = row;
    });

    metalPricesCache = pricesMap;
    metalPricesCacheTime = now;
    return pricesMap;
  } catch (err) {
    console.log('  ⚠️ Error fetching metal prices:', err.message);
    return null;
  }
}

// Legacy function for backward compatibility
async function getGoldPrices() {
  const prices = await getMetalPrices();
  return prices?.Gold || null;
}

// Calculate melt value for GOLD based on karat, weight, and current gold price
function calculateGoldMeltValue(karat, weightG, goldPrices) {
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

// Calculate melt value for SILVER based on purity, weight, and current silver price
// Common purities: 999 (fine silver), 925 (sterling), 900 (coin silver), 800 (European)
function calculateSilverMeltValue(purity, weightG, silverPrices) {
  if (!purity || !weightG || !silverPrices) return null;

  // Silver uses 24k price as the base (pure silver)
  const purePrice = silverPrices.price_gram_24k;
  if (!purePrice) return null;

  // Calculate based on purity percentage
  const purityFraction = purity / 1000; // e.g., 925 -> 0.925
  return weightG * purePrice * purityFraction;
}

// Calculate melt value for PLATINUM based on purity, weight, and current platinum price
// Common purities: 950 (most jewelry), 900, 850
function calculatePlatinumMeltValue(purity, weightG, platinumPrices) {
  if (!purity || !weightG || !platinumPrices) return null;

  // Platinum uses 24k price as the base (pure platinum)
  const purePrice = platinumPrices.price_gram_24k;
  if (!purePrice) return null;

  // Calculate based on purity percentage
  const purityFraction = purity / 1000; // e.g., 950 -> 0.95
  return weightG * purePrice * purityFraction;
}

// Legacy function for backward compatibility
function calculateMeltValue(karat, weightG, goldPrices) {
  return calculateGoldMeltValue(karat, weightG, goldPrices);
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

// Jewelry tools, supplies, and equipment to exclude
const JEWELRY_TOOLS_EXCLUSIONS = [
  'welding',
  'welder',
  'soldering',
  'solder',
  'torch',
  'pliers',
  'mandrel',
  'polishing',
  'polisher',
  'buffing',
  'tumbler',
  'jewelry making',
  'jewelry tool',
  'jewelry tools',
  'craft supplies',
  'beading',
  'bead kit',
  'findings',
  'clasps lot',
  'jump rings lot',
  'wire wrap',
  'display stand',
  'jewelry box',
  'jewelry case',
  'ring sizer',
  'loupe',
  'magnifier',
  'scale gram',
  'test kit',
  'acid test',
  'repair kit',
  'mold',
  'casting',
  'crucible',
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

  // Skip these metals when building exclusions - too aggressive
  // Silver items often have gold components, or "silver" appears in titles for other reasons
  const skipMetals = ['sterling silver', 'silver'];

  for (const [metalName, keywords] of Object.entries(METAL_KEYWORDS)) {
    // Skip silver-related metals - too aggressive as exclusions
    if (skipMetals.includes(metalName.toLowerCase())) {
      continue;
    }

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

// Only start health server and show banner if not in test mode
const isTestMode = process.argv.includes('--test-shopping') ||
                   process.argv.includes('--test-browse') ||
                   process.argv.includes('--test-both');

if (!isTestMode) {
  healthServer.listen(HEALTH_PORT, () => {
    console.log(`Health check: http://localhost:${HEALTH_PORT}/health`);
  });

  console.log('='.repeat(50));
  console.log('eBay Hunter Worker Starting...');
  console.log(`Main loop interval: ${MAIN_LOOP_INTERVAL / 1000}s (checks for due tasks)`);
  console.log(`Max concurrent tasks: ${MAX_CONCURRENT_TASKS}`);
  console.log(`Stagger delay: ${STAGGER_DELAY}ms between tasks`);
  console.log('='.repeat(50));
}

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

// Mark a key as having an authentication error (updates DB)
async function markKeyAuthError(appId, label) {
  console.log(`  ❌ Key "${label || appId}" has auth error (401). Marking as error status.`);

  // Clear from token cache
  tokenCache.delete(appId);

  try {
    // Get current keys from DB
    const { data, error } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (error || !data?.value_json?.keys) {
      console.error(`  ⚠️ Could not update key status: ${error?.message || 'No keys found'}`);
      return;
    }

    // Update the status of the key with the error
    const updatedKeys = data.value_json.keys.map(k => {
      if (k.app_id === appId) {
        return { ...k, status: 'error' };
      }
      return k;
    });

    // Save back to DB
    await supabase
      .from('settings')
      .update({ value_json: { ...data.value_json, keys: updatedKeys } })
      .eq('key', 'ebay_keys');

    console.log(`  ✅ Key "${label || appId}" marked as error in database`);
  } catch (e) {
    console.error(`  ⚠️ Failed to update key status: ${e.message}`);
  }
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

// Round-robin key rotation index
let keyRotationIndex = 0;

// Get eBay API credentials from Supabase settings
// Uses round-robin rotation to spread load across all keys
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

  // Use round-robin rotation to spread load across all keys
  const selectedKey = availableKeys[keyRotationIndex % availableKeys.length];
  keyRotationIndex = (keyRotationIndex + 1) % availableKeys.length;
  return selectedKey;
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
    // For 401 (unauthorized), mark the key as having an error so it's skipped
    if (response.status === 401) {
      await markKeyAuthError(credentials.app_id, credentials.label);
    }
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

  // Build keywords - search by metal type only, rely on categoryIds filter for category
  // We removed "jewelry" from keywords because it was excluding valid listings
  // that don't have "jewelry" in their title (e.g., "14K Yellow Gold Chain 10g")
  let keywords = '';

  // Use metalOverride if provided (for multi-metal searches), otherwise use first metal from filters
  if (metalOverride) {
    keywords = metalOverride;
  } else if (filters.metal?.length > 0) {
    keywords = filters.metal[0];
  } else {
    // Fallback to item_type if no metal specified
    keywords = task.item_type;
  }
  if (filters.brands?.length > 0 || filters.brand) {
    keywords = `${filters.brands?.[0] || filters.brand} ${keywords}`;
  }
  // Add model keywords (e.g., "Speedmaster", "Seamaster", "Black Bay")
  if (filters.model_keywords?.length > 0) {
    keywords += ` ${filters.model_keywords.join(' ')}`;
    console.log(`  🏷️ Model keywords: ${filters.model_keywords.join(', ')}`);
  }
  if (filters.keywords) {
    keywords += ` ${filters.keywords}`;
  }

  params.set('q', keywords);
  params.set('limit', '200');
  params.set('sort', 'newlyListed');

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
  // Prefer 'conditions' array if it exists, otherwise fall back to singular 'condition'
  let conditionValues = filters.conditions || filters.condition || [];
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

  // Build aspect filters for item-specific attributes
  // NOTE: eBay's aspect_filter only works for ONE category at a time
  // When searching across multiple subcategories, aspect filtering only applies to the specified categoryId
  // This means aspect filtering is limited when searching across multiple categories
  const aspectFilters = [];

  // Use first subcategory for aspect filtering (limited effectiveness across multiple categories)
  // Default category depends on item type
  const defaultAspectCategory = task.item_type === 'watch' ? '14324' : '164331';
  const aspectCategoryId = filters.subcategories?.[0] || filters.leafCategoryId || defaultAspectCategory;

  // ============================================
  // WATCH-SPECIFIC ASPECT FILTERS
  // ============================================
  if (task.item_type === 'watch') {
    // Helper function to add aspect filter
    const addWatchAspectFilter = (filterKey, aspectName, logIcon = '⌚') => {
      if (filters[filterKey]?.length > 0) {
        const values = filters[filterKey].join('|');
        aspectFilters.push(`${aspectName}:{${values}}`);
        console.log(`  ${logIcon} Aspect filter - ${aspectName}: ${filters[filterKey].join(', ')}`);
      }
    };

    // Primary filters
    addWatchAspectFilter('brands', 'Brand', '🏷️');
    addWatchAspectFilter('movements', 'Movement', '⚙️');
    addWatchAspectFilter('models', 'Model', '📋');
    addWatchAspectFilter('departments', 'Department', '👤');
    addWatchAspectFilter('styles', 'Style', '🎨');
    addWatchAspectFilter('types', 'Type', '⌚');

    // Case & Display
    addWatchAspectFilter('case_materials', 'Case Material', '🔩');
    addWatchAspectFilter('case_sizes', 'Case Size', '📐');
    addWatchAspectFilter('case_colors', 'Case Color', '🎨');
    addWatchAspectFilter('case_finishes', 'Case Finish', '✨');
    addWatchAspectFilter('case_thicknesses', 'Case Thickness', '📏');
    addWatchAspectFilter('watch_shapes', 'Watch Shape', '⬡');
    addWatchAspectFilter('displays', 'Display', '🖥️');
    addWatchAspectFilter('casebacks', 'Caseback', '🔙');

    // Dial & Bezel
    addWatchAspectFilter('dial_colors', 'Dial Color', '🎨');
    addWatchAspectFilter('dial_patterns', 'Dial Pattern', '🔲');
    addWatchAspectFilter('indices', 'Indices', '🔢');
    addWatchAspectFilter('bezel_colors', 'Bezel Color', '🎨');
    addWatchAspectFilter('bezel_types', 'Bezel Type', '⭕');

    // Band/Strap
    addWatchAspectFilter('band_materials', 'Band Material', '🔗');
    addWatchAspectFilter('band_colors', 'Band Color', '🎨');
    addWatchAspectFilter('band_types', 'Band Type', '⌚');
    addWatchAspectFilter('band_widths', 'Band Width', '📏');
    addWatchAspectFilter('lug_widths', 'Lug Width', '📏');
    addWatchAspectFilter('closures', 'Closure', '🔒');
    addWatchAspectFilter('max_wrist_sizes', 'Max. Wrist Size', '📏');

    // Features & Specs
    addWatchAspectFilter('features', 'Features', '⭐');
    addWatchAspectFilter('water_resistances', 'Water Resistance', '💧');
    addWatchAspectFilter('jewel_counts', 'Number of Jewels', '💎');
    addWatchAspectFilter('handedness', 'Handedness', '✋');
    addWatchAspectFilter('countries_of_origin', 'Country/Region of Manufacture', '🌍');

    // Year & Condition
    addWatchAspectFilter('years_manufactured', 'Year Manufactured', '📅');
    addWatchAspectFilter('vintage', 'Vintage', '🕰️');
    addWatchAspectFilter('conditions', 'Condition', '📦');
    addWatchAspectFilter('handmade', 'Handmade', '🤲');

    // Included Items & Documentation
    addWatchAspectFilter('with_box', 'With Original Box/Packaging', '📦');
    addWatchAspectFilter('with_papers', 'With Papers', '📄');
    addWatchAspectFilter('with_manual', 'With Manual/Booklet', '📖');
    addWatchAspectFilter('with_service_records', 'With Service Records', '🔧');
    addWatchAspectFilter('seller_warranty', 'Seller Warranty', '🛡️');

    // Legacy single-value filters (for backward compatibility)
    if (!filters.movements?.length && filters.movement) {
      aspectFilters.push(`Movement:{${filters.movement}}`);
      console.log(`  ⚙️ Aspect filter - Movement: ${filters.movement}`);
    }
    if (!filters.case_materials?.length && filters.case_material) {
      aspectFilters.push(`Case Material:{${filters.case_material}}`);
      console.log(`  🔩 Aspect filter - Case Material: ${filters.case_material}`);
    }
    if (!filters.brands?.length && filters.brand) {
      aspectFilters.push(`Brand:{${filters.brand}}`);
      console.log(`  🏷️ Aspect filter - Brand: ${filters.brand}`);
    }
    if (filters.watch_type) {
      aspectFilters.push(`Type:{${filters.watch_type}}`);
      console.log(`  ⌚ Aspect filter - Type: ${filters.watch_type}`);
    }
  }

  // ============================================
  // JEWELRY-SPECIFIC ASPECT FILTERS
  // ============================================
  if (task.item_type === 'jewelry') {
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
// Now gets fresh credentials for each call (round-robin rotation)
async function searchEbay(task, metalOverride = null) {
  // Check rate limit before making call
  if (!rateLimiter.canMakeCall()) {
    console.log('  ⚠️ Daily rate limit reached. Skipping search.');
    return [];
  }

  // Get fresh credentials (round-robin rotation)
  const credentials = await getEbayCredentials();
  const token = await getEbayToken(credentials);

  const url = buildSearchUrl(task, metalOverride);
  const metalInfo = metalOverride ? ` [${metalOverride}]` : '';
  console.log(`  🔍 Search${metalInfo} [${credentials.label || 'Key'}]: ${url.substring(0, 120)}...`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json'
    }
  });

  // Record the API call
  rateLimiter.recordCall();

  // Log to database for tracking (includes updating key's daily call count)
  logApiUsage(credentials.label || credentials.app_id, 'search', 'browse/search', credentials.app_id);

  if (!response.ok) {
    // Log the actual response for debugging
    const responseText = await response.text();
    console.log(`  ⚠️ eBay API error - Status: ${response.status}, Response: ${responseText.substring(0, 200)}`);

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
// Each search uses round-robin key rotation
async function searchEbayAllMetals(task) {
  const filters = task.jewelry_filters || {};
  const metals = filters.metal || [];

  // If no metals selected or not a jewelry task, do a single search
  if (task.item_type !== 'jewelry' || metals.length <= 1) {
    return await searchEbay(task);
  }

  console.log(`  🔧 Searching for ${metals.length} metals: ${metals.join(', ')}`);

  // Search for each metal type (each search rotates to next API key)
  const allItems = [];
  const seenItemIds = new Set();

  for (const metal of metals) {
    const items = await searchEbay(task, metal);
    console.log(`  📦 Found ${items.length} items for ${metal}`);

    // Add unique items only (deduplicate by itemId)
    for (const item of items) {
      if (!seenItemIds.has(item.itemId)) {
        seenItemIds.add(item.itemId);
        allItems.push(item);
      }
    }
  }

  // IMPORTANT: Sort combined results by listing date (newest first)
  // Without this, items from first metal search would always be processed before later metals
  // even if the later metals have newer listings
  allItems.sort((a, b) => {
    // eBay provides itemCreationDate in ISO format
    const dateA = a.itemCreationDate ? new Date(a.itemCreationDate) : new Date(0);
    const dateB = b.itemCreationDate ? new Date(b.itemCreationDate) : new Date(0);
    return dateB - dateA; // Newest first
  });

  console.log(`  📊 Total unique items across all metals: ${allItems.length} (sorted by listing date)`);
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
// Now gets fresh credentials for each call (round-robin rotation)
async function fetchItemDetails(itemId) {
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

  // Get fresh credentials (round-robin rotation)
  const credentials = await getEbayCredentials();
  const token = await getEbayToken(credentials);

  const url = `https://api.ebay.com/buy/browse/v1/item/${itemId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Type': 'application/json'
    }
  });

  rateLimiter.recordCall();

  // Log to database for tracking (includes updating key's daily call count)
  logApiUsage(credentials.label || credentials.app_id, 'item_detail', 'browse/item', credentials.app_id);

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

// Fetch multiple item details in a single API call (up to 20 items)
// Returns a Map of itemId -> itemDetails
async function fetchItemDetailsBulk(itemIds) {
  if (!itemIds || itemIds.length === 0) return new Map();

  const results = new Map();
  const uncachedIds = [];

  // Check cache first for all items
  for (const itemId of itemIds) {
    const cached = await getCachedItemDetails(itemId);
    if (cached) {
      cacheStats.hits++;
      results.set(itemId, cached);
    } else {
      uncachedIds.push(itemId);
    }
  }

  // If all items were cached, return early
  if (uncachedIds.length === 0) {
    console.log(`    📦 Bulk fetch: All ${itemIds.length} items from cache`);
    return results;
  }

  // Fetch uncached items in batches of 20 (eBay limit)
  const BATCH_SIZE = 20;
  const batches = [];
  for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
    batches.push(uncachedIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`    📦 Bulk fetch: ${uncachedIds.length} items in ${batches.length} batch(es), ${results.size} from cache`);

  for (const batch of batches) {
    if (!rateLimiter.canMakeCall()) {
      console.log(`    ⚠️ Rate limit reached, skipping batch`);
      break;
    }

    try {
      // Get fresh credentials (round-robin rotation)
      const credentials = await getEbayCredentials();
      const token = await getEbayToken(credentials);

      // Build comma-separated item IDs for bulk request
      const itemIdsParam = batch.join(',');
      const url = `https://api.ebay.com/buy/browse/v1/item?item_ids=${encodeURIComponent(itemIdsParam)}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json'
        }
      });

      rateLimiter.recordCall();
      logApiUsage(credentials.label || credentials.app_id, 'item_detail_bulk', 'browse/item/bulk', credentials.app_id);

      if (!response.ok) {
        if (response.status === 429) {
          console.log(`    ⚠️ Rate limited (429) during bulk fetch`);
          break;
        }
        // 403 = Permission denied - fall back to single item fetches
        if (response.status === 403) {
          console.log(`    ⚠️ Bulk API not authorized (403) - falling back to single item fetches...`);
          // Fall back to single item fetches for this batch
          for (const itemId of batch) {
            if (!rateLimiter.canMakeCall()) break;
            try {
              const singleItem = await fetchItemDetails(itemId);
              if (singleItem) {
                results.set(itemId, singleItem);
              }
            } catch (e) {
              // Skip failed items
            }
          }
          continue;
        }
        // Log detailed error for other errors
        try {
          const errorBody = await response.text();
          console.log(`    ⚠️ Bulk fetch failed: ${response.status} - ${errorBody.substring(0, 500)}`);
        } catch (e) {
          console.log(`    ⚠️ Bulk fetch failed: ${response.status}`);
        }
        continue;
      }

      const data = await response.json();

      // Process returned items
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.itemId) {
            results.set(item.itemId, item);
            // Cache for next time
            await cacheItemDetails(item.itemId, item);
            cacheStats.misses++;
          }
        }
        console.log(`    ✅ Bulk batch returned ${data.items.length} items`);
      }

      // Handle any errors for specific items
      if (data.errors && Array.isArray(data.errors)) {
        for (const error of data.errors) {
          console.log(`    ⚠️ Bulk fetch error for item: ${error.message || 'Unknown error'}`);
        }
      }

    } catch (err) {
      console.log(`    ⚠️ Bulk fetch error: ${err.message}`);
    }
  }

  return results;
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
  'na',  // eBay often uses "NA" without slash
  'not applicable',
  'not specified',
  'unknown',
  'no main stone',
  'no gemstone',
  ''
];

// Common stone keywords to detect in titles (when seller doesn't fill out specs)
const STONE_KEYWORDS = [
  'diamond', 'diamonds', 'morganite', 'sapphire', 'ruby', 'emerald',
  'amethyst', 'topaz', 'opal', 'pearl', 'aquamarine', 'garnet',
  'peridot', 'tanzanite', 'tourmaline', 'citrine', 'onyx', 'turquoise',
  'moissanite', 'cz', 'cubic zirconia', 'zirconia', 'crystal', 'crystals',
  'gemstone', 'gemstones', 'stone', 'stones', 'pave', 'pavé', 'halo',
  'solitaire', 'three stone', '3 stone', 'birthstone',
  'malachite', 'lapis', 'jade', 'coral', 'carnelian', 'agate', 'jasper',
  'moonstone', 'labradorite', 'alexandrite', 'iolite', 'spinel', 'zircon'
];

// Check if a value indicates "no stone"
function isNoStoneValue(value) {
  if (!value) return true; // Empty/missing means no stone
  return NO_STONE_VALUES.includes(value.toLowerCase().trim());
}

// Check if title contains stone keywords (backup check when specs are empty)
function titleContainsStone(title) {
  if (!title) return false;
  const titleLower = title.toLowerCase();
  return STONE_KEYWORDS.some(keyword => titleLower.includes(keyword));
}

// Check if item passes the item specifics filters
// aspectFiltersActive: object indicating which aspects were filtered at API level
function passesItemSpecificsFilter(specs, filters, aspectFiltersActive = {}) {
  // Check Base Metal / Metal - NOT available as aspect filter, must check here
  const baseMetal = specs['base metal']?.toLowerCase() || '';
  const metal = specs['metal']?.toLowerCase() || '';

  // If base metal contains "plated", "filled", or non-gold metals, reject
  const badMetals = ['plated', 'filled', 'steel', 'brass', 'bronze', 'copper', 'alloy'];
  for (const bad of badMetals) {
    if (baseMetal.includes(bad) || metal.includes(bad)) {
      return { pass: false, reason: `Base Metal/Metal contains "${bad}"` };
    }
  }

  // Check for "gold tone" / "goldtone" specifically (fake gold), but NOT "two-tone" or "tri-tone" (real gold)
  const isFakeTone = (value) => {
    if (!value) return false;
    // Reject "gold tone", "goldtone", "silvertone" etc., but allow "two-tone", "tri-tone", "two tone"
    return (value.includes('tone') &&
            !value.includes('two-tone') &&
            !value.includes('two tone') &&
            !value.includes('tri-tone') &&
            !value.includes('tri tone') &&
            !value.includes('bicolor') &&
            !value.includes('tricolor'));
  };

  if (isFakeTone(baseMetal) || isFakeTone(metal)) {
    return { pass: false, reason: `Base Metal/Metal appears to be fake tone (not two-tone/tri-tone gold)` };
  }

  // ALWAYS exclude items with main stones - we only want plain metal jewelry for scrap value
  // NOTE: We can't rely on aspect filter because it only works for 1 category
  // when searching across multiple subcategories.
  // eBay uses multiple field names for stones, so check all of them
  const mainStone = specs['main stone'] || '';
  const gemstone = specs['gemstone'] || '';
  const stone = specs['stone'] || '';  // Some sellers use just "Stone" field (e.g., "Malachite")
  const title = specs._title || '';

  // Debug log to see what values we're checking
  if (mainStone || gemstone || stone) {
    console.log(`    🔍 Stone check: Main Stone="${mainStone}", Gemstone="${gemstone}", Stone="${stone}"`);
  }

  // Check all stone fields - reject if any has a stone value
  // NOTE: We intentionally do NOT check "Main Stone Color" because that field
  // often contains metal/jewelry colors like "Pink" (rose gold), "Gold", "White"
  // which would cause false rejections for items without stones
  const hasStoneInSpecs = !isNoStoneValue(mainStone) || !isNoStoneValue(gemstone) || !isNoStoneValue(stone);

  if (hasStoneInSpecs) {
    return { pass: false, reason: `Has stone in specs: Main Stone="${mainStone}", Gemstone="${gemstone}", Stone="${stone}"` };
  }

  // BACKUP CHECK: If specs don't have stone info, check the title for stone keywords
  // This catches items where sellers didn't fill out the stone fields correctly
  if (isNoStoneValue(mainStone) && isNoStoneValue(gemstone) && isNoStoneValue(stone)) {
    if (titleContainsStone(title)) {
      const matchedKeyword = STONE_KEYWORDS.find(kw => title.toLowerCase().includes(kw));
      console.log(`    🔍 Title stone check: Found "${matchedKeyword}" in title`);
      return { pass: false, reason: `Title contains stone keyword: "${matchedKeyword}"` };
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
  // Look for various weight field names eBay might use (many sellers use different names)
  const weightSpec = specs['total weight'] || specs['item weight'] || specs['weight'] ||
                     specs['gram weight'] || specs['total gram weight'] || specs['metal weight(grams)'] ||
                     specs['total carat weight'] || specs['item weight (approx.)'] ||
                     specs['approximate weight'] || specs['metal weight'] ||
                     specs['chain weight'] || specs['necklace weight'] || specs['ring weight'] ||
                     specs['bracelet weight'] || specs['earring weight'] || specs['pendant weight'] ||
                     specs['gold weight'] || specs['silver weight'] || specs['platinum weight'] ||
                     specs['total metal weight'] || specs['net weight'] || specs['gross weight'] ||
                     specs['jewelry weight'] || '';

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
    // Debug: log if description exists but no weight found
    if (!itemWeight && (filters.weight_min || filters.weight_max)) {
      console.log(`    📝 Description exists (${cleanDesc.length} chars) but no weight parsed`);
      // Log first 200 chars to help debug
      if (cleanDesc.length > 0) {
        console.log(`    📝 Description preview: "${cleanDesc.substring(0, 200).replace(/\s+/g, ' ')}..."`);
      }
    }
  } else if (!itemWeight && !specs._description && (filters.weight_min || filters.weight_max)) {
    console.log(`    📝 No description returned from API for weight extraction`);
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
// API keys are now rotated per-call, not per-task
async function processTask(task) {
  // Mark task as running to prevent concurrent execution
  runningTasks.add(task.id);

  try {
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
    // Always exclude costume jewelry and jewelry tools/supplies
    allExclusions = [...allExclusions, ...COSTUME_JEWELRY_EXCLUSIONS, ...JEWELRY_TOOLS_EXCLUSIONS];
    console.log(`  🚫 Auto-excluding costume jewelry (${COSTUME_JEWELRY_EXCLUSIONS.length} terms) and tools/supplies (${JEWELRY_TOOLS_EXCLUSIONS.length} terms)`);

    // Log karat requirement status
    if (filters.metal?.some(m => m.toLowerCase().includes('gold'))) {
      if (REQUIRE_KARAT_MARKERS) {
        console.log(`  ✅ Requiring karat markers in TITLE (10k, 14k, 18k, etc.)`);
      } else {
        console.log(`  🔍 Checking karat in item specifics (not requiring in title)`);
      }
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
    // Each API call now gets its own credentials with round-robin rotation
    const items = await searchEbayAllMetals(task);

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
      .from('rejected_items')
      .select('ebay_listing_id')
      .eq('task_id', task.id)
      .gt('expires_at', new Date().toISOString());
    const rejectedItemIds = new Set((rejectedItems || []).map(r => r.ebay_listing_id));

    // Log cache status
    console.log(`  📋 Cache status: ${matchedItemIds.size} matched, ${rejectedItemIds.size} rejected (in cache)`);

    // Track skipped items for logging
    let skippedMatched = 0;
    let skippedRejected = 0;
    let skippedWrongCategory = 0; // Items from wrong categories
    let skippedByExclusion = 0; // Items excluded by keyword
    let skippedByPrice = 0; // Items outside price range
    let newRejections = 0; // Track items rejected this poll
    let detailFetchCount = 0;
    const maxDetailFetches = task.max_detail_fetches || 0; // 0 = unlimited

    // Track processed item IDs for debugging (first 10)
    const processedItemIds = [];

    if (maxDetailFetches > 0) {
      console.log(`  🔒 Max detail fetches per poll: ${maxDetailFetches}`);
    }

    // ============================================
    // PHASE 1: Filter items and collect candidates for detail fetching
    // ============================================
    const candidateItems = []; // Items that pass initial filters and need details

    for (const item of items) {
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

      // Validate category - eBay's API filter isn't 100% reliable
      // Items can slip through from other categories that match the search terms
      if (filters.subcategories?.length > 0 && item.categories?.length > 0) {
        const allowedCategories = new Set(filters.subcategories.map(String));
        const itemCategories = item.categories.map(c => String(c.categoryId));
        const isInAllowedCategory = itemCategories.some(catId => allowedCategories.has(catId));

        if (!isInAllowedCategory) {
          // Item is from a wrong category - skip it
          skippedWrongCategory++;
          continue;
        }
      }

      // Extract price
      const price = parseFloat(item.price?.value || 0);

      // Skip if under min price or over max price
      if (task.min_price && price < task.min_price) {
        skippedByPrice++;
        continue;
      }
      if (task.max_price && price > task.max_price) {
        skippedByPrice++;
        continue;
      }

      // Skip if title contains excluded keywords (manual + auto metal exclusions)
      const titleLower = item.title.toLowerCase();

      // Check exclusions and skip if matched
      if (allExclusions.length > 0) {
        const matchedKeyword = allExclusions.find(keyword =>
          titleLower.includes(keyword.toLowerCase())
        );
        if (matchedKeyword) {
          skippedByExclusion++;
          continue;
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

      // This item passes initial filters - add to candidates
      candidateItems.push({ item, price, titleLower });
    }

    // Re-sort candidates by listing date (newest first) with priority for very recent items
    // This ensures newest items are processed first even after cache filtering
    const PRIORITY_MINUTES = 10; // Items listed in last 10 minutes get priority
    const priorityCutoff = Date.now() - (PRIORITY_MINUTES * 60 * 1000);

    candidateItems.sort((a, b) => {
      const dateA = a.item.itemCreationDate ? new Date(a.item.itemCreationDate) : new Date(0);
      const dateB = b.item.itemCreationDate ? new Date(b.item.itemCreationDate) : new Date(0);

      const aIsPriority = dateA.getTime() > priorityCutoff;
      const bIsPriority = dateB.getTime() > priorityCutoff;

      // Priority items (last 10 min) always come first
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;

      // Within same priority level, sort by date (newest first)
      return dateB - dateA;
    });

    // Count priority items for logging
    const priorityCount = candidateItems.filter(c =>
      c.item.itemCreationDate && new Date(c.item.itemCreationDate).getTime() > priorityCutoff
    ).length;

    console.log(`  📋 ${candidateItems.length} items passed initial filters (${priorityCount} from last ${PRIORITY_MINUTES} min)`);

    // ============================================
    // PHASE 2: Bulk fetch item details for all candidates
    // ============================================
    let itemDetailsMap = new Map();

    if (task.item_type === 'jewelry' && candidateItems.length > 0) {
      // Apply max detail fetch limit
      let itemsToFetch = candidateItems;
      if (maxDetailFetches > 0 && candidateItems.length > maxDetailFetches) {
        console.log(`  🔒 Limiting to ${maxDetailFetches} items (from ${candidateItems.length})`);
        itemsToFetch = candidateItems.slice(0, maxDetailFetches);
      }

      const itemIds = itemsToFetch.map(c => c.item.itemId);
      itemDetailsMap = await fetchItemDetailsBulk(itemIds);
      detailFetchCount = itemIds.length; // Count all fetched items
    }

    // ============================================
    // PHASE 3: Process each candidate with pre-fetched details
    // ============================================
    for (const { item, price, titleLower } of candidateItems) {
      // Check if we've hit the detail fetch limit
      if (maxDetailFetches > 0 && processedItemIds.length >= maxDetailFetches) {
        console.log(`  ⏹️ Reached max detail fetch limit (${maxDetailFetches}), stopping`);
        break;
      }

      // For jewelry tasks, use pre-fetched item details
      let itemDetails = null;
      let specs = {};
      if (task.item_type === 'jewelry') {
        itemDetails = itemDetailsMap.get(item.itemId);

        // Track first 10 processed item IDs for debugging
        if (processedItemIds.length < 10) {
          processedItemIds.push(item.itemId);
        }
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
            await supabase.from('rejected_items').upsert({
              task_id: task.id,
              ebay_listing_id: item.itemId,
              rejection_reason: specsCheck.reason,
              rejected_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
            }, { onConflict: 'task_id,ebay_listing_id' });
            newRejections++;
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

      // Variables for Slack notification (set in jewelry block)
      let karat = null;
      let weightG = null;
      let meltValue = null;
      let metalType = null;
      let purity = null;

      // Add type-specific fields
      if (task.item_type === 'watch') {
        // Extract watch-specific details from item specifics
        const caseMaterial = extractWatchCaseMaterial(item.title, specs);
        const bandMaterial = extractWatchBandMaterial(item.title, specs);
        const movement = extractWatchMovement(item.title, specs);
        const dialColor = extractWatchDialColor(item.title, specs);
        const watchYear = extractWatchYear(item.title, specs);
        const watchBrand = extractWatchBrand(item.title, specs);
        const watchModel = extractWatchModel(item.title, specs);

        // Store extracted values
        match.case_material = caseMaterial || 'Unknown';
        match.band_material = bandMaterial || 'Unknown';
        match.movement = movement || 'Unknown';
        match.dial_colour = dialColor || 'Unknown';
        if (watchYear) match.year_manufactured = watchYear;
        if (watchBrand) match.brand = watchBrand;
        if (watchModel) match.model = watchModel;

        // Log extracted watch details
        console.log(`    ⌚ Watch details: Brand=${watchBrand || '?'}, Movement=${movement || '?'}, Case=${caseMaterial || '?'}, Year=${watchYear || '?'}`);

        // Year range filtering (post-processing)
        const filters = task.watch_filters || {};
        if (filters.year_from || filters.year_to) {
          if (watchYear) {
            const yearFrom = filters.year_from || 0;
            const yearTo = filters.year_to || 9999;
            if (watchYear < yearFrom || watchYear > yearTo) {
              const reason = `Year ${watchYear} outside range ${yearFrom}-${yearTo}`;
              console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await sendTestSellerNotification(item, 'REJECTED', reason, karat, weightG, price, shippingCost, meltValue);

              // Cache the rejection
              try {
                await supabase.from('rejected_items').upsert({
                  task_id: task.id,
                  ebay_listing_id: item.itemId,
                  rejection_reason: reason,
                  expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                }, { onConflict: 'task_id,ebay_listing_id' });
              } catch (e) {
                // Ignore cache errors
              }
              continue;
            }
          } else {
            // If year filter is set but we couldn't extract year, log it but don't reject
            console.log(`    ⚠️ Year filter set but couldn't extract year from: ${item.title.substring(0, 40)}...`);
          }
        }

        // Case material post-filtering (if specified in filters but not matched by eBay API)
        if (filters.case_material && caseMaterial) {
          const filterMaterial = filters.case_material.toLowerCase();
          const itemMaterial = caseMaterial.toLowerCase();
          if (!itemMaterial.includes(filterMaterial) && !filterMaterial.includes(itemMaterial)) {
            const reason = `Case material "${caseMaterial}" doesn't match filter "${filters.case_material}"`;
            console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await sendTestSellerNotification(item, 'REJECTED', reason, karat, weightG, price, shippingCost, meltValue);

            try {
              await supabase.from('rejected_items').upsert({
                task_id: task.id,
                ebay_listing_id: item.itemId,
                rejection_reason: reason,
                expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
              }, { onConflict: 'task_id,ebay_listing_id' });
            } catch (e) {
              // Ignore cache errors
            }
            continue;
          }
        }
      } else if (task.item_type === 'jewelry') {
        match.metal_type = 'Unknown';

        // Detect metal type (gold, silver, platinum, palladium)
        const description = itemDetails?.description || '';

        // DEBUG: Log description info
        if (DEBUG_WEIGHT || DEBUG_KARAT) {
          console.log(`    🔬 [DEBUG] Item: ${item.itemId}`);
          console.log(`    🔬 [DEBUG] Title: ${item.title.substring(0, 70)}...`);
          if (description) {
            console.log(`    🔬 [DEBUG] Description received: ${description.length} chars`);
            // Show first 200 chars of raw description to see HTML/entities
            console.log(`    🔬 [DEBUG] Raw desc preview: "${description.substring(0, 200).replace(/\n/g, '\\n')}..."`);
          } else {
            console.log(`    🔬 [DEBUG] No description returned from eBay API!`);
          }
        }

        metalType = detectMetalType(item.title, specs);
        weightG = extractWeight(item.title, specs, description);

        // Extract purity based on metal type
        if (metalType === 'gold') {
          karat = extractKarat(item.title, specs);
          purity = karat;
          if (!karat) {
            console.log(`    ⚠️ No karat found for gold - will save for manual review: ${item.title.substring(0, 40)}...`);
          }
        } else if (metalType === 'silver') {
          purity = extractSilverPurity(item.title, specs);
          console.log(`    🥈 Silver detected (purity: ${purity || 'unknown'}): ${item.title.substring(0, 40)}...`);
        } else if (metalType === 'platinum') {
          purity = extractPlatinumPurity(item.title, specs);
          console.log(`    💎 Platinum detected (purity: ${purity || 'unknown'}): ${item.title.substring(0, 40)}...`);
        } else if (metalType === 'palladium') {
          purity = 950; // Default palladium purity
          console.log(`    🔷 Palladium detected: ${item.title.substring(0, 40)}...`);
        } else {
          console.log(`    ⚠️ Unknown metal type - will save for manual review: ${item.title.substring(0, 40)}...`);
        }

        // Debug: log if we couldn't find weight
        if (!weightG) {
          console.log(`    ⚠️ No weight found for: ${item.title.substring(0, 50)}...`);
          if (description) {
            console.log(`    📝 Description available (${description.length} chars)`);
          } else {
            console.log(`    📝 No description from API`);
          }
        }

        // Store extracted values in match
        if (metalType) {
          match.metal_type = metalType.charAt(0).toUpperCase() + metalType.slice(1); // Capitalize
        }
        if (karat) {
          match.karat = karat;
        }
        if (weightG) {
          match.weight_g = weightG;
        }

        // Calculate melt value based on metal type
        if (purity && weightG) {
          const metalPrices = await getMetalPrices();
          if (metalPrices) {
            // Calculate melt value based on detected metal type
            if (metalType === 'gold' && metalPrices.Gold) {
              meltValue = calculateGoldMeltValue(karat, weightG, metalPrices.Gold);
            } else if (metalType === 'silver' && metalPrices.Silver) {
              meltValue = calculateSilverMeltValue(purity, weightG, metalPrices.Silver);
            } else if (metalType === 'platinum' && metalPrices.Platinum) {
              meltValue = calculatePlatinumMeltValue(purity, weightG, metalPrices.Platinum);
            } else if (metalType === 'palladium' && metalPrices.Palladium) {
              // Use platinum calculation logic for palladium (similar purity system)
              meltValue = calculatePlatinumMeltValue(purity, weightG, metalPrices.Palladium);
            }

            if (meltValue) {
              match.melt_value = meltValue;
              // Profit = melt value - (listed price + shipping)
              const totalCost = price + shippingCost;
              match.profit_scrap = meltValue - totalCost;

              // Reject items where break-even is not more than 50% of cost
              // This ensures you can recover at least 50% of your cost from melt value
              const breakEven = meltValue * 0.97;
              const profitMarginPct = ((breakEven - totalCost) / totalCost) * 100;
              if (breakEven <= totalCost * 0.5) {
                const reason = `Low margin ${profitMarginPct.toFixed(0)}% - break-even $${breakEven.toFixed(0)} <= 50% of cost $${totalCost.toFixed(0)}`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await sendTestSellerNotification(item, 'REJECTED', reason, karat, weightG, price, shippingCost, meltValue);

                // Cache the rejection so we don't re-fetch details for this item
                try {
                  await supabase.from('rejected_items').upsert({
                    task_id: task.id,
                    ebay_listing_id: item.itemId,
                    rejection_reason: reason,
                    rejected_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
                  }, { onConflict: 'task_id,ebay_listing_id' });
                  newRejections++;
                } catch (e) {
                  // Don't let cache errors break the flow
                }

                continue;
              }
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

        // Send Slack notification for jewelry matches
        if (task.item_type === 'jewelry') {
          await sendSlackNotification(match, item, karat, weightG, shippingCost, meltValue);
          await sendTestSellerNotification(item, 'SAVED', null, karat, weightG, price, shippingCost, meltValue);
        }
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
    if (skippedMatched > 0 || skippedRejected > 0 || newRejections > 0 || skippedWrongCategory > 0 || skippedByExclusion > 0 || skippedByPrice > 0) {
      const skipParts = [];
      if (skippedMatched > 0) skipParts.push(`${skippedMatched} already matched`);
      if (skippedRejected > 0) skipParts.push(`${skippedRejected} previously rejected`);
      if (skippedWrongCategory > 0) skipParts.push(`${skippedWrongCategory} wrong category`);
      if (skippedByExclusion > 0) skipParts.push(`${skippedByExclusion} excluded keywords`);
      if (skippedByPrice > 0) skipParts.push(`${skippedByPrice} outside price range`);
      console.log(`  ⏭️ Skipped: ${skipParts.join(', ')}`);
      if (newRejections > 0) {
        console.log(`  🚫 Cached ${newRejections} new rejections (will skip for 48h)`);
      }
    }

    // Log cache stats for jewelry tasks (where we fetch item details)
    if (task.item_type === 'jewelry') {
      const stats = getCacheStats();
      console.log(`  📦 Cache stats: ${stats.hits} hits, ${stats.misses} misses (${stats.hitRate}% hit rate)`);

      // Log first 10 processed item IDs for debugging duplicate processing
      if (processedItemIds.length > 0) {
        console.log(`  🔍 First ${processedItemIds.length} items processed this poll:`);
        processedItemIds.forEach((id, idx) => {
          console.log(`      ${idx + 1}. ${id}`);
        });
        console.log(`  💡 If these IDs are the same each poll, the rejection cache is not working.`);
        console.log(`  💡 If they're different each poll, the cache IS working and you're progressing through the list.`);
      }
    }

  } catch (error) {
    // Handle rate limiting specially - mark key so it's skipped in rotation
    if (error instanceof RateLimitError) {
      markKeyRateLimited(error.credentials.app_id, error.credentials.label);
      // Next API call will automatically use a different key (round-robin)
      console.error(`  ⚠️ Rate limited, will use different key for next calls`);
    } else {
      console.error(`  Error: ${error.message}`);
    }
  }
  } finally {
    // Always remove task from running set when done (success or error)
    runningTasks.delete(task.id);
  }
}

// Helper: delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: process a batch of tasks with staggered starts
// API keys are rotated per-call automatically
async function processTaskBatch(tasks) {
  const promises = tasks.map((task, index) => {
    return new Promise(async (resolve) => {
      // Stagger the start of each task
      await delay(index * STAGGER_DELAY);
      await processTask(task);
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

    // Clean up expired rejected items cache (new table)
    const { data: rejectedData } = await supabase
      .from('rejected_items')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('ebay_listing_id');

    const cacheCount = cacheData?.length || 0;
    const rejectedCount = rejectedData?.length || 0;

    if (cacheCount > 0 || rejectedCount > 0) {
      console.log(`  🧹 Cleaned up ${cacheCount} expired cache entries, ${rejectedCount} expired rejections`);
    }
  } catch (e) {
    // Cache cleanup errors shouldn't break the flow
  }
}

// Check if a task is due to run based on its poll_interval and last_run
function isTaskDue(task) {
  // Skip if task is already running
  if (runningTasks.has(task.id)) {
    return false;
  }

  const pollInterval = (task.poll_interval || DEFAULT_POLL_INTERVAL) * 1000; // Convert to ms
  const lastRun = task.last_run ? new Date(task.last_run).getTime() : 0;
  const now = Date.now();
  const timeSinceLastRun = now - lastRun;

  return timeSinceLastRun >= pollInterval;
}

// Get time until next run for a task (for logging)
function getTimeUntilNextRun(task) {
  const pollInterval = (task.poll_interval || DEFAULT_POLL_INTERVAL) * 1000;
  const lastRun = task.last_run ? new Date(task.last_run).getTime() : 0;
  const now = Date.now();
  const timeSinceLastRun = now - lastRun;
  const timeUntilNext = Math.max(0, pollInterval - timeSinceLastRun);

  return Math.ceil(timeUntilNext / 1000); // Return in seconds
}

// Main polling loop - runs frequently to check which tasks are due
async function poll() {
  const pollStartTime = Date.now();
  lastPollTime = new Date().toISOString();
  lastPollStatus = 'running';

  try {
    // Cleanup expired cache entries periodically (every 60 cycles = ~1 minute)
    if (pollCycleCount % 60 === 0) {
      await cleanupExpiredCache();
    }

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
      // Only log "no active tasks" occasionally to reduce noise
      if (pollCycleCount % 30 === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] No active tasks`);
      }
      return;
    }

    // Filter to only tasks that are due to run
    const dueTasks = tasks.filter(isTaskDue);

    if (dueTasks.length === 0) {
      // Log waiting status occasionally (every 10 seconds)
      if (pollCycleCount % 10 === 0) {
        const waitingInfo = tasks.map(t => `${t.name}: ${getTimeUntilNextRun(t)}s`).join(', ');
        console.log(`[${new Date().toLocaleTimeString()}] Waiting... (${waitingInfo})`);
      }
      return;
    }

    // Log available API keys count
    try {
      const allKeys = await getAllEbayCredentials();
      const availableKeys = allKeys.filter(k => !isKeyRateLimited(k.app_id) && k.status !== 'rate_limited' && k.status !== 'error');
      console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 Running ${dueTasks.length}/${tasks.length} due task(s) with ${availableKeys.length}/${allKeys.length} API keys...`);
    } catch (e) {
      console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 Running ${dueTasks.length}/${tasks.length} due task(s)...`);
    }

    // Log which tasks are running with their poll intervals
    dueTasks.forEach(task => {
      const interval = task.poll_interval || DEFAULT_POLL_INTERVAL;
      console.log(`  📋 ${task.name} (every ${interval}s)`);
    });

    // Process due tasks in batches with staggered parallel execution
    for (let i = 0; i < dueTasks.length; i += MAX_CONCURRENT_TASKS) {
      const batch = dueTasks.slice(i, i + MAX_CONCURRENT_TASKS);
      const batchNum = Math.floor(i / MAX_CONCURRENT_TASKS) + 1;
      const totalBatches = Math.ceil(dueTasks.length / MAX_CONCURRENT_TASKS);

      if (totalBatches > 1) {
        console.log(`\n  Batch ${batchNum}/${totalBatches} (${batch.length} tasks):`);
      }

      await processTaskBatch(batch);
    }

    lastPollStatus = 'success';
  } catch (error) {
    console.error('Poll error:', error.message);
    lastPollStatus = `error: ${error.message}`;
  } finally {
    // Log performance after each poll that actually ran tasks
    const pollDuration = Date.now() - pollStartTime;
    if (pollDuration > 100) { // Only log if poll took significant time
      logPollPerformance(pollDuration);
    }

    // Log memory every 300 polls (~5 minutes at 1s interval)
    if (pollCycleCount % 300 === 0) {
      logMemoryStats(`After Poll #${pollCycleCount}`);
    }
  }
}

// Start the worker
async function start() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 CONTINUOUS POLLING MODE');
  console.log(`${'='.repeat(60)}`);
  console.log(`Main loop interval: ${MAIN_LOOP_INTERVAL / 1000}s`);
  console.log(`Max concurrent tasks: ${MAX_CONCURRENT_TASKS}`);
  console.log(`Default task poll interval: ${DEFAULT_POLL_INTERVAL}s`);
  console.log(`${'='.repeat(60)}\n`);

  // Increment poll cycle count for each loop
  pollCycleCount++;

  // Initial poll
  await poll();

  // Continue polling at high frequency (default 1 second)
  // Each poll checks which tasks are due based on their individual poll_interval
  pollInterval = setInterval(() => {
    pollCycleCount++;
    poll();
  }, MAIN_LOOP_INTERVAL);

  console.log(`\nWorker running. Checking for due tasks every ${MAIN_LOOP_INTERVAL / 1000} second(s)...`);
  console.log('Tasks run based on their individual poll_interval settings.');
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

  // Log final performance summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log('📈 PERFORMANCE SUMMARY');
  console.log(`${'─'.repeat(50)}`);
  console.log(`Total poll cycles: ${pollCycleCount}`);
  if (pollCycleCount > 0) {
    const avgTime = totalPollTime / pollCycleCount;
    console.log(`Poll time - Avg: ${avgTime.toFixed(0)}ms | Min: ${minPollTime.toFixed(0)}ms | Max: ${maxPollTime.toFixed(0)}ms`);
    console.log(`Total poll time: ${(totalPollTime / 1000).toFixed(1)}s`);
  }
  logMemoryStats('Final');
  console.log(`${'─'.repeat(50)}`);

  console.log('Worker stopped.');
  console.log('='.repeat(50));

  // Close log file stream
  logStream.end();

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => shutdown('SIGTERM')); // kill command
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});

// ============================================
// Browse API Test Function (for comparison)
// ============================================
async function testBrowseApiDescription(itemId) {
  console.log(`\n🧪 Testing Browse API getItem for item: ${itemId}`);

  try {
    const credentials = await getEbayCredentials();
    console.log(`   Using credentials: ${credentials.label || credentials.app_id}`);

    const token = await getEbayToken(credentials);
    if (!token) {
      console.log('❌ Failed to get OAuth token');
      return null;
    }

    const url = `https://api.ebay.com/buy/browse/v1/item/v1|${itemId}|0`;

    console.log(`📡 Calling Browse API...`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Browse API error: ${response.status}`);
      const text = await response.text();
      console.log(`Response: ${text.substring(0, 500)}`);
      return null;
    }

    const item = await response.json();

    console.log(`\n✅ SUCCESS! Got item data:`);
    console.log(`   Title: ${item.title}`);
    console.log(`   Price: $${item.price?.value}`);

    // Check for description
    if (item.description) {
      const cleanDesc = item.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`   Description length: ${item.description.length} chars`);
      console.log(`   Description preview: "${cleanDesc.substring(0, 300)}..."`);

      // Try to find weight
      const weightMatch = cleanDesc.match(/(?:weight|weighs|wt)[:\s]+(\d+\.?\d*)\s*(?:g|gr|gram|grams)\b/i) ||
                          cleanDesc.match(/(\d+\.?\d*)\s*(?:g|gr|gram|grams)\b/i);
      if (weightMatch) {
        console.log(`\n   🎯 FOUND WEIGHT: ${weightMatch[1]} grams`);
      } else {
        console.log(`\n   ⚠️ No weight pattern found in description`);
      }
    } else {
      console.log(`   ❌ No description field returned`);
    }

    // Check item specifics
    if (item.localizedAspects) {
      console.log(`\n   Item Specifics (localizedAspects):`);
      for (const spec of item.localizedAspects) {
        console.log(`     - ${spec.name}: ${spec.value}`);
      }
    }

    // Show all top-level keys to see what's available
    console.log(`\n   Available fields: ${Object.keys(item).join(', ')}`);

    return item;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

// ============================================
// Shopping API Test Function
// ============================================
async function testShoppingApiDescription(itemId) {
  console.log(`\n🧪 Testing Shopping API GetSingleItem for item: ${itemId}`);

  try {
    // Get OAuth token (same as Browse API)
    const credentials = await getEbayCredentials();
    console.log(`   Using credentials: ${credentials.label || credentials.app_id}`);

    const token = await getEbayToken(credentials);
    if (!token) {
      console.log('❌ Failed to get OAuth token');
      return null;
    }

    const url = `https://open.api.ebay.com/shopping?callname=GetSingleItem&version=967&ItemID=${itemId}&IncludeSelector=Description,ItemSpecifics,Details&responseencoding=JSON`;

    console.log(`📡 Calling Shopping API...`);

    const response = await fetch(url, {
      headers: {
        'X-EBAY-API-IAF-TOKEN': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Shopping API error: ${response.status}`);
      const text = await response.text();
      console.log(`Response: ${text.substring(0, 500)}`);
      return null;
    }

    const data = await response.json();

    if (data.Ack === 'Failure') {
      console.log(`❌ API returned failure:`, data.Errors);
      return null;
    }

    const item = data.Item;
    console.log(`\n✅ SUCCESS! Got item data:`);
    console.log(`   Title: ${item.Title}`);
    console.log(`   Price: $${item.ConvertedCurrentPrice?.Value || item.CurrentPrice?.Value}`);

    // Check for description
    if (item.Description) {
      const cleanDesc = item.Description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`   Description length: ${item.Description.length} chars`);
      console.log(`   Description preview: "${cleanDesc.substring(0, 300)}..."`);

      // Try to find weight in description
      const weightMatch = cleanDesc.match(/(?:weight|weighs|wt)[:\s]+(\d+\.?\d*)\s*(?:g|gr|gram|grams)\b/i) ||
                          cleanDesc.match(/(\d+\.?\d*)\s*(?:g|gr|gram|grams)\b/i);
      if (weightMatch) {
        console.log(`\n   🎯 FOUND WEIGHT: ${weightMatch[1]} grams`);
      } else {
        console.log(`\n   ⚠️ No weight pattern found in description`);
      }
    } else {
      console.log(`   ❌ No description returned`);
    }

    // Check item specifics
    if (item.ItemSpecifics?.NameValueList) {
      console.log(`\n   Item Specifics:`);
      for (const spec of item.ItemSpecifics.NameValueList) {
        console.log(`     - ${spec.Name}: ${spec.Value}`);
      }
    }

    return data;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

// Run test if called with test flags, otherwise start worker
if (process.argv.includes('--test-shopping')) {
  const itemId = process.argv[process.argv.indexOf('--test-shopping') + 1] || '397097599947';
  testShoppingApiDescription(itemId).then(() => process.exit(0));
} else if (process.argv.includes('--test-browse')) {
  const itemId = process.argv[process.argv.indexOf('--test-browse') + 1] || '397097599947';
  testBrowseApiDescription(itemId).then(() => process.exit(0));
} else if (process.argv.includes('--test-both')) {
  const itemId = process.argv[process.argv.indexOf('--test-both') + 1] || '397097599947';
  (async () => {
    console.log('='.repeat(50));
    console.log('COMPARING BROWSE API vs SHOPPING API');
    console.log('='.repeat(50));
    await testBrowseApiDescription(itemId);
    console.log('\n' + '-'.repeat(50) + '\n');
    await testShoppingApiDescription(itemId);
    console.log('\n' + '='.repeat(50));
    process.exit(0);
  })();
} else {
  start();
}
