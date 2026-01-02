// ============================================
// eBay Hunter Worker - Node.js Version
// Runs continuously on Digital Ocean Droplet
// ============================================

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '1000', 10);

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Slack webhook URL (optional)
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

// Test seller username - listings from this seller bypass all filters
const TEST_SELLER_USERNAME = process.env.TEST_SELLER_USERNAME || 'pe952597';

// Track test listings we've already notified about (in-memory cache)
const notifiedTestListings = new Set<string>();

// ============================================
// Slack Notification Functions
// ============================================

// Special notification for test listings (bypasses all filters)
async function sendTestListingNotification(item: any): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  try {
    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🧪 *TEST LISTING DETECTED*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${item.title.substring(0, 150)}*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `💰 $${item.price} | Seller: ${item.sellerInfo?.name || 'Unknown'}`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View on eBay", emoji: true },
              url: item.listingUrl,
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
      console.log(`⚠️ Test listing Slack notification failed: ${response.status}`);
    } else {
      console.log(`🧪 Test listing notification sent!`);
    }
  } catch (error) {
    console.error('❌ Error sending test listing notification:', error);
  }
}

async function sendJewelrySlackNotification(
  match: any,
  karat: number | null,
  weightG: number | null,
  shippingCost: number,
  meltValue: number | null
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  try {
    const totalCost = match.listed_price + shippingCost;
    const offerPrice = (totalCost * 0.87).toFixed(0);
    const breakEven = meltValue ? meltValue * 0.97 : null;
    const profit = breakEven ? (breakEven - totalCost).toFixed(0) : null;
    const profitMarginPct = breakEven && totalCost > 0 ? ((breakEven - totalCost) / totalCost * 100).toFixed(0) : null;
    const profitDisplay = profit ? `$${profit} (${profitMarginPct}%)` : '?';

    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${match.ebay_title.substring(0, 150)}*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `💍 *$${totalCost}* total | *${karat || '?'}K* | *${weightG ? weightG.toFixed(2) + 'g' : '?'}* | Offer: *$${offerPrice}* | Profit: *${profitDisplay}*`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View on eBay", emoji: true },
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
      console.log(`⚠️ Slack notification failed: ${response.status}`);
    }
  } catch (error: any) {
    console.log(`⚠️ Slack notification error: ${error.message}`);
  }
}

async function sendGemstoneSlackNotification(
  match: any,
  stone: any,
  dealScore: number,
  riskScore: number
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  try {
    const scoreEmoji = dealScore >= 80 ? '🔥' : dealScore >= 60 ? '💎' : '📋';
    const riskEmoji = riskScore >= 50 ? '⚠️' : riskScore >= 30 ? '🔶' : '✅';
    const riskText = riskScore >= 50 ? 'High' : riskScore >= 30 ? 'Med' : 'Low';

    const stoneDetails = [
      stone.shape || '?',
      stone.color || '?',
      stone.clarity || '?',
      stone.certification || 'No Cert'
    ].join(' | ');

    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${scoreEmoji} *${stone.carat ? stone.carat.toFixed(2) + 'ct' : '?ct'} ${stone.stone_type || 'Stone'}* - $${match.listed_price}\n${stoneDetails} | Deal: *${dealScore}* | Risk: ${riskEmoji}${riskText}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: match.ebay_title.substring(0, 150)
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View on eBay", emoji: true },
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
      console.log(`⚠️ Gemstone Slack notification failed: ${response.status}`);
    }
  } catch (error: any) {
    console.log(`⚠️ Gemstone Slack notification error: ${error.message}`);
  }
}

// ============================================
// Watch Extraction Functions
// ============================================

function extractWatchCaseMaterial(title: string, specs: Record<string, string> = {}): string | null {
  const caseMaterial = specs['case material'] || specs['case/bezel material'] || specs['material'] || '';
  if (caseMaterial) return caseMaterial;

  const titleLower = title.toLowerCase();
  const materials = [
    'stainless steel', 'steel', 'titanium', 'gold', 'rose gold', 'white gold',
    'yellow gold', 'platinum', 'ceramic', 'carbon fiber', 'bronze', 'brass',
    'plastic', 'resin', 'aluminum', 'silver'
  ];

  for (const material of materials) {
    if (titleLower.includes(material)) {
      return material.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

function extractWatchBandMaterial(title: string, specs: Record<string, string> = {}): string | null {
  const bandMaterial = specs['band material'] || specs['band/strap material'] ||
                       specs['strap material'] || specs['bracelet material'] || '';
  if (bandMaterial) return bandMaterial;

  const titleLower = title.toLowerCase();
  const materials = ['leather', 'rubber', 'silicone', 'nato', 'nylon', 'canvas',
                     'stainless steel', 'steel', 'mesh', 'bracelet', 'gold', 'titanium'];

  for (const material of materials) {
    if (titleLower.includes(material + ' band') ||
        titleLower.includes(material + ' strap') ||
        titleLower.includes(material + ' bracelet')) {
      return material.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

function extractWatchMovement(title: string, specs: Record<string, string> = {}): string | null {
  const movement = specs['movement'] || specs['watch movement'] || specs['movement type'] || '';
  if (movement) return movement;

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
    if (pattern.test(title)) return value;
  }
  return null;
}

function extractWatchDialColor(title: string, specs: Record<string, string> = {}): string | null {
  const dialColor = specs['dial color'] || specs['dial colour'] || specs['face color'] || '';
  if (dialColor) return dialColor;

  const colorMatch = title.match(/(black|white|blue|green|silver|gold|grey|gray|red|brown|champagne|mother of pearl|mop)\s*dial/i);
  if (colorMatch) {
    const color = colorMatch[1];
    return color.charAt(0).toUpperCase() + color.slice(1);
  }
  return null;
}

function extractWatchYear(title: string, specs: Record<string, string> = {}): number | null {
  const yearFields = ['year manufactured', 'year', 'year of manufacture',
                      'manufacture year', 'model year', 'production year'];

  for (const field of yearFields) {
    const value = specs[field];
    if (value) {
      const yearMatch = value.match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year >= 1800 && year <= new Date().getFullYear() + 1) return year;
      }
    }
  }

  const yearMatch = title.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1900 && year <= new Date().getFullYear() + 1) return year;
  }
  return null;
}

function extractWatchBrand(title: string, specs: Record<string, string> = {}): string | null {
  const brand = specs['brand'] || '';
  if (brand && brand.toLowerCase() !== 'unbranded') return brand;

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
    if (titleLower.includes(b.toLowerCase())) return b;
  }
  return null;
}

function extractWatchModel(title: string, specs: Record<string, string> = {}): string | null {
  const model = specs['model'] || specs['model number'] || '';
  if (model) return model;
  return null;
}

// ============================================
// Metal Exclusion Keywords
// ============================================

const METAL_KEYWORDS: Record<string, string[]> = {
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
};

/**
 * Get exclusion keywords based on metals NOT selected
 * Returns keywords that should be excluded from search to avoid non-selected metals
 */
function getMetalExclusionKeywords(selectedMetals: string[]): string[] {
  if (!selectedMetals || selectedMetals.length === 0) {
    return []; // No metals selected = no auto-exclusions
  }

  const exclusions = new Set<string>();
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
// Gemstone Constants
// ============================================

const GEMSTONE_TYPES = [
  'Diamond', 'Ruby', 'Sapphire', 'Emerald', 'Alexandrite',
  'Spinel', 'Tanzanite', 'Tourmaline', 'Garnet', 'Aquamarine',
  'Morganite', 'Amethyst', 'Citrine', 'Topaz', 'Peridot',
  'Opal', 'Jade', 'Turquoise', 'Zircon', 'Tsavorite',
  'Paraiba', 'Padparadscha', 'Kunzite', 'Beryl', 'Chrysoberyl'
];

const STONE_SHAPES = [
  'Round', 'Oval', 'Cushion', 'Princess', 'Emerald', 'Radiant',
  'Asscher', 'Marquise', 'Pear', 'Heart', 'Trillion', 'Baguette',
  'Square', 'Octagon', 'Cabochon', 'Rose Cut', 'Old Mine', 'Old European'
];

const DIAMOND_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
const DIAMOND_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'];

const CERT_LABS = {
  premium: ['GIA', 'AGS', 'AGL', 'Gubelin', 'SSEF', 'GRS'],
  standard: ['IGI', 'GCAL', 'HRD', 'CGL'],
  budget: ['EGL', 'GSI', 'IGL', 'Other']
};

// Gemstone blacklist - simulants and fakes
const GEMSTONE_BLACKLIST = [
  'cz', 'cubic zirconia', 'cubic zircona', 'moissanite', 'moissonite',
  'simulant', 'simulated', 'faux', 'fake', 'imitation',
  'lab created', 'lab-created', 'lab grown', 'lab-grown',
  'synthetic', 'man made', 'man-made', 'cultured diamond',
  'glass', 'crystal', 'rhinestone', 'acrylic', 'plastic', 'resin',
  'diamonique', 'swarovski', 'yag', 'ggg', 'strontium titanate',
  'doublet', 'triplet', 'composite', 'assembled'
];

const LAB_CREATED_TERMS = [
  'lab created', 'lab-created', 'lab grown', 'lab-grown',
  'synthetic', 'man made', 'man-made', 'cultured diamond', 'cvd', 'hpht'
];

// eBay category IDs for gemstones (to filter out machinery/tools)
const GEMSTONE_CATEGORY_IDS = ['10207', '51089', '164694', '262026', '262027'];

// eBay category IDs for jewelry (based on actual eBay leaf categories from API responses)
// Parent categories
const JEWELRY_CATEGORY_IDS = [
  '281',      // Jewelry & Watches (parent)
  '164331',   // Fine Jewelry (parent)
  '67681',    // Fashion Jewelry (parent)
  '67680',    // Vintage & Antique Jewelry (parent)
  '261990',   // Men's Jewelry (parent)
  // Fine Jewelry leaf categories (261xxx-262xxx range)
  '261988',   // Fine Bracelets
  '261989',   // Fine Pins & Brooches
  '261993',   // Fine Pendants
  '261994',   // Fine Rings
  '261995',   // Fine Necklaces
  '262003',   // Fine Bracelets (alt)
  '262004',   // Fine Brooches & Pins
  '262008',   // Fine Earrings
  '262011',   // Fine Necklaces (alt)
  '262013',   // Fine Pendants (alt)
  '262014',   // Fine Jewelry (general)
  '262016',   // Fine Jewelry Lots
  '261975',   // Themed Fine Jewelry
  // Fashion Jewelry leaf categories
  '50637',    // Fashion Rings
  '155101',   // Fashion Necklaces & Pendants
  '50610',    // Fashion Bracelets
  '50647',    // Fashion Earrings
  '50692',    // Fashion Jewelry Sets
  // Vintage Jewelry leaf categories
  '48579',    // Vintage Rings
  '48585',    // Vintage Necklaces
  '48583',    // Vintage Bracelets
  '48581',    // Vintage Earrings
  // Other jewelry
  '110633',   // Loose Diamonds & Gemstones
  '75576',    // Designer Jewelry
];

// Categories to explicitly REJECT (not jewelry)
const JEWELRY_BLACKLIST_CATEGORIES = [
  '182901',   // Welding equipment
  '262017',   // Jewelry Boxes/Storage
  '13837',    // Decorative Collectibles
  '31387',    // Watches
  '261669',   // Lamps
  '10034',    // Collectibles
  '166725',   // Display stands
  '16102',    // Trinkets
  '38199',    // Furniture
  '1378',     // Disney Collectibles
  '261642',   // Other collectibles
];

// ============================================
// Jewelry Constants (No Stone Filtering)
// ============================================

// Values that indicate "no stone" in eBay item specifics
const NO_STONE_VALUES = [
  'no stone',
  'none',
  'n/a',
  'na',
  'not applicable',
  'not specified',
  'unknown',
  'no main stone',
  'no gemstone',
  ''
];

// Common stone keywords to detect in titles
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

// Costume/fashion jewelry keywords to always exclude
const COSTUME_JEWELRY_EXCLUSIONS = [
  'snap jewelry', 'snap button', 'rhinestone', 'costume', 'fashion jewelry',
  'acrylic', 'plastic', 'glass bead', 'simulated', 'faux', 'fake', 'imitation',
  'cubic zirconia', 'cz stone', ' cz ', 'crystal bead', 'resin', 'enamel',
  'leather', 'cord', 'rope chain', 'paracord',
  ' gf ', ' gf', 'gold gf', ' gp ', ' gp', 'gold gp',
  ' hge ', ' rgp ', ' gep ', 'gold tone', 'goldtone',
  'gold plated', 'gold-plated', 'silver plated', 'silver-plated',
  'gold filled', 'gold-filled', 'rolled gold', 'vermeil'
];

// Bad metals to reject
const BAD_METALS = ['plated', 'filled', 'steel', 'brass', 'bronze', 'copper', 'alloy', 'tone'];

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
  'mannequin',
  'bust display',
  'organizer',
  'storage box',
  // Plating equipment
  'plating machine',
  'plating rectifier',
  'electroplating',
  'plater',
  'pen plater',
  // Testing equipment
  'tester',
  'testing kit',
  'appraisal kit',
  'testing acid',
  'test stone',
  'touchstone',
  // Photos/collectibles that mention jewelry
  'daguerreotype',
  'photograph',
  'vintage photo',
  'antique photo',
  'tintype',
  'cabinet card',
  'cdv photo',
  // Trinket boxes and vanity items
  'trinket box',
  'jewelry box',
  'ring box',
  'keepsake box',
  'vanity box',
  'pill box',
  'music box',
  'compact mirror',
  'makeup mirror',
  'vanity mirror',
  'cosmetic mirror',
  'hand mirror',
  'travel mirror',
  'folding mirror',
];

// ============================================
// Jewelry Filtering Functions
// ============================================

function isNoStoneValue(value: string | null | undefined): boolean {
  if (!value) return true;
  return NO_STONE_VALUES.includes(value.toLowerCase().trim());
}

function titleContainsStone(title: string): boolean {
  if (!title) return false;
  const titleLower = title.toLowerCase();
  return STONE_KEYWORDS.some(keyword => titleLower.includes(keyword));
}

function hasCostumeJewelryTerms(title: string): { hasTerm: boolean; term: string | null } {
  const titleLower = ' ' + title.toLowerCase() + ' ';
  for (const term of COSTUME_JEWELRY_EXCLUSIONS) {
    if (titleLower.includes(term)) {
      return { hasTerm: true, term };
    }
  }
  return { hasTerm: false, term: null };
}

function hasJewelryToolTerms(title: string): { hasTerm: boolean; term: string | null } {
  const titleLower = title.toLowerCase();
  for (const term of JEWELRY_TOOLS_EXCLUSIONS) {
    if (titleLower.includes(term)) {
      return { hasTerm: true, term };
    }
  }
  return { hasTerm: false, term: null };
}

function isFakeTone(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return (v.includes('tone') &&
          !v.includes('two-tone') &&
          !v.includes('two tone') &&
          !v.includes('tri-tone') &&
          !v.includes('tri tone') &&
          !v.includes('bicolor') &&
          !v.includes('tricolor'));
}

// Base metals that should always be rejected for precious metal searches
const BASE_METALS_TO_REJECT = [
  'stainless steel', 'stainless', 'steel',
  'titanium', 'tungsten', 'tungsten carbide',
  'brass', 'bronze', 'copper', 'pewter',
  'aluminum', 'aluminium', 'nickel', 'zinc',
  'iron', 'chrome', 'chromium',
  // Non-metal materials
  'glass', 'plastic', 'resin', 'acrylic', 'wood', 'leather', 'fabric', 'cloth', 'rubber',
];

function passesJewelryItemSpecifics(
  title: string,
  specs: Record<string, string>,
  filters: any = {}
): { pass: boolean; reason: string | null } {
  const baseMetal = (specs['base metal'] || '').toLowerCase();
  const metal = (specs['metal'] || '').toLowerCase();
  const material = (specs['material'] || '').toLowerCase();

  // Check for bad metals (plated, filled, etc.)
  for (const bad of BAD_METALS) {
    if (baseMetal.includes(bad) || metal.includes(bad) || material.includes(bad)) {
      return { pass: false, reason: `Metal/Material contains "${bad}"` };
    }
  }

  // Check if silver is NOT selected but item specs contain silver
  const selectedMetals = filters.metal || [];
  const selectedMetalsLower = selectedMetals.map((m: string) => m.toLowerCase());
  const silverSelected = selectedMetalsLower.some((m: string) => m.includes('silver'));

  if (!silverSelected) {
    // Check all metal-related specs for silver
    const allMetalSpecs = `${baseMetal} ${metal} ${material}`;
    if (allMetalSpecs.includes('silver') || allMetalSpecs.includes('925') || allMetalSpecs.includes('.925')) {
      return { pass: false, reason: `Item specs contain silver (not selected): "${metal || material || baseMetal}"` };
    }
  }

  // Check for base metals in specs (stainless steel, titanium, etc.)
  for (const baseMet of BASE_METALS_TO_REJECT) {
    if (baseMetal.includes(baseMet) || metal.includes(baseMet) || material.includes(baseMet)) {
      return { pass: false, reason: `Base metal detected: "${baseMet}"` };
    }
  }

  // Check for fake tone (gold tone, silvertone - not real gold)
  if (isFakeTone(baseMetal) || isFakeTone(metal)) {
    return { pass: false, reason: 'Metal appears to be fake tone (not two-tone/tri-tone)' };
  }

  // Check for costume jewelry terms in title
  const costumeCheck = hasCostumeJewelryTerms(title);
  if (costumeCheck.hasTerm) {
    return { pass: false, reason: `Costume jewelry term: "${costumeCheck.term}"` };
  }

  // Check if "no stone" filtering is enabled (default: true for scrap jewelry)
  const requireNoStone = filters.no_stone !== false; // Default to true

  if (requireNoStone) {
    const mainStone = specs['main stone'] || '';
    const gemstone = specs['gemstone'] || '';
    const stone = specs['stone'] || '';

    // Check if item has stones in specs
    const hasStoneInSpecs = !isNoStoneValue(mainStone) || !isNoStoneValue(gemstone) || !isNoStoneValue(stone);

    if (hasStoneInSpecs) {
      return { pass: false, reason: `Has stone: Main="${mainStone}", Gemstone="${gemstone}", Stone="${stone}"` };
    }

    // Backup: Check title for stone keywords
    if (titleContainsStone(title)) {
      const matchedKeyword = STONE_KEYWORDS.find(kw => title.toLowerCase().includes(kw));
      return { pass: false, reason: `Title contains stone keyword: "${matchedKeyword}"` };
    }
  }

  return { pass: true, reason: null };
}

// ============================================
// Metal Prices & Melt Value Functions
// ============================================

let metalPricesCache: Record<string, any> | null = null;
let metalPricesCacheTime = 0;
const METAL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getMetalPrices(): Promise<Record<string, any> | null> {
  const now = Date.now();
  if (metalPricesCache && (now - metalPricesCacheTime) < METAL_CACHE_TTL) {
    return metalPricesCache;
  }

  try {
    const { data, error } = await supabase
      .from('metal_prices')
      .select('metal, price_gram_10k, price_gram_14k, price_gram_18k, price_gram_24k');

    if (error || !data || data.length === 0) {
      console.log('⚠️ Could not fetch metal prices');
      return null;
    }

    const pricesMap: Record<string, any> = {};
    data.forEach((row: any) => {
      pricesMap[row.metal] = row;
    });

    metalPricesCache = pricesMap;
    metalPricesCacheTime = now;
    return pricesMap;
  } catch (err: any) {
    console.log('⚠️ Error fetching metal prices:', err.message);
    return null;
  }
}

function calculateGoldMeltValue(karat: number | null, weightG: number | null, goldPrices: any): number | null {
  if (!karat || !weightG || !goldPrices) return null;

  const pricePerGram: Record<number, number> = {
    10: goldPrices.price_gram_10k,
    14: goldPrices.price_gram_14k,
    18: goldPrices.price_gram_18k,
    22: goldPrices.price_gram_18k * (22/18),
    24: goldPrices.price_gram_24k,
  };

  const price = pricePerGram[karat];
  if (!price) return null;

  return weightG * price;
}

function calculateSilverMeltValue(purity: number | null, weightG: number | null, silverPrices: any): number | null {
  if (!purity || !weightG || !silverPrices) return null;
  const purePrice = silverPrices.price_gram_24k;
  if (!purePrice) return null;
  const purityFraction = purity / 1000;
  return weightG * purePrice * purityFraction;
}

function calculatePlatinumMeltValue(purity: number | null, weightG: number | null, platinumPrices: any): number | null {
  if (!purity || !weightG || !platinumPrices) return null;
  const purePrice = platinumPrices.price_gram_24k;
  if (!purePrice) return null;
  const purityFraction = purity / 1000;
  return weightG * purePrice * purityFraction;
}

function detectMetalType(title: string, specs: Record<string, string>): { type: string; purity: number | null } {
  const titleLower = title.toLowerCase();
  const metalSpec = (specs['metal'] || specs['metal type'] || '').toLowerCase();
  const metalPurity = (specs['metal purity'] || specs['purity'] || specs['fineness'] || '').toLowerCase();
  const combined = titleLower + ' ' + metalSpec + ' ' + metalPurity;

  // Check for platinum
  if (combined.includes('platinum') || combined.includes('plat') || combined.includes('pt950') || combined.includes('pt900')) {
    let purity = 950; // Default platinum purity
    // Check metal purity spec first (e.g., "950", "900")
    const purityMatch = metalPurity.match(/(\d{3})/);
    if (purityMatch) {
      const p = parseInt(purityMatch[1]);
      if ([950, 900, 850].includes(p)) purity = p;
    } else if (combined.includes('pt900') || combined.includes('900')) {
      purity = 900;
    } else if (combined.includes('pt850') || combined.includes('850')) {
      purity = 850;
    }
    return { type: 'platinum', purity };
  }

  // Check for palladium
  if (combined.includes('palladium') || combined.includes('pd950') || combined.includes('pd500')) {
    let purity = 950;
    // Check metal purity spec first
    const purityMatch = metalPurity.match(/(\d{3})/);
    if (purityMatch) {
      const p = parseInt(purityMatch[1]);
      if ([950, 500].includes(p)) purity = p;
    } else if (combined.includes('pd500') || combined.includes('500')) {
      purity = 500;
    }
    return { type: 'palladium', purity };
  }

  // Check for silver
  if (combined.includes('sterling') || combined.includes('925') || combined.includes('silver')) {
    let purity = 925; // Default sterling
    // Check metal purity spec first
    const purityMatch = metalPurity.match(/(\d{3})/);
    if (purityMatch) {
      const p = parseInt(purityMatch[1]);
      if ([999, 925, 900, 800].includes(p)) purity = p;
    } else if (combined.includes('999') || combined.includes('fine silver')) {
      purity = 999;
    } else if (combined.includes('900') || combined.includes('coin silver')) {
      purity = 900;
    } else if (combined.includes('800')) {
      purity = 800;
    }
    return { type: 'silver', purity };
  }

  // Default to gold
  return { type: 'gold', purity: null };
}

// ============================================
// Caching Functions (Rejected Items & Item Details)
// ============================================

// Get rejected item IDs for a task (to skip re-processing)
async function getRejectedItemIds(taskId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('rejected_items')
      .select('ebay_listing_id')
      .eq('task_id', taskId)
      .gt('expires_at', new Date().toISOString());

    if (error || !data) return new Set();

    return new Set(data.map((r: any) => r.ebay_listing_id));
  } catch (e) {
    return new Set();
  }
}

// Cache a rejected item (48 hour expiry)
async function cacheRejectedItem(taskId: string, itemId: string, reason: string): Promise<void> {
  try {
    await supabase.from('rejected_items').upsert({
      task_id: taskId,
      ebay_listing_id: itemId,
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
    }, { onConflict: 'task_id,ebay_listing_id' });
  } catch (e) {
    // Cache errors shouldn't break the flow
  }
}

// Get cached item details (24 hour cache)
async function getCachedItemDetails(itemId: string, includeShipping: boolean = false): Promise<any | null> {
  // Skip cache if we need shipping info (cache doesn't store it)
  if (includeShipping) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('ebay_item_cache')
      .select('item_specifics, title, description')
      .eq('ebay_item_id', itemId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    // Return cached data in same format as eBay API
    return {
      localizedAspects: data.item_specifics,
      title: data.title,
      description: data.description || '',
      _fromCache: true
    };
  } catch (e) {
    return null;
  }
}

// Cache item details (24 hour expiry)
async function cacheItemDetails(itemId: string, itemDetails: any): Promise<void> {
  try {
    const itemSpecifics = itemDetails.localizedAspects || [];

    await supabase
      .from('ebay_item_cache')
      .upsert({
        ebay_item_id: itemId,
        item_specifics: itemSpecifics,
        title: itemDetails.title || '',
        description: itemDetails.description || '',
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }, { onConflict: 'ebay_item_id' });
  } catch (e) {
    // Cache errors shouldn't break the flow
  }
}

// Clean up expired cache entries
async function cleanupExpiredCache(): Promise<void> {
  try {
    // Clean expired rejected items
    await supabase
      .from('rejected_items')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Clean expired item cache
    await supabase
      .from('ebay_item_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());
  } catch (e) {
    // Cleanup errors shouldn't break the flow
  }
}

// ============================================
// Gemstone Parsing Functions
// ============================================

function detectStoneType(title: string, specs: Record<string, string> = {}): string | null {
  // Check specs first
  const stoneSpec = specs['type'] || specs['stone type'] || specs['gemstone'] || specs['variety'] || '';
  for (const stoneType of GEMSTONE_TYPES) {
    if (stoneSpec.toLowerCase().includes(stoneType.toLowerCase())) {
      return stoneType;
    }
  }

  // Check title
  const titleLower = title.toLowerCase();
  for (const stoneType of GEMSTONE_TYPES) {
    if (titleLower.includes(stoneType.toLowerCase())) {
      return stoneType;
    }
  }

  return null;
}

function extractStoneShape(title: string, specs: Record<string, string> = {}): string | null {
  const shapeSpec = specs['cut'] || specs['shape'] || specs['cut style'] || '';
  for (const shape of STONE_SHAPES) {
    if (shapeSpec.toLowerCase().includes(shape.toLowerCase())) {
      return shape;
    }
  }

  const titleLower = title.toLowerCase();
  for (const shape of STONE_SHAPES) {
    if (titleLower.includes(shape.toLowerCase())) {
      return shape;
    }
  }

  return null;
}

function extractCaratWeight(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
  // Check specs first
  const weightSpec = specs['total carat weight'] || specs['carat weight'] || specs['carat'] || specs['ct'] || '';
  if (weightSpec) {
    const match = weightSpec.match(/(\d+\.?\d*)/);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 0 && value < 10000) return value;
    }
  }

  // Patterns to extract carat from title
  const patterns = [
    /(\d+\.?\d*)\s*(?:ct|carat|carats|tcw|ctw)/i,
    /(\d+\.?\d*)\s*(?:total\s*(?:carat|ct))/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 0 && value < 10000) return value;
    }
  }

  // Check description
  if (description) {
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (value > 0 && value < 10000) return value;
      }
    }
  }

  return null;
}

function extractStoneColor(title: string, specs: Record<string, string> = {}, stoneType: string | null): string | null {
  // Check specs
  const colorSpec = specs['color'] || specs['colour'] || specs['color grade'] || '';
  if (colorSpec) {
    // For diamonds, extract letter grade
    if (stoneType === 'Diamond') {
      const match = colorSpec.match(/^([D-P])\b/i);
      if (match) return match[1].toUpperCase();
    }
    return colorSpec;
  }

  // For diamonds, check title for color grade
  if (stoneType === 'Diamond') {
    const titleUpper = title.toUpperCase();
    for (const color of DIAMOND_COLORS) {
      const regex = new RegExp(`\\b${color}\\s*(?:color|colour)?\\b`, 'i');
      if (regex.test(title)) return color;
    }
  }

  return null;
}

function extractStoneClarity(title: string, specs: Record<string, string> = {}, stoneType: string | null): string | null {
  const claritySpec = specs['clarity'] || specs['clarity grade'] || '';
  if (claritySpec) {
    for (const clarity of DIAMOND_CLARITIES) {
      if (claritySpec.toUpperCase().includes(clarity)) return clarity;
    }
    return claritySpec;
  }

  if (stoneType === 'Diamond') {
    const titleUpper = title.toUpperCase();
    for (const clarity of DIAMOND_CLARITIES) {
      if (titleUpper.includes(clarity)) return clarity;
    }
  }

  return null;
}

function extractCertification(title: string, specs: Record<string, string> = {}): string | null {
  const certSpec = specs['certification'] || specs['certificate'] || specs['lab'] || specs['grading lab'] || '';

  const allLabs = [...CERT_LABS.premium, ...CERT_LABS.standard, ...CERT_LABS.budget];

  for (const lab of allLabs) {
    if (certSpec.toUpperCase().includes(lab)) return lab;
    if (title.toUpperCase().includes(lab)) return lab;
  }

  if (/certified/i.test(title) || /certified/i.test(certSpec)) {
    return 'Certified';
  }

  return null;
}

function extractTreatment(title: string, specs: Record<string, string> = {}): string | null {
  const treatmentSpec = specs['treatment'] || specs['enhancement'] || '';

  const noTreatmentTerms = ['untreated', 'no treatment', 'natural', 'unheated', 'no heat', 'none'];
  const heatTerms = ['heat', 'heated', 'heat only', 'heat treated'];
  const heavyTerms = ['filled', 'glass filled', 'lead glass', 'fracture filled', 'irradiated', 'diffused', 'coated'];

  const checkText = (treatmentSpec + ' ' + title).toLowerCase();

  for (const term of noTreatmentTerms) {
    if (checkText.includes(term)) return 'Not Enhanced';
  }

  for (const term of heavyTerms) {
    if (checkText.includes(term)) return 'Heavy Treatment';
  }

  for (const term of heatTerms) {
    if (checkText.includes(term)) return 'Heat Only';
  }

  return null;
}

function isNaturalStone(title: string, specs: Record<string, string> = {}): boolean {
  const checkText = (title + ' ' + (specs['natural/lab-created'] || '') + ' ' + (specs['creation method'] || '')).toLowerCase();

  for (const term of LAB_CREATED_TERMS) {
    if (checkText.includes(term)) return false;
  }

  if (checkText.includes('natural') || checkText.includes('genuine')) {
    return true;
  }

  return true; // Default to natural if not specified
}

function parseStoneDetails(title: string, specs: Record<string, string> = {}, description: string = ''): any {
  const stoneType = detectStoneType(title, specs);

  return {
    stone_type: stoneType,
    shape: extractStoneShape(title, specs),
    carat: extractCaratWeight(title, specs, description),
    color: extractStoneColor(title, specs, stoneType),
    clarity: extractStoneClarity(title, specs, stoneType),
    certification: extractCertification(title, specs),
    treatment: extractTreatment(title, specs),
    is_natural: isNaturalStone(title, specs),
  };
}

// ============================================
// Gemstone Blacklist & Filtering
// ============================================

function passesGemstoneBlacklist(title: string, specs: Record<string, string> = {}, filters: any = {}): { blocked: boolean; reason: string | null } {
  const titleLower = title.toLowerCase();
  const allowLabCreated = filters.allow_lab_created || false;

  // Check item specifics for simulant indicators
  const stoneSpec = (specs['type'] || specs['stone type'] || specs['gemstone'] || '').toLowerCase();
  const creationSpec = (specs['creation method'] || specs['natural/lab-created'] || '').toLowerCase();

  const simulantTerms = ['cubic zirconia', 'cz', 'moissanite', 'simulant', 'simulated', 'fake', 'imitation'];
  for (const term of simulantTerms) {
    if (stoneSpec.includes(term) || creationSpec.includes(term)) {
      return { blocked: true, reason: `Simulant in specs: "${term}"` };
    }
  }

  // Check title against blacklist
  for (const term of GEMSTONE_BLACKLIST) {
    // Skip lab-created terms if allowed
    if (allowLabCreated && LAB_CREATED_TERMS.includes(term)) {
      continue;
    }

    // For short terms like "cz", require word boundaries
    if (term.length <= 3) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(title)) {
        return { blocked: true, reason: `Blacklisted term: "${term}"` };
      }
    } else {
      if (titleLower.includes(term.toLowerCase())) {
        return { blocked: true, reason: `Blacklisted term: "${term}"` };
      }
    }
  }

  // Check for lab-created if not allowed
  if (!allowLabCreated) {
    for (const term of LAB_CREATED_TERMS) {
      if (titleLower.includes(term)) {
        return { blocked: true, reason: `Lab-created: "${term}"` };
      }
    }
  }

  return { blocked: false, reason: null };
}

function passesGemstoneFilters(stone: any, filters: any = {}): { passes: boolean; reason: string | null } {
  // Carat range filter
  if (filters.carat_min !== undefined && stone.carat !== null) {
    if (stone.carat < filters.carat_min) {
      return { passes: false, reason: `Carat ${stone.carat} below min ${filters.carat_min}` };
    }
  }
  if (filters.carat_max !== undefined && stone.carat !== null) {
    if (stone.carat > filters.carat_max) {
      return { passes: false, reason: `Carat ${stone.carat} above max ${filters.carat_max}` };
    }
  }

  return { passes: true, reason: null };
}

// ============================================
// Gemstone Scoring Functions
// ============================================

function calculateSellerQuality(seller: any): number {
  if (!seller) return 0;

  let score = 0;
  const feedback = seller.feedbackScore || 0;
  const percentage = seller.feedbackPercentage ? parseFloat(seller.feedbackPercentage) : 0;

  if (feedback >= 10000) score += 8;
  else if (feedback >= 5000) score += 7;
  else if (feedback >= 1000) score += 6;
  else if (feedback >= 500) score += 5;
  else if (feedback >= 100) score += 4;
  else if (feedback >= 50) score += 3;
  else if (feedback >= 10) score += 2;
  else if (feedback > 0) score += 1;

  if (percentage >= 100) score += 7;
  else if (percentage >= 99.5) score += 6;
  else if (percentage >= 99) score += 5;
  else if (percentage >= 98) score += 4;
  else if (percentage >= 97) score += 3;
  else if (percentage >= 95) score += 2;
  else if (percentage >= 90) score += 1;

  return score;
}

function calculateFormatScore(buyingOptions: string[] = []): number {
  if (!buyingOptions || !Array.isArray(buyingOptions)) {
    buyingOptions = [];
  }

  const options = buyingOptions.map(o => o.toUpperCase());

  if (options.includes('BEST_OFFER')) return 10;
  if (options.includes('FIXED_PRICE')) return 7;
  if (options.includes('AUCTION')) return 5;

  return 3;
}

function calculateCertBonus(certification: string | null): number {
  if (!certification) return 0;

  const certUpper = certification.toUpperCase();

  if (CERT_LABS.premium.some(lab => certUpper.includes(lab))) return 15;
  if (CERT_LABS.standard.some(lab => certUpper.includes(lab))) return 10;
  if (CERT_LABS.budget.some(lab => certUpper.includes(lab))) return 5;
  if (certUpper.includes('CERTIFIED') || certUpper.includes('CERT')) return 3;

  return 0;
}

function calculateMatchQuality(stone: any, filters: any = {}): number {
  let score = 0;
  let maxScore = 0;

  if (filters.stone_types && filters.stone_types.length > 0) {
    maxScore += 5;
    if (stone.stone_type && filters.stone_types.includes(stone.stone_type)) {
      score += 5;
    }
  }

  if (filters.shapes && filters.shapes.length > 0) {
    maxScore += 5;
    if (stone.shape && filters.shapes.includes(stone.shape)) {
      score += 5;
    }
  }

  if (filters.carat_min !== undefined || filters.carat_max !== undefined) {
    maxScore += 5;
    if (stone.carat !== null) {
      const inMin = filters.carat_min === undefined || stone.carat >= filters.carat_min;
      const inMax = filters.carat_max === undefined || stone.carat <= filters.carat_max;
      if (inMin && inMax) score += 5;
    }
  }

  if (maxScore === 0) {
    if (stone.stone_type) score += 5;
    if (stone.shape) score += 5;
    if (stone.carat) score += 5;
    if (stone.color) score += 5;
    if (stone.clarity) score += 5;
    return Math.min(25, score);
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 25) : 25;
}

function calculateDealScore(stone: any, listing: any, filters: any = {}): number {
  let score = 0;

  score += calculateMatchQuality(stone, filters);
  score += calculateSellerQuality(listing.seller);
  score += calculateFormatScore(listing.buyingOptions);
  score += calculateCertBonus(stone.certification);

  let detailBonus = 0;
  if (stone.carat) detailBonus += 2;
  if (stone.color) detailBonus += 2;
  if (stone.clarity) detailBonus += 2;
  if (stone.shape) detailBonus += 2;
  if (stone.treatment) detailBonus += 2;
  score += Math.min(10, detailBonus);

  if (stone.is_natural) score += 5;
  if (stone.treatment === 'Not Enhanced' && stone.stone_type !== 'Diamond') score += 5;

  score = Math.round((score / 85) * 100);
  return Math.min(100, Math.max(0, score));
}

function calculateRiskScore(stone: any, listing: any): number {
  let risk = 0;

  const title = listing.title || '';
  const titleLower = title.toLowerCase();
  const seller = listing.seller || {};

  const syntheticFlags = ['lab', 'synthetic', 'created', 'cvd', 'hpht', 'simulant'];
  for (const flag of syntheticFlags) {
    if (titleLower.includes(flag)) {
      risk += 30;
      break;
    }
  }

  const returnPolicy = listing.returnTerms || listing.returnPolicy || {};
  const returnsAccepted = returnPolicy.returnsAccepted !== false;
  if (!returnsAccepted) risk += 20;

  let missingCount = 0;
  if (!stone.carat) missingCount++;
  if (!stone.color) missingCount++;
  if (!stone.clarity) missingCount++;
  if (!stone.stone_type) missingCount++;
  risk += missingCount * 5;

  const heavyTreatments = ['filled', 'glass', 'lead', 'fracture', 'diffused', 'coated'];
  for (const treatment of heavyTreatments) {
    if (titleLower.includes(treatment)) {
      risk += 15;
      break;
    }
  }

  const feedback = seller.feedbackScore || 0;
  const percentage = seller.feedbackPercentage ? parseFloat(seller.feedbackPercentage) : 100;
  if (feedback < 50) risk += 10;
  else if (feedback < 100) risk += 5;
  if (percentage < 98) risk += 5;

  const vagueTerms = ['estate', 'not sure', 'i think', 'possibly', 'maybe', 'as is', 'no guarantee'];
  for (const term of vagueTerms) {
    if (titleLower.includes(term)) {
      risk += 10;
      break;
    }
  }

  if (stone.carat && stone.carat >= 1) {
    const price = listing.price?.value || listing.price || 0;
    const pricePerCarat = price / stone.carat;
    if (stone.is_natural && pricePerCarat < 50) risk += 10;
  }

  return Math.min(100, risk);
}

// ============================================
// Jewelry Parsing Functions
// ============================================

function extractKarat(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
  // Check specs first - eBay uses various field names for metal purity
  const purityFieldNames = ['metal purity', 'purity', 'karat', 'gold purity', 'fineness'];
  for (const field of purityFieldNames) {
    const value = specs[field];
    if (value) {
      const karatMatch = value.match(/(\d+)\s*[kK]/);
      if (karatMatch) {
        const karat = parseInt(karatMatch[1]);
        if ([8, 9, 10, 14, 18, 22, 24].includes(karat)) return karat;
      }
    }
  }

  // Check title
  const patterns = [
    /(\d+)\s*[kK](?:arat|t)?(?:\s|$|[^a-zA-Z])/,
    /(\d+)\s*(?:karat|kt)/i,
    /\b(10|14|18|22|24)[kK]\b/,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const karat = parseInt(match[1]);
      if ([8, 9, 10, 14, 18, 22, 24].includes(karat)) return karat;
    }
  }

  // Check description (strip HTML first)
  if (description) {
    const cleanDesc = description
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n)))
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // Look for karat patterns in description
    const descPatterns = [
      /(\d+)\s*[kK](?:arat|t)?(?:\s|gold|\b)/i,
      /\b(10|14|18|22|24)\s*karat\b/i,
      /\b(10|14|18|22|24)k\s*gold\b/i,
    ];

    for (const pattern of descPatterns) {
      const match = cleanDesc.match(pattern);
      if (match) {
        const karat = parseInt(match[1]);
        if ([8, 9, 10, 14, 18, 22, 24].includes(karat)) {
          console.log(`    📏 Found karat ${karat}K in description`);
          return karat;
        }
      }
    }
  }

  return null;
}

function extractWeight(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
  // Check item specifics first - eBay uses many different field names
  // NOTE: 'total carat weight' removed - eBay uses it for karat purity (14K, 18K), not gram weight
  const weightFieldNames = [
    'total weight', 'gram weight', 'total gram weight', 'metal weight(grams)',
    'item weight', 'weight', 'item weight (approx.)',
    'approximate weight', 'metal weight', 'chain weight', 'necklace weight',
    'ring weight', 'bracelet weight', 'gold weight', 'total metal weight',
    'net weight', 'jewelry weight', 'metal wt.', 'metal wt', 'gross weight',
    'platinum weight', 'silver weight', 'weight (approx.)', 'approx. weight'
  ];

  let weightSpec = '';
  for (const field of weightFieldNames) {
    if (specs[field]) {
      weightSpec = specs[field];
      break;
    }
  }

  if (weightSpec) {
    const specLower = weightSpec.toLowerCase();

    // Try grams - require unit to avoid matching bare karat numbers like "14" from "Total Carat Weight: 14"
    const gramMatch = specLower.match(/([\d.]+)\s*(?:g|gr|gm|gms|gram|grams)\b/i);
    if (gramMatch) {
      const value = parseFloat(gramMatch[1]);
      if (!specLower.includes('oz') && !specLower.includes('dwt') && !specLower.includes('ct')) {
        return value;
      }
    }

    // Try oz (1 oz = 28.3495g)
    const ozMatch = specLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)/i);
    if (ozMatch) {
      return parseFloat(ozMatch[1]) * 28.3495;
    }

    // Try dwt (1 dwt = 1.555g)
    const dwtMatch = specLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
    if (dwtMatch) {
      return parseFloat(dwtMatch[1]) * 1.555;
    }
  }

  // Check title
  const titleLower = title.toLowerCase();

  // Match patterns like "5g", "5.5g", "10 grams" - the unit is required so "14K" won't match
  let gramMatch = titleLower.match(/([\d.]+)\s*(?:g|gr|gram|grams)\b/i);
  if (gramMatch) return parseFloat(gramMatch[1]);

  let ozMatch = titleLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)\b/i);
  if (ozMatch) return parseFloat(ozMatch[1]) * 28.3495;

  let dwtMatch = titleLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
  if (dwtMatch) return parseFloat(dwtMatch[1]) * 1.555;

  // Check description (strip HTML first)
  if (description) {
    const cleanDesc = description
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n)))
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // Weight patterns in description
    const weightPatterns = [
      /(?:weight|weighs|wt)[:\s\-]+([\d.]+)\s*(?:g|gr|gram|grams)\b/i,  // handles "Weight - .53 grams"
      /([\d.]+)\s*(?:g|gr|gram|grams)\s*(?:total|weight)/i,
      /(?:total|approx\.?|approximately)\s*([\d.]+)\s*(?:g|gr|gram|grams)\b/i,
      /([\d.]+)\s*(?:g|gr|gram|grams)\b/i,
    ];

    for (const pattern of weightPatterns) {
      const match = cleanDesc.match(pattern);
      if (match) {
        let rawValue = match[1];
        // Fix common seller typo: ".1.08" should be "1.08" (errant leading period)
        if (rawValue.startsWith('.') && (rawValue.match(/\./g) || []).length > 1) {
          rawValue = rawValue.substring(1); // Remove the leading period
          console.log(`    🔧 Fixed typo: .${rawValue} → ${rawValue}`);
        }
        const value = parseFloat(rawValue);
        if (value > 0 && value < 1000) {
          console.log(`    📏 Found weight ${value}g in description`);
          return value;
        }
      }
    }

    // Check for oz in description
    ozMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*([\d.]+)\s*(?:oz|ounce|ounces)\b/i);
    if (ozMatch) {
      const value = parseFloat(ozMatch[1]) * 28.3495;
      console.log(`    📏 Found weight ${ozMatch[1]}oz (${value.toFixed(2)}g) in description`);
      return value;
    }

    // Check for dwt in description
    dwtMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*([\d.]+)\s*(?:dwt|penny\s*weight)/i);
    if (dwtMatch) {
      const value = parseFloat(dwtMatch[1]) * 1.555;
      console.log(`    📏 Found weight ${dwtMatch[1]}dwt (${value.toFixed(2)}g) in description`);
      return value;
    }
  }

  return null;
}

// ============================================
// Token & API Functions
// ============================================

let cachedToken: { token: string; expiresAt: number } | null = null;

const getEbayToken = async (): Promise<string | null> => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (error || !settings?.value_json) {
      console.error('❌ No eBay API keys configured');
      return null;
    }

    const config = settings.value_json as { keys: any[] };
    const availableKeys = config.keys.filter((k: any) => k.status !== 'rate_limited' && k.status !== 'error');
    const keyToUse = availableKeys.length > 0 ? availableKeys[0] : config.keys[0];

    if (!keyToUse) {
      console.error('❌ No eBay API keys available');
      return null;
    }

    const credentials = btoa(`${keyToUse.app_id}:${keyToUse.cert_id}`);
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope'
      })
    });

    if (!response.ok) {
      console.error('❌ Failed to get eBay OAuth token:', response.status);
      return null;
    }

    const tokenData: any = await response.json();
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000) - 60000
    };

    return cachedToken.token;
  } catch (error) {
    console.error('❌ Error getting eBay token:', error);
    return null;
  }
};

const fetchItemDetails = async (itemId: string, token: string, includeShipping: boolean = true): Promise<any | null> => {
  // Check cache first (skip if we need shipping since cache doesn't store it)
  const cached = await getCachedItemDetails(itemId, includeShipping);
  if (cached) {
    return cached;
  }

  try {
    const url = `https://api.ebay.com/buy/browse/v1/item/${itemId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=US,zip=10001',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`⚠️ Failed to fetch details for ${itemId}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Cache the result for 24 hours
    await cacheItemDetails(itemId, data);

    return data;
  } catch (error) {
    console.error(`❌ Error fetching item details for ${itemId}:`, error);
    return null;
  }
};

const extractItemSpecifics = (itemDetails: any): Record<string, string> => {
  if (!itemDetails?.localizedAspects) return {};

  const specs: Record<string, string> = {};
  for (const aspect of itemDetails.localizedAspects) {
    specs[aspect.name.toLowerCase()] = aspect.value;
  }
  return specs;
};

// ============================================
// Task Interfaces
// ============================================

interface Task {
  id: string;
  user_id: string;
  name: string;
  item_type: 'watch' | 'jewelry' | 'gemstone';
  status: 'active' | 'paused' | 'stopped';
  min_price?: number;
  max_price?: number;
  price_percentage?: number;
  price_delta_type?: string;
  price_delta_value?: number;
  listing_format?: string[];
  min_seller_feedback?: number;
  poll_interval?: number;
  exclude_keywords?: string[];
  auction_alert?: boolean;
  date_from?: string;
  date_to?: string;
  item_location?: string;
  watch_filters?: any;
  jewelry_filters?: any;
  gemstone_filters?: any;
  min_profit_margin?: number;
  last_run?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Search & Processing Functions
// ============================================

const buildSearchKeywords = (task: Task, metalOverride: string | null = null): string => {
  let keywords = '';
  let exclusionKeywords: string[] = [];

  switch (task.item_type) {
    case 'watch':
      keywords = 'watch';
      if (task.watch_filters?.brands?.length > 0) {
        keywords = `${task.watch_filters.brands[0]} watch`;
      }
      if (task.watch_filters?.keywords) {
        keywords += ` ${task.watch_filters.keywords}`;
      }
      break;
    case 'jewelry':
      // Always include "jewelry" to avoid random unrelated items (paint, phone cases, etc.)
      const metalToSearch = metalOverride || (task.jewelry_filters?.metal?.length > 0 ? task.jewelry_filters.metal[0] : 'gold');
      keywords = `${metalToSearch} jewelry`;
      if (task.jewelry_filters?.categories?.length > 0) {
        keywords += ` ${task.jewelry_filters.categories[0]}`;
      }
      if (task.jewelry_filters?.keywords) {
        keywords += ` ${task.jewelry_filters.keywords}`;
      }

      // Get metal exclusion keywords for jewelry searches
      if (task.jewelry_filters?.metal?.length > 0) {
        exclusionKeywords = getMetalExclusionKeywords(task.jewelry_filters.metal);
        if (exclusionKeywords.length > 0) {
          console.log(`🚫 Auto-excluding metals: ${exclusionKeywords.slice(0, 5).join(', ')}${exclusionKeywords.length > 5 ? '...' : ''}`);
        }
      }
      break;
    case 'gemstone':
      keywords = 'loose gemstone natural';
      if (task.gemstone_filters?.stone_types?.length > 0) {
        keywords = `${task.gemstone_filters.stone_types[0]} loose natural`;
      }
      if (task.gemstone_filters?.keywords) {
        keywords += ` ${task.gemstone_filters.keywords}`;
      }
      break;
  }

  // Append exclusion keywords as negative search terms (eBay supports -keyword syntax)
  if (exclusionKeywords.length > 0) {
    // Limit to top 10 exclusions to avoid query length issues
    const limitedExclusions = exclusionKeywords.slice(0, 10);
    const exclusionString = limitedExclusions.map(kw => `-"${kw}"`).join(' ');
    keywords += ` ${exclusionString}`;
  }

  return keywords || task.name.toLowerCase();
};

const getConditionsFromFilters = (task: Task): string[] => {
  const conditions: string[] = [];

  switch (task.item_type) {
    case 'jewelry':
      if (task.jewelry_filters?.conditions) {
        conditions.push(...task.jewelry_filters.conditions);
      }
      break;
    case 'watch':
      if (task.watch_filters?.conditions) {
        conditions.push(...task.watch_filters.conditions);
      }
      break;
    case 'gemstone':
      if (task.gemstone_filters?.conditions) {
        conditions.push(...task.gemstone_filters.conditions);
      }
      break;
  }

  return conditions;
};

const shouldExcludeItem = (task: Task, item: any): { exclude: boolean; reason?: string } => {
  if (task.exclude_keywords && task.exclude_keywords.length > 0) {
    const titleLower = item.title.toLowerCase();
    const hasExcludedKeyword = task.exclude_keywords.some((keyword: string) =>
      titleLower.includes(keyword.toLowerCase())
    );
    if (hasExcludedKeyword) {
      return { exclude: true, reason: 'Contains excluded keyword' };
    }
  }

  return { exclude: false };
};

const getMatchTableName = (itemType: string): string => {
  return `matches_${itemType}`;
};

const createMatchRecord = (task: Task, item: any, stone?: any, dealScore?: number, riskScore?: number) => {
  const baseMatch = {
    task_id: task.id,
    user_id: task.user_id,
    ebay_listing_id: item.itemId,
    ebay_title: item.title,
    ebay_url: item.listingUrl,
    listed_price: item.price,
    shipping_cost: item.shippingCost || 0,
    currency: item.currency || 'USD',
    buy_format: item.listingType || 'Unknown',
    seller_feedback: item.sellerInfo?.feedbackScore || 0,
    found_at: new Date().toISOString(),
    status: 'new' as const,
  };

  switch (task.item_type) {
    case 'gemstone':
      return {
        ...baseMatch,
        stone_type: stone?.stone_type || null,
        shape: stone?.shape || null,
        carat: stone?.carat || null,
        colour: stone?.color || null,
        clarity: stone?.clarity || null,
        cert_lab: stone?.certification || null,
        treatment: stone?.treatment || null,
        is_natural: stone?.is_natural ?? true,
        deal_score: dealScore || null,
        risk_score: riskScore || null,
      };

    case 'jewelry':
      return {
        ...baseMatch,
        karat: item.karat || null,
        weight_g: item.weight_g || null,
        metal_type: item.metalType || 'Unknown',
        melt_value: item.meltValue || null,
        profit_scrap: item.profitScrap || null,
        break_even: item.breakEven || null,
        suggested_offer: item.suggestedOffer || null,
      };

    case 'watch':
      return {
        ...baseMatch,
        case_material: item.caseMaterial || null,
        band_material: item.bandMaterial || null,
        movement: item.movement || null,
        dial_color: item.dialColor || null,
        year: item.year || null,
        brand: item.brand || null,
        model: item.model || null,
      };

    default:
      return baseMatch;
  }
};

// ============================================
// Main Task Processing
// ============================================

const processTask = async (task: Task) => {
  console.log(`🔄 Processing task: ${task.name} (${task.id}) - Type: ${task.item_type}`);

  try {
    const lastRunDate = task.last_run ? new Date(task.last_run) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateFrom = lastRunDate.toISOString();

    // Build search parameters
    const searchParams = {
      keywords: buildSearchKeywords(task),
      maxPrice: task.max_price,
      minPrice: task.min_price,
      listingType: task.listing_format || ['Auction', 'Fixed Price (BIN)'],
      minFeedback: task.min_seller_feedback || 0,
      itemLocation: task.item_location,
      dateFrom: dateFrom,
      dateTo: task.date_to,
      itemType: task.item_type,
      typeSpecificFilters: task.item_type === 'watch' ? task.watch_filters :
                          task.item_type === 'jewelry' ? task.jewelry_filters :
                          task.item_type === 'gemstone' ? task.gemstone_filters : null,
      condition: getConditionsFromFilters(task),
      // Add category filtering for gemstones and jewelry
      categoryIds: task.item_type === 'gemstone' ? GEMSTONE_CATEGORY_IDS.join(',') :
                   task.item_type === 'jewelry' ? JEWELRY_CATEGORY_IDS.join(',') : undefined,
    };

    // Check if jewelry task has multiple metals - need to search for each
    const metals = task.item_type === 'jewelry' ? (task.jewelry_filters?.metal || []) : [];
    const needsMultiMetalSearch = task.item_type === 'jewelry' && metals.length > 1;

    let items: any[] = [];

    if (needsMultiMetalSearch) {
      // Run separate search for each metal type and combine results
      console.log(`🔧 Searching for ${metals.length} metals: ${metals.join(', ')}`);
      const seenItemIds = new Set<string>();

      for (const metal of metals) {
        const metalSearchParams = {
          ...searchParams,
          keywords: buildSearchKeywords(task, metal),
        };

        console.log(`🎯 Search [${metal}]: ${metalSearchParams.keywords}`);

        const searchResponse = await supabase.functions.invoke('ebay-search', {
          body: metalSearchParams
        });

        if (searchResponse.error) {
          console.error(`❌ Error searching for ${metal}:`, searchResponse.error);
          continue;
        }

        const metalItems = searchResponse.data?.items || [];
        console.log(`  📦 Found ${metalItems.length} items for ${metal}`);

        // Deduplicate - only add items we haven't seen
        for (const item of metalItems) {
          if (!seenItemIds.has(item.itemId)) {
            seenItemIds.add(item.itemId);
            items.push(item);
          }
        }
      }

      console.log(`📦 Total unique items across all metals: ${items.length}`);
    } else {
      // Single search (non-jewelry or single metal)
      console.log(`🎯 Search: ${searchParams.keywords}`);

      const searchResponse = await supabase.functions.invoke('ebay-search', {
        body: searchParams
      });

      if (searchResponse.error) {
        console.error('❌ Error calling eBay search:', searchResponse.error);
        return;
      }

      items = searchResponse.data?.items || [];
      console.log(`📦 Found ${items.length} items`);
    }

    if (!items || items.length === 0) {
      console.log(`📭 No new items found for task ${task.name}`);
      await supabase.from('tasks').update({ last_run: new Date().toISOString() }).eq('id', task.id);
      return;
    }

    const tableName = getMatchTableName(task.item_type);
    let newMatches = 0;
    let excludedItems = 0;
    let skippedRejected = 0;
    let cacheHits = 0;
    const token = await getEbayToken();

    // Pre-fetch rejected item IDs to skip them (saves API calls)
    const rejectedItemIds = await getRejectedItemIds(task.id);
    if (rejectedItemIds.size > 0) {
      console.log(`📋 Loaded ${rejectedItemIds.size} previously rejected items to skip`);
    }

    for (const item of items) {
      // Check for test listing (from our test seller) - bypass all filters
      const sellerName = item.sellerInfo?.name?.toLowerCase() || '';
      if (sellerName === TEST_SELLER_USERNAME.toLowerCase()) {
        // Only notify once per test listing
        if (!notifiedTestListings.has(item.itemId)) {
          console.log(`🧪 TEST LISTING DETECTED from ${sellerName}: ${item.title.substring(0, 50)}...`);
          await sendTestListingNotification(item);
          notifiedTestListings.add(item.itemId);
        }
        continue;
      }

      // Skip already rejected items (saves API calls)
      if (rejectedItemIds.has(item.itemId)) {
        skippedRejected++;
        continue;
      }

      // Basic exclusion check
      const exclusionCheck = shouldExcludeItem(task, item);
      if (exclusionCheck.exclude) {
        console.log(`🚫 Excluding: ${exclusionCheck.reason}`);
        excludedItems++;
        continue;
      }

      // Condition filter - check if item matches selected conditions
      const selectedConditions = getConditionsFromFilters(task);
      if (selectedConditions.length > 0 && item.condition) {
        const itemCondition = item.condition.toLowerCase();
        const conditionsLower = selectedConditions.map((c: string) => c.toLowerCase());

        // Check if item condition matches any selected condition
        const conditionMatches = conditionsLower.some((selected: string) => {
          // Handle variations: "Pre-owned" matches "pre-owned", "Pre-Owned", etc.
          if (selected === 'pre-owned' && (itemCondition.includes('pre-owned') || itemCondition.includes('pre owned') || itemCondition === 'used')) {
            return true;
          }
          if (selected === 'new' && itemCondition === 'new') {
            return true;
          }
          return itemCondition.includes(selected);
        });

        if (!conditionMatches) {
          console.log(`🚫 Excluding wrong condition "${item.condition}" (want: ${selectedConditions.join(', ')}): ${item.title.substring(0, 40)}...`);
          excludedItems++;
          continue;
        }
      }

      // Early check for plated/filled/base metal items (common false positives)
      if (task.item_type === 'jewelry') {
        const titleLower = item.title.toLowerCase();
        // Check for plated/filled
        if (titleLower.includes('plated') || titleLower.includes('gold-plated') ||
            titleLower.includes('silver-plated') || titleLower.includes('filled') ||
            titleLower.includes('gold-filled') || titleLower.includes('vermeil') ||
            titleLower.includes('gold tone') || titleLower.includes('goldtone')) {
          console.log(`🚫 Excluding plated/filled: ${item.title.substring(0, 50)}...`);
          excludedItems++;
          continue;
        }
        // Check for base metals in title
        const baseMet = ['brass', 'bronze', 'copper', 'pewter', 'alloy', 'stainless', 'titanium', 'tungsten', 'nickel'];
        const foundBaseMetal = baseMet.find(m => titleLower.includes(m));
        if (foundBaseMetal) {
          console.log(`🚫 Excluding base metal "${foundBaseMetal}": ${item.title.substring(0, 50)}...`);
          excludedItems++;
          continue;
        }

        // Check if silver is NOT selected but item contains silver
        const selectedMetals = task.jewelry_filters?.metal || [];
        const selectedMetalsLower = selectedMetals.map((m: string) => m.toLowerCase());
        const silverSelected = selectedMetalsLower.some((m: string) => m.includes('silver'));

        if (!silverSelected && (titleLower.includes('sterling silver') ||
            titleLower.includes('925 silver') || titleLower.includes('.925') ||
            (titleLower.includes('silver') && !titleLower.includes('gold')))) {
          console.log(`🚫 Excluding silver (not selected): ${item.title.substring(0, 50)}...`);
          excludedItems++;
          continue;
        }
      }

      // Price filters
      if (task.min_price && item.price < task.min_price) {
        excludedItems++;
        continue;
      }
      if (task.max_price && item.price > task.max_price) {
        excludedItems++;
        continue;
      }

      // Seller feedback filter
      if (task.min_seller_feedback && task.min_seller_feedback > 0) {
        const sellerFeedback = item.sellerInfo?.feedbackScore || 0;
        if (sellerFeedback < task.min_seller_feedback) {
          console.log(`  🚫 Excluding low feedback seller (${sellerFeedback} < ${task.min_seller_feedback}): ${item.title.substring(0, 40)}...`);
          excludedItems++;
          continue;
        }
      }

      // Check for duplicates
      const { data: existingMatch } = await supabase
        .from(tableName)
        .select('id')
        .eq('ebay_listing_id', item.itemId)
        .eq('task_id', task.id)
        .single();

      if (existingMatch) {
        continue;
      }

      // Gemstone-specific processing
      if (task.item_type === 'gemstone') {
        const gemstoneFilters = task.gemstone_filters || {};

        // Fetch item details for specs
        let specs: Record<string, string> = {};
        let description = '';
        if (token) {
          const itemDetails = await fetchItemDetails(item.itemId, token);
          if (itemDetails) {
            specs = extractItemSpecifics(itemDetails);
            description = itemDetails.description || '';

            // Extract shipping cost from item details
            if (itemDetails.shippingOptions && itemDetails.shippingOptions.length > 0) {
              const shippingOption = itemDetails.shippingOptions[0];
              if (shippingOption.shippingCost && shippingOption.shippingCost.value) {
                item.shippingCost = parseFloat(shippingOption.shippingCost.value) || 0;
                if (item.shippingCost > 0) {
                  console.log(`  📦 Shipping: $${item.shippingCost}`);
                }
              } else if (shippingOption.shippingCostType === 'FREE' || shippingOption.type === 'FREE') {
                item.shippingCost = 0;
              } else {
                // Log unknown format for debugging
                console.log(`  ⚠️ Unknown shipping format: ${JSON.stringify(shippingOption).substring(0, 200)}`);
                item.shippingCost = 0;
              }
            } else {
              item.shippingCost = 0;
            }

            // Check total cost (price + shipping) against max price
            const totalCostCheck = item.price + (item.shippingCost || 0);
            if (task.max_price && totalCostCheck > task.max_price) {
              console.log(`  🚫 Excluding: total cost $${totalCostCheck} > max $${task.max_price}: ${item.title.substring(0, 40)}...`);
              excludedItems++;
              continue;
            }

            // Check category - reject if not a gemstone category
            const categoryId = itemDetails.categoryId || itemDetails.primaryCategory?.categoryId;
            if (categoryId && !GEMSTONE_CATEGORY_IDS.includes(String(categoryId)) &&
                !JEWELRY_CATEGORY_IDS.includes(String(categoryId))) {
              const reason = `Wrong category ${categoryId}`;
              console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
              await cacheRejectedItem(task.id, item.itemId, reason);
              excludedItems++;
              continue;
            }
          }
        }

        // Parse stone details
        const stone = parseStoneDetails(item.title, specs, description);

        // Check blacklist
        const blacklistCheck = passesGemstoneBlacklist(item.title, specs, gemstoneFilters);
        if (blacklistCheck.blocked) {
          console.log(`  ❌ REJECTED (${blacklistCheck.reason}): ${item.title.substring(0, 40)}...`);
          await cacheRejectedItem(task.id, item.itemId, blacklistCheck.reason || 'Blacklisted');
          excludedItems++;
          continue;
        }

        // Check filters (carat range, etc.)
        const filterCheck = passesGemstoneFilters(stone, gemstoneFilters);
        if (!filterCheck.passes) {
          console.log(`  ❌ REJECTED (${filterCheck.reason}): ${item.title.substring(0, 40)}...`);
          await cacheRejectedItem(task.id, item.itemId, filterCheck.reason || 'Failed filter check');
          excludedItems++;
          continue;
        }

        // Calculate scores
        const dealScore = calculateDealScore(stone, item, gemstoneFilters);
        const riskScore = calculateRiskScore(stone, item);

        // Create match record
        const matchData = createMatchRecord(task, item, stone, dealScore, riskScore);
        const { error: insertError } = await supabase.from(tableName).insert(matchData);

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          console.log(`✅ Match: ${stone.carat || '?'}ct ${stone.stone_type || 'Stone'} - $${item.price} (Deal: ${dealScore}, Risk: ${riskScore})`);
          newMatches++;

          // Send Slack notification for gemstone match
          await sendGemstoneSlackNotification(matchData, stone, dealScore, riskScore);
        }
      }
      // Jewelry-specific processing
      else if (task.item_type === 'jewelry') {
        const jewelryFilters = task.jewelry_filters || {};
        let specs: Record<string, string> = {};
        let description = '';

        if (token) {
          const itemDetails = await fetchItemDetails(item.itemId, token);
          if (itemDetails) {
            specs = extractItemSpecifics(itemDetails);
            description = itemDetails.description || '';

            // Extract shipping cost from item details
            if (itemDetails.shippingOptions && itemDetails.shippingOptions.length > 0) {
              const shippingOption = itemDetails.shippingOptions[0];
              if (shippingOption.shippingCost && shippingOption.shippingCost.value) {
                item.shippingCost = parseFloat(shippingOption.shippingCost.value) || 0;
                if (item.shippingCost > 0) {
                  console.log(`  📦 Shipping: $${item.shippingCost}`);
                }
              } else if (shippingOption.shippingCostType === 'FREE' || shippingOption.type === 'FREE') {
                item.shippingCost = 0;
              } else {
                // Log unknown format for debugging
                console.log(`  ⚠️ Unknown shipping format: ${JSON.stringify(shippingOption).substring(0, 200)}`);
                item.shippingCost = 0;
              }
            } else {
              item.shippingCost = 0;
            }

            // Check total cost (price + shipping) against max price
            const totalCostCheck = item.price + (item.shippingCost || 0);
            if (task.max_price && totalCostCheck > task.max_price) {
              console.log(`  🚫 Excluding: total cost $${totalCostCheck} > max $${task.max_price}: ${item.title.substring(0, 40)}...`);
              excludedItems++;
              continue;
            }

            // Check category - reject if in blacklist OR not in jewelry whitelist
            const categoryId = String(itemDetails.categoryId || itemDetails.primaryCategory?.categoryId || '');
            if (categoryId) {
              if (JEWELRY_BLACKLIST_CATEGORIES.includes(categoryId)) {
                const reason = `Blacklisted category ${categoryId}`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await cacheRejectedItem(task.id, item.itemId, reason);
                excludedItems++;
                continue;
              }
              // Also reject if not in jewelry categories whitelist
              if (!JEWELRY_CATEGORY_IDS.includes(categoryId)) {
                const reason = `Not a jewelry category ${categoryId}`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await cacheRejectedItem(task.id, item.itemId, reason);
                excludedItems++;
                continue;
              }
            }
          }

          // Check description for plated/base metal indicators
          if (description) {
            const descLower = description.toLowerCase().replace(/<[^>]*>/g, ' ');
            const platedTerms = ['gold plated', 'gold-plated', 'rose gold plated', 'silver plated', 'plated brass', 'brass plated', 'plated metal', 'electroplated', 'gold filled', 'gold-filled', 'rose gold filled', 'silver filled', 'gold toned', 'gold-toned', 'rose gold toned', 'silver toned', 'goldtone', 'silvertone'];
            const baseMetalTerms = ['made of brass', 'brass base', 'base metal: brass', 'brass with', 'brass material', 'solid brass'];

            let descRejected = false;
            for (const term of platedTerms) {
              if (descLower.includes(term)) {
                const reason = `Description contains plated term: "${term}"`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await cacheRejectedItem(task.id, item.itemId, reason);
                excludedItems++;
                descRejected = true;
                break;
              }
            }
            if (descRejected) continue;

            for (const term of baseMetalTerms) {
              if (descLower.includes(term)) {
                const reason = `Description contains base metal: "${term}"`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await cacheRejectedItem(task.id, item.itemId, reason);
                excludedItems++;
                descRejected = true;
                break;
              }
            }
            if (descRejected) continue;
          }
        }

        // Check for jewelry tools/supplies (welding, display stands, etc.)
        const toolCheck = hasJewelryToolTerms(item.title);
        if (toolCheck.hasTerm) {
          const reason = `Jewelry tool/supply: "${toolCheck.term}"`;
          console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
          await cacheRejectedItem(task.id, item.itemId, reason);
          excludedItems++;
          continue;
        }

        // Check item specifics (no stones, no plated/filled, no costume jewelry)
        const specsCheck = passesJewelryItemSpecifics(item.title, specs, jewelryFilters);
        if (!specsCheck.pass) {
          console.log(`  ❌ REJECTED (${specsCheck.reason}): ${item.title.substring(0, 40)}...`);
          await cacheRejectedItem(task.id, item.itemId, specsCheck.reason || 'Failed specs check');
          excludedItems++;
          continue;
        }

        // Extract karat and weight (from title, specs, or description)
        // Debug: log description status
        if (description && description.length > 0) {
          console.log(`    📝 Description: ${description.length} chars`);
        } else {
          console.log(`    ⚠️ No description available for weight extraction`);
        }

        const karat = extractKarat(item.title, specs, description);
        const weight = extractWeight(item.title, specs, description);

        // Debug: log if weight wasn't found but description exists
        if (!weight && description && description.length > 50) {
          console.log(`    ⚠️ Weight not extracted from description: "${description.substring(0, 100)}..."`);
        }

        // Detect metal type (gold, silver, platinum, palladium)
        const metalInfo = detectMetalType(item.title, specs);
        const metalType = metalInfo.type;
        const purity = metalInfo.purity || (karat ? karat : null);

        // Calculate melt value and break-even
        let meltValue: number | null = null;
        let profitScrap: number | null = null;
        let breakEven: number | null = null;
        const shippingCost = item.shippingCost || 0;
        const totalCost = item.price + shippingCost;

        if (purity && weight) {
          const metalPrices = await getMetalPrices();
          if (metalPrices) {
            if (metalType === 'gold' && metalPrices.Gold) {
              meltValue = calculateGoldMeltValue(karat, weight, metalPrices.Gold);
            } else if (metalType === 'silver' && metalPrices.Silver) {
              meltValue = calculateSilverMeltValue(purity, weight, metalPrices.Silver);
            } else if (metalType === 'platinum' && metalPrices.Platinum) {
              meltValue = calculatePlatinumMeltValue(purity, weight, metalPrices.Platinum);
            } else if (metalType === 'palladium' && metalPrices.Palladium) {
              meltValue = calculatePlatinumMeltValue(purity, weight, metalPrices.Palladium);
            }

            if (meltValue) {
              breakEven = meltValue * 0.97; // 3% refining cost
              profitScrap = meltValue - totalCost;

              // Check profit margin against user's minimum setting
              const profitMarginPct = ((breakEven - totalCost) / totalCost) * 100;
              // Check task-level setting first, then fall back to filter setting
              const minProfitMargin = task.min_profit_margin ?? jewelryFilters.min_profit_margin;

              // If user set a minimum profit margin, filter by that; otherwise use default -50%
              const marginThreshold = minProfitMargin !== null && minProfitMargin !== undefined
                ? minProfitMargin
                : -50;

              if (profitMarginPct < marginThreshold) {
                const reason = `Low margin ${profitMarginPct.toFixed(0)}% < min ${marginThreshold}% - BE $${breakEven.toFixed(0)} vs cost $${totalCost.toFixed(0)}`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await cacheRejectedItem(task.id, item.itemId, reason);
                excludedItems++;
                continue;
              }
            }
          }
        }

        // Calculate suggested offer (break-even minus buffer for profit)
        const suggestedOffer = breakEven ? Math.floor(breakEven * 0.85) : null; // 15% below break-even

        const matchData = createMatchRecord(task, {
          ...item,
          karat,
          weight_g: weight,
          metalType,
          meltValue,
          profitScrap,
          breakEven,
          suggestedOffer,
        });

        const { error: insertError } = await supabase.from(tableName).insert(matchData);

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          const meltStr = meltValue ? `Melt: $${meltValue.toFixed(0)}` : '';
          const breakEvenStr = breakEven ? `BE: $${breakEven.toFixed(0)}` : '';
          console.log(`✅ Match: ${karat || '?'}K ${weight || '?'}g - $${item.price} ${meltStr} ${breakEvenStr}`);
          newMatches++;

          // Send Slack notification for jewelry match
          await sendJewelrySlackNotification(matchData, karat, weight, item.shippingCost || 0, meltValue);
        }
      }
      // Watch processing
      else if (task.item_type === 'watch') {
        let specs: Record<string, string> = {};

        if (token) {
          const itemDetails = await fetchItemDetails(item.itemId, token);
          if (itemDetails) {
            specs = extractItemSpecifics(itemDetails);

            // Extract shipping cost from item details
            if (itemDetails.shippingOptions && itemDetails.shippingOptions.length > 0) {
              const shippingOption = itemDetails.shippingOptions[0];
              if (shippingOption.shippingCost && shippingOption.shippingCost.value) {
                item.shippingCost = parseFloat(shippingOption.shippingCost.value) || 0;
                if (item.shippingCost > 0) {
                  console.log(`  📦 Shipping: $${item.shippingCost}`);
                }
              } else if (shippingOption.shippingCostType === 'FREE' || shippingOption.type === 'FREE') {
                item.shippingCost = 0;
              } else {
                // Log unknown format for debugging
                console.log(`  ⚠️ Unknown shipping format: ${JSON.stringify(shippingOption).substring(0, 200)}`);
                item.shippingCost = 0;
              }
            } else {
              item.shippingCost = 0;
            }

            // Check total cost (price + shipping) against max price
            const totalCostCheck = item.price + (item.shippingCost || 0);
            if (task.max_price && totalCostCheck > task.max_price) {
              console.log(`  🚫 Excluding: total cost $${totalCostCheck} > max $${task.max_price}: ${item.title.substring(0, 40)}...`);
              excludedItems++;
              continue;
            }
          }
        }

        // Extract watch properties
        const caseMaterial = extractWatchCaseMaterial(item.title, specs);
        const bandMaterial = extractWatchBandMaterial(item.title, specs);
        const movement = extractWatchMovement(item.title, specs);
        const dialColor = extractWatchDialColor(item.title, specs);
        const year = extractWatchYear(item.title, specs);
        const brand = extractWatchBrand(item.title, specs);
        const model = extractWatchModel(item.title, specs);

        const matchData = createMatchRecord(task, {
          ...item,
          caseMaterial,
          bandMaterial,
          movement,
          dialColor,
          year,
          brand,
          model,
        });

        const { error: insertError } = await supabase.from(tableName).insert(matchData);

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          console.log(`✅ Match: ${brand || '?'} ${model || ''} ${movement || '?'} - $${item.price}`);
          newMatches++;
        }
      }
      // Default/other processing
      else {
        const matchData = createMatchRecord(task, item);
        const { error: insertError } = await supabase.from(tableName).insert(matchData);

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          console.log(`✅ Match: ${item.title.substring(0, 50)}... - $${item.price}`);
          newMatches++;
        }
      }
    }

    // Update task last_run
    await supabase.from('tasks').update({ last_run: new Date().toISOString() }).eq('id', task.id);

    // Log completion with cache stats
    const skipMsg = skippedRejected > 0 ? `, ${skippedRejected} skipped (cached rejections)` : '';
    console.log(`🎯 Task ${task.name} completed: ${newMatches} new matches, ${excludedItems} excluded${skipMsg}`);

    // Cleanup expired cache entries periodically (1 in 10 chance)
    if (Math.random() < 0.1) {
      await cleanupExpiredCache();
    }

  } catch (error: unknown) {
    console.error(`❌ Error processing task ${task.id}:`, error);
    await supabase.from('tasks').update({ last_run: new Date().toISOString() }).eq('id', task.id);
  }
};

// ============================================
// Main Worker Loop
// ============================================

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function runOnce(): Promise<void> {
  console.log(`\n🚀 Poll cycle started at ${new Date().toISOString()}`);

  try {
    // Fetch all active tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    if (!tasks || tasks.length === 0) {
      console.log('📭 No active tasks to process');
      return;
    }

    console.log(`📋 Found ${tasks.length} active task(s) to process`);

    // Process all tasks in parallel
    console.log(`🚀 Running ${tasks.length} task(s) in parallel...`);

    const results = await Promise.allSettled(
      tasks.map(async (task: any) => {
        console.log(`\n--- Starting Task: ${task.name} ---`);
        await processTask(task);
        return task.name;
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const errorCount = results.filter(r => r.status === 'rejected').length;

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`❌ Task ${tasks[index].name} failed:`, (result as PromiseRejectedResult).reason);
      }
    });

    console.log(`✅ Poll cycle completed: ${successCount} successful, ${errorCount} failed`);

  } catch (error: any) {
    console.error('💥 Error in poll cycle:', error);
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('🏃 eBay Hunter Worker Starting...');
  console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`🔗 Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log('='.repeat(50));

  // Verify Supabase connection
  const { error } = await supabase.from('tasks').select('count').limit(1);
  if (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    process.exit(1);
  }
  console.log('✅ Connected to Supabase');

  // Main loop
  while (true) {
    const startTime = Date.now();

    await runOnce();

    // Calculate time to wait for next poll
    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, POLL_INTERVAL_MS - elapsed);

    if (waitTime > 0) {
      await sleep(waitTime);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the worker
main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
