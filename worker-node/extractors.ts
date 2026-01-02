// ============================================
// Pure extraction and filtering functions for jewelry/watch/gemstone analysis
// Extracted for testability
// ============================================

// ============================================
// Constants for Filtering
// ============================================

// Bad metals to reject (plated, filled, base metals)
export const BAD_METALS = ['plated', 'filled', 'steel', 'brass', 'bronze', 'copper', 'alloy', 'tone'];

// Base metals to reject (not precious metals)
export const BASE_METALS_TO_REJECT = [
  'stainless steel', 'titanium', 'tungsten', 'aluminum', 'aluminium',
  'nickel', 'zinc', 'pewter', 'iron'
];

// Costume/fashion jewelry keywords to always exclude
export const COSTUME_JEWELRY_EXCLUSIONS = [
  'snap jewelry', 'snap button', 'rhinestone', 'costume', 'fashion jewelry',
  'acrylic', 'plastic', 'glass bead', 'simulated', 'faux', 'fake', 'imitation',
  'cubic zirconia', 'cz stone', ' cz ', 'crystal bead', 'resin', 'enamel',
  'leather', 'cord', 'rope chain', 'paracord',
  ' gf ', ' gf', 'gold gf', ' gp ', ' gp', 'gold gp',
  ' hge ', ' rgp ', ' gep ', 'gold tone', 'goldtone',
  'gold plated', 'gold-plated', 'silver plated', 'silver-plated',
  'gold filled', 'gold-filled', 'rolled gold', 'vermeil'
];

// Jewelry tools, supplies, and equipment to exclude
export const JEWELRY_TOOLS_EXCLUSIONS = [
  'welding', 'welder', 'soldering', 'solder', 'torch', 'pliers', 'mandrel',
  'polishing', 'polisher', 'buffing', 'tumbler', 'jewelry making', 'jewelry tool',
  'jewelry tools', 'craft supplies', 'beading', 'bead kit', 'findings',
  'clasps lot', 'jump rings lot', 'wire wrap', 'display stand', 'jewelry box',
  'jewelry case', 'ring sizer', 'loupe', 'magnifier', 'scale gram', 'test kit',
  'acid test', 'repair kit', 'mold', 'casting', 'crucible', 'mannequin',
  'bust display', 'organizer', 'storage box', 'plating machine', 'plating rectifier',
  'electroplating', 'plater', 'pen plater', 'tester', 'testing kit', 'appraisal kit',
  'testing acid', 'test stone', 'touchstone'
];

// Stone keywords (items containing these may have gemstones)
export const STONE_KEYWORDS = [
  'diamond', 'ruby', 'sapphire', 'emerald', 'opal', 'amethyst', 'aquamarine',
  'garnet', 'topaz', 'pearl', 'peridot', 'tanzanite', 'tourmaline', 'citrine',
  'onyx', 'turquoise', 'moissanite', 'cz', 'cubic zirconia', 'zirconia',
  'crystal', 'gemstone', 'stone', 'pave', 'pavé', 'halo', 'solitaire',
  'three stone', '3 stone', 'birthstone', 'malachite', 'lapis', 'jade',
  'coral', 'carnelian', 'agate', 'jasper', 'moonstone', 'labradorite',
  'alexandrite', 'iolite', 'spinel', 'zircon'
];

// ============================================
// Filtering Helper Functions
// ============================================

/**
 * Check if a value indicates "no stone" in item specs
 */
export function isNoStoneValue(value: string): boolean {
  if (!value) return true;
  const lower = value.toLowerCase().trim();
  return lower === '' || lower === 'none' || lower === 'no stone' ||
         lower === 'n/a' || lower === 'na' || lower === 'not applicable';
}

/**
 * Check if title contains stone keywords
 */
export function titleContainsStone(title: string): boolean {
  const titleLower = title.toLowerCase();
  return STONE_KEYWORDS.some(kw => titleLower.includes(kw));
}

/**
 * Check if a metal value indicates fake "tone" (gold tone, silvertone)
 * Distinguishes from legitimate two-tone/tri-tone jewelry
 */
export function isFakeTone(metalValue: string): boolean {
  if (!metalValue) return false;
  const lower = metalValue.toLowerCase();
  // Check for standalone "tone" patterns but exclude "two-tone" and "tri-tone"
  if (lower.includes('two-tone') || lower.includes('two tone') ||
      lower.includes('tri-tone') || lower.includes('tri tone') ||
      lower.includes('bicolor') || lower.includes('bi-color')) {
    return false; // These are legitimate
  }
  return lower.includes('gold tone') || lower.includes('goldtone') ||
         lower.includes('silver tone') || lower.includes('silvertone') ||
         lower.includes('rose tone') || lower.includes('rosetone');
}

/**
 * Check if title contains costume jewelry terms
 */
export function hasCostumeJewelryTerms(title: string): { hasTerm: boolean; term: string | null } {
  const titleLower = ' ' + title.toLowerCase() + ' '; // Add spaces for word boundary matching
  for (const term of COSTUME_JEWELRY_EXCLUSIONS) {
    if (titleLower.includes(term)) {
      return { hasTerm: true, term };
    }
  }
  return { hasTerm: false, term: null };
}

/**
 * Check if title contains jewelry tools/equipment terms
 */
export function hasJewelryToolTerms(title: string): { hasTerm: boolean; term: string | null } {
  const titleLower = title.toLowerCase();
  for (const term of JEWELRY_TOOLS_EXCLUSIONS) {
    if (titleLower.includes(term)) {
      return { hasTerm: true, term };
    }
  }
  return { hasTerm: false, term: null };
}

/**
 * Check if item should be excluded based on excluded keywords list
 */
export function shouldExcludeByKeywords(title: string, excludeKeywords: string[]): { exclude: boolean; keyword: string | null } {
  if (!excludeKeywords || excludeKeywords.length === 0) {
    return { exclude: false, keyword: null };
  }
  const titleLower = title.toLowerCase();
  for (const keyword of excludeKeywords) {
    if (titleLower.includes(keyword.toLowerCase())) {
      return { exclude: true, keyword };
    }
  }
  return { exclude: false, keyword: null };
}

/**
 * Check jewelry item specs for exclusion criteria
 * Returns { pass: true } if item passes all checks
 * Returns { pass: false, reason: "..." } if item should be excluded
 */
export function passesJewelryItemSpecs(
  title: string,
  specs: Record<string, string>,
  filters: { metal?: string[]; no_stone?: boolean } = {}
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

/**
 * Extract shipping cost from eBay API item details
 * Handles multiple API response formats
 */
export function extractShippingCost(itemDetails: any): { cost: number; type: string } {
  // Default: no shipping info found
  let cost = 0;
  let type = 'unknown';

  // Try shippingOptions array first (most common)
  if (itemDetails?.shippingOptions && itemDetails.shippingOptions.length > 0) {
    const option = itemDetails.shippingOptions[0];

    // Format 1: shippingCost.value
    if (option.shippingCost?.value !== undefined) {
      cost = parseFloat(option.shippingCost.value) || 0;
      type = cost === 0 ? 'free' : 'fixed';
      return { cost, type };
    }

    // Format 2: shippingServiceCost.value (alternate format)
    if (option.shippingServiceCost?.value !== undefined) {
      cost = parseFloat(option.shippingServiceCost.value) || 0;
      type = cost === 0 ? 'free' : 'fixed';
      return { cost, type };
    }

    // Format 3: Check for FREE shipping indicators
    if (option.shippingCostType === 'FREE' ||
        option.type === 'FREE' ||
        option.shippingType === 'FREE') {
      return { cost: 0, type: 'free' };
    }

    // Format 4: minEstimatedDeliveryDate indicates calculated shipping
    if (option.shippingCostType === 'CALCULATED' || option.type === 'CALCULATED') {
      type = 'calculated';
      // Try to get estimated cost if available
      if (option.estimatedShippingCost?.value !== undefined) {
        cost = parseFloat(option.estimatedShippingCost.value) || 0;
      }
      return { cost, type };
    }
  }

  // Try direct shippingCost on item (some API versions)
  if (itemDetails?.shippingCost?.value !== undefined) {
    cost = parseFloat(itemDetails.shippingCost.value) || 0;
    type = cost === 0 ? 'free' : 'fixed';
    return { cost, type };
  }

  // Try shipToLocations format
  if (itemDetails?.shipToLocations?.regionIncluded) {
    // This usually means calculated shipping, try to find cost elsewhere
    type = 'calculated';
  }

  return { cost, type };
}

/**
 * Extract karat value from title, specs, or description
 * Valid karats: 8, 9, 10, 14, 18, 22, 24
 */
export function extractKarat(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
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
          return karat;
        }
      }
    }
  }

  return null;
}

/**
 * Extract weight in grams from title, specs, or description
 * Supports grams, oz, and dwt units
 */
export function extractWeight(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
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
        }
        const value = parseFloat(rawValue);
        if (value > 0 && value < 1000) {
          return value;
        }
      }
    }

    // Check for oz in description
    ozMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*([\d.]+)\s*(?:oz|ounce|ounces)\b/i);
    if (ozMatch) {
      return parseFloat(ozMatch[1]) * 28.3495;
    }

    // Check for dwt in description
    dwtMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*([\d.]+)\s*(?:dwt|penny\s*weight)/i);
    if (dwtMatch) {
      return parseFloat(dwtMatch[1]) * 1.555;
    }
  }

  return null;
}

/**
 * Detect metal type and purity from title and specs
 */
export function detectMetalType(title: string, specs: Record<string, string>): { type: string; purity: number | null } {
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

/**
 * Calculate gold melt value
 */
export function calculateGoldMeltValue(karat: number | null, weightG: number | null, goldPrices: { usd_per_gram?: number } | null): number | null {
  if (!karat || !weightG || !goldPrices?.usd_per_gram) return null;

  const purity = karat / 24;
  const pureGoldGrams = weightG * purity;
  return pureGoldGrams * goldPrices.usd_per_gram;
}

/**
 * Calculate silver melt value
 */
export function calculateSilverMeltValue(purity: number | null, weightG: number | null, silverPrices: { usd_per_gram?: number } | null): number | null {
  if (!purity || !weightG || !silverPrices?.usd_per_gram) return null;

  const purityDecimal = purity / 1000;
  const pureSilverGrams = weightG * purityDecimal;
  return pureSilverGrams * silverPrices.usd_per_gram;
}

/**
 * Calculate platinum melt value
 */
export function calculatePlatinumMeltValue(purity: number | null, weightG: number | null, platinumPrices: { usd_per_gram?: number } | null): number | null {
  if (!purity || !weightG || !platinumPrices?.usd_per_gram) return null;

  const purityDecimal = purity / 1000;
  const purePlatinumGrams = weightG * purityDecimal;
  return purePlatinumGrams * platinumPrices.usd_per_gram;
}
