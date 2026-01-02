import { describe, it, expect } from 'vitest';
import {
  extractKarat,
  extractWeight,
  detectMetalType,
  calculateGoldMeltValue,
  calculateSilverMeltValue,
  calculatePlatinumMeltValue,
  extractShippingCost,
  // Filtering functions
  isNoStoneValue,
  titleContainsStone,
  isFakeTone,
  hasCostumeJewelryTerms,
  hasJewelryToolTerms,
  shouldExcludeByKeywords,
  passesJewelryItemSpecs,
} from './extractors';

describe('extractKarat', () => {
  describe('from title', () => {
    it('should extract 14K from title', () => {
      expect(extractKarat('14K Gold Ring', {})).toBe(14);
    });

    it('should extract 18k (lowercase) from title', () => {
      expect(extractKarat('18k Yellow Gold Necklace', {})).toBe(18);
    });

    it('should extract 10kt from title', () => {
      expect(extractKarat('10kt White Gold Bracelet', {})).toBe(10);
    });

    it('should extract 24 karat from title', () => {
      expect(extractKarat('24 Karat Gold Bar', {})).toBe(24);
    });

    it('should extract 22K from title', () => {
      expect(extractKarat('22K Indian Gold Bangle', {})).toBe(22);
    });

    it('should NOT match invalid karats', () => {
      expect(extractKarat('12K Gold Plated Ring', {})).toBe(null);
      expect(extractKarat('15K Something', {})).toBe(null);
    });

    it('should handle 9K gold', () => {
      expect(extractKarat('9K British Gold Ring', {})).toBe(9);
    });
  });

  describe('from specs', () => {
    it('should extract karat from metal purity spec', () => {
      expect(extractKarat('Gold Ring', { 'metal purity': '14K' })).toBe(14);
    });

    it('should extract karat from purity spec', () => {
      expect(extractKarat('Gold Ring', { 'purity': '18k Gold' })).toBe(18);
    });

    it('should prioritize specs over title', () => {
      expect(extractKarat('10K Gold Ring', { 'metal purity': '14K' })).toBe(14);
    });
  });

  describe('from description', () => {
    it('should extract karat from plain text description', () => {
      expect(extractKarat('Gold Ring', {}, 'This beautiful 14k gold ring')).toBe(14);
    });

    it('should extract karat from HTML description', () => {
      expect(extractKarat('Gold Ring', {}, '<p>Stunning <b>18K gold</b> necklace</p>')).toBe(18);
    });

    it('should handle &nbsp; entities', () => {
      expect(extractKarat('Gold Ring', {}, 'Made&nbsp;of&nbsp;14K&nbsp;gold')).toBe(14);
    });
  });

  describe('edge cases', () => {
    it('should return null for no karat info', () => {
      expect(extractKarat('Beautiful Ring', {})).toBe(null);
    });

    it('should return null for gold plated items', () => {
      // "Gold Plated" doesn't have a karat number
      expect(extractKarat('Gold Plated Ring', {})).toBe(null);
    });

    it('should not extract 14 from dates or other numbers', () => {
      expect(extractKarat('Ring Size 14', {})).toBe(null);
    });
  });
});

describe('extractWeight', () => {
  describe('from specs', () => {
    it('should extract weight from "total weight" spec', () => {
      expect(extractWeight('Gold Ring', { 'total weight': '5.5g' })).toBe(5.5);
    });

    it('should extract weight from "gram weight" spec', () => {
      expect(extractWeight('Gold Ring', { 'gram weight': '3.2 grams' })).toBe(3.2);
    });

    it('should extract weight from "item weight" spec', () => {
      expect(extractWeight('Gold Ring', { 'item weight': '10g' })).toBe(10);
    });

    it('should convert oz to grams', () => {
      const result = extractWeight('Gold Ring', { 'total weight': '1 oz' });
      expect(result).toBeCloseTo(28.3495, 2);
    });

    it('should convert dwt to grams', () => {
      const result = extractWeight('Gold Ring', { 'total weight': '10 dwt' });
      expect(result).toBeCloseTo(15.55, 2);
    });
  });

  describe('from title', () => {
    it('should extract weight from title with g suffix', () => {
      expect(extractWeight('14K Gold Ring 5g', {})).toBe(5);
    });

    it('should extract weight from title with grams suffix', () => {
      expect(extractWeight('18K Gold Chain 12.5 grams', {})).toBe(12.5);
    });

    it('should extract weight from title with gr suffix', () => {
      expect(extractWeight('Gold Bracelet 8.3gr', {})).toBe(8.3);
    });

    it('should NOT match karat as weight (14K should not become 14g)', () => {
      // 14K should not be parsed as weight
      expect(extractWeight('14K Gold Ring', {})).toBe(null);
    });
  });

  describe('from description', () => {
    it('should extract "Weight - .96 grams" pattern', () => {
      expect(extractWeight('Gold Pendant', {}, 'Weight - .96 grams')).toBe(0.96);
    });

    it('should extract "Weight: 5.5g" pattern', () => {
      expect(extractWeight('Gold Ring', {}, 'Specifications: Weight: 5.5g')).toBe(5.5);
    });

    it('should extract weight from HTML description', () => {
      expect(extractWeight('Gold Ring', {}, '<p>Weight: <b>3.2 grams</b></p>')).toBe(3.2);
    });

    it('should handle weight in complex description', () => {
      const desc = 'This 14K gold ring weighs approximately 4.5 grams. Perfect for everyday wear.';
      expect(extractWeight('Gold Ring', {}, desc)).toBe(4.5);
    });

    it('should fix double period typo (.1.08 -> 1.08)', () => {
      expect(extractWeight('Gold Ring', {}, 'Weight: .1.08 grams')).toBe(1.08);
    });
  });

  describe('edge cases', () => {
    it('should return null for no weight info', () => {
      expect(extractWeight('Beautiful Gold Ring', {})).toBe(null);
    });

    it('should handle decimal weights without leading zero', () => {
      expect(extractWeight('Gold Pendant', {}, 'Weight .53 grams')).toBe(0.53);
    });

    it('should not match unreasonable weights (> 1000g)', () => {
      // The function has a 1000g max check
      expect(extractWeight('Gold Ring', {}, 'Part number: 1500g')).toBe(null);
    });
  });
});

describe('detectMetalType', () => {
  describe('gold detection', () => {
    it('should default to gold when no other metal detected', () => {
      const result = detectMetalType('14K Yellow Gold Ring', {});
      expect(result.type).toBe('gold');
      expect(result.purity).toBe(null);
    });
  });

  describe('platinum detection', () => {
    it('should detect platinum from title', () => {
      const result = detectMetalType('Platinum Diamond Ring', {});
      expect(result.type).toBe('platinum');
      expect(result.purity).toBe(950);
    });

    it('should detect pt950', () => {
      const result = detectMetalType('PT950 Ring', {});
      expect(result.type).toBe('platinum');
      expect(result.purity).toBe(950);
    });

    it('should detect pt900', () => {
      const result = detectMetalType('PT900 Platinum Ring', {});
      expect(result.type).toBe('platinum');
      expect(result.purity).toBe(900);
    });

    it('should detect platinum from specs', () => {
      const result = detectMetalType('Diamond Ring', { 'metal': 'Platinum' });
      expect(result.type).toBe('platinum');
    });
  });

  describe('silver detection', () => {
    it('should detect sterling silver', () => {
      const result = detectMetalType('Sterling Silver Necklace', {});
      expect(result.type).toBe('silver');
      expect(result.purity).toBe(925);
    });

    it('should detect 925 silver', () => {
      const result = detectMetalType('925 Silver Ring', {});
      expect(result.type).toBe('silver');
      expect(result.purity).toBe(925);
    });

    it('should detect fine silver (999)', () => {
      const result = detectMetalType('999 Fine Silver Bar', {});
      expect(result.type).toBe('silver');
      expect(result.purity).toBe(999);
    });

    it('should detect silver from specs', () => {
      const result = detectMetalType('Ring', { 'metal': 'Sterling Silver', 'purity': '925' });
      expect(result.type).toBe('silver');
      expect(result.purity).toBe(925);
    });
  });

  describe('palladium detection', () => {
    it('should detect palladium', () => {
      const result = detectMetalType('Palladium Wedding Band', {});
      expect(result.type).toBe('palladium');
      expect(result.purity).toBe(950);
    });

    it('should detect pd500', () => {
      const result = detectMetalType('PD500 Ring', {});
      expect(result.type).toBe('palladium');
      expect(result.purity).toBe(500);
    });
  });
});

describe('calculateGoldMeltValue', () => {
  const goldPrices = { usd_per_gram: 80 }; // Example: $80/gram pure gold

  it('should calculate melt value for 24K gold', () => {
    // 24K = 100% pure, 10g = 10g pure gold
    const result = calculateGoldMeltValue(24, 10, goldPrices);
    expect(result).toBe(800); // 10g * $80
  });

  it('should calculate melt value for 18K gold', () => {
    // 18K = 75% pure, 10g = 7.5g pure gold
    const result = calculateGoldMeltValue(18, 10, goldPrices);
    expect(result).toBe(600); // 7.5g * $80
  });

  it('should calculate melt value for 14K gold', () => {
    // 14K = 58.33% pure, 10g = 5.833g pure gold
    const result = calculateGoldMeltValue(14, 10, goldPrices);
    expect(result).toBeCloseTo(466.67, 1); // 5.833g * $80
  });

  it('should return null for missing karat', () => {
    expect(calculateGoldMeltValue(null, 10, goldPrices)).toBe(null);
  });

  it('should return null for missing weight', () => {
    expect(calculateGoldMeltValue(14, null, goldPrices)).toBe(null);
  });

  it('should return null for missing prices', () => {
    expect(calculateGoldMeltValue(14, 10, null)).toBe(null);
  });
});

describe('calculateSilverMeltValue', () => {
  const silverPrices = { usd_per_gram: 1 }; // Example: $1/gram pure silver

  it('should calculate melt value for 925 sterling silver', () => {
    // 925 = 92.5% pure, 100g = 92.5g pure silver
    const result = calculateSilverMeltValue(925, 100, silverPrices);
    expect(result).toBe(92.5);
  });

  it('should calculate melt value for 999 fine silver', () => {
    // 999 = 99.9% pure, 100g = 99.9g pure silver
    const result = calculateSilverMeltValue(999, 100, silverPrices);
    expect(result).toBe(99.9);
  });

  it('should return null for missing purity', () => {
    expect(calculateSilverMeltValue(null, 100, silverPrices)).toBe(null);
  });
});

describe('extractShippingCost', () => {
  it('should extract shipping from shippingCost.value format', () => {
    const itemDetails = {
      shippingOptions: [{
        shippingCost: { value: '16.45', currency: 'USD' }
      }]
    };
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(16.45);
    expect(result.type).toBe('fixed');
  });

  it('should extract shipping from shippingServiceCost.value format', () => {
    const itemDetails = {
      shippingOptions: [{
        shippingServiceCost: { value: '12.99', currency: 'USD' }
      }]
    };
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(12.99);
    expect(result.type).toBe('fixed');
  });

  it('should detect FREE shipping from shippingCostType', () => {
    const itemDetails = {
      shippingOptions: [{
        shippingCostType: 'FREE'
      }]
    };
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(0);
    expect(result.type).toBe('free');
  });

  it('should detect FREE shipping from type field', () => {
    const itemDetails = {
      shippingOptions: [{
        type: 'FREE'
      }]
    };
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(0);
    expect(result.type).toBe('free');
  });

  it('should detect FREE shipping from zero cost value', () => {
    const itemDetails = {
      shippingOptions: [{
        shippingCost: { value: '0.00', currency: 'USD' }
      }]
    };
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(0);
    expect(result.type).toBe('free');
  });

  it('should detect CALCULATED shipping type', () => {
    const itemDetails = {
      shippingOptions: [{
        shippingCostType: 'CALCULATED'
      }]
    };
    const result = extractShippingCost(itemDetails);
    expect(result.type).toBe('calculated');
  });

  it('should extract estimated cost for calculated shipping', () => {
    const itemDetails = {
      shippingOptions: [{
        shippingCostType: 'CALCULATED',
        estimatedShippingCost: { value: '8.50', currency: 'USD' }
      }]
    };
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(8.5);
    expect(result.type).toBe('calculated');
  });

  it('should try direct shippingCost on item', () => {
    const itemDetails = {
      shippingCost: { value: '5.99', currency: 'USD' }
    };
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(5.99);
    expect(result.type).toBe('fixed');
  });

  it('should return unknown for no shipping info', () => {
    const itemDetails = {};
    const result = extractShippingCost(itemDetails);
    expect(result.cost).toBe(0);
    expect(result.type).toBe('unknown');
  });

  it('should handle null/undefined itemDetails', () => {
    expect(extractShippingCost(null).type).toBe('unknown');
    expect(extractShippingCost(undefined).type).toBe('unknown');
  });
});

describe('calculatePlatinumMeltValue', () => {
  const platinumPrices = { usd_per_gram: 35 }; // Example: $35/gram pure platinum

  it('should calculate melt value for 950 platinum', () => {
    // 950 = 95% pure, 10g = 9.5g pure platinum
    const result = calculatePlatinumMeltValue(950, 10, platinumPrices);
    expect(result).toBe(332.5); // 9.5g * $35
  });

  it('should calculate melt value for 900 platinum', () => {
    // 900 = 90% pure, 10g = 9g pure platinum
    const result = calculatePlatinumMeltValue(900, 10, platinumPrices);
    expect(result).toBe(315); // 9g * $35
  });

  it('should return null for missing parameters', () => {
    expect(calculatePlatinumMeltValue(null, 10, platinumPrices)).toBe(null);
    expect(calculatePlatinumMeltValue(950, null, platinumPrices)).toBe(null);
    expect(calculatePlatinumMeltValue(950, 10, null)).toBe(null);
  });
});

// ============================================
// FILTERING FUNCTION TESTS
// These ensure unrelated items are properly excluded
// ============================================

describe('isNoStoneValue', () => {
  it('should return true for empty/null values', () => {
    expect(isNoStoneValue('')).toBe(true);
    expect(isNoStoneValue('  ')).toBe(true);
  });

  it('should return true for "none" variations', () => {
    expect(isNoStoneValue('None')).toBe(true);
    expect(isNoStoneValue('NONE')).toBe(true);
    expect(isNoStoneValue('No Stone')).toBe(true);
    expect(isNoStoneValue('N/A')).toBe(true);
    expect(isNoStoneValue('NA')).toBe(true);
    expect(isNoStoneValue('Not Applicable')).toBe(true);
  });

  it('should return false for actual stone values', () => {
    expect(isNoStoneValue('Diamond')).toBe(false);
    expect(isNoStoneValue('Ruby')).toBe(false);
    expect(isNoStoneValue('Cubic Zirconia')).toBe(false);
  });
});

describe('titleContainsStone', () => {
  it('should detect diamond in title', () => {
    expect(titleContainsStone('14K Gold Diamond Ring')).toBe(true);
  });

  it('should detect ruby in title', () => {
    expect(titleContainsStone('Ruby and Gold Necklace')).toBe(true);
  });

  it('should detect CZ/cubic zirconia in title', () => {
    expect(titleContainsStone('Gold Ring with CZ Stones')).toBe(true);
    expect(titleContainsStone('Cubic Zirconia Earrings')).toBe(true);
  });

  it('should detect pave in title', () => {
    expect(titleContainsStone('14K Gold Pave Ring')).toBe(true);
  });

  it('should return false for plain gold jewelry', () => {
    expect(titleContainsStone('14K Yellow Gold Chain Necklace')).toBe(false);
    expect(titleContainsStone('18K Gold Wedding Band')).toBe(false);
  });
});

describe('isFakeTone', () => {
  it('should detect gold tone as fake', () => {
    expect(isFakeTone('gold tone')).toBe(true);
    expect(isFakeTone('goldtone')).toBe(true);
  });

  it('should detect silver tone as fake', () => {
    expect(isFakeTone('silver tone')).toBe(true);
    expect(isFakeTone('silvertone')).toBe(true);
  });

  it('should NOT flag two-tone as fake (legitimate)', () => {
    expect(isFakeTone('two-tone gold')).toBe(false);
    expect(isFakeTone('two tone')).toBe(false);
  });

  it('should NOT flag tri-tone as fake (legitimate)', () => {
    expect(isFakeTone('tri-tone gold')).toBe(false);
    expect(isFakeTone('tri tone')).toBe(false);
  });

  it('should return false for real gold', () => {
    expect(isFakeTone('14k gold')).toBe(false);
    expect(isFakeTone('yellow gold')).toBe(false);
  });
});

describe('hasCostumeJewelryTerms', () => {
  it('should detect rhinestone', () => {
    const result = hasCostumeJewelryTerms('Rhinestone Crystal Necklace');
    expect(result.hasTerm).toBe(true);
    expect(result.term).toBe('rhinestone');
  });

  it('should detect gold plated', () => {
    const result = hasCostumeJewelryTerms('Gold Plated Ring');
    expect(result.hasTerm).toBe(true);
    expect(result.term).toBe('gold plated');
  });

  it('should detect gold filled', () => {
    const result = hasCostumeJewelryTerms('14K Gold Filled Chain');
    expect(result.hasTerm).toBe(true);
    expect(result.term).toBe('gold filled');
  });

  it('should detect costume jewelry', () => {
    const result = hasCostumeJewelryTerms('Vintage Costume Necklace');
    expect(result.hasTerm).toBe(true);
    expect(result.term).toBe('costume');
  });

  it('should detect vermeil', () => {
    const result = hasCostumeJewelryTerms('Gold Vermeil Earrings');
    expect(result.hasTerm).toBe(true);
    expect(result.term).toBe('vermeil');
  });

  it('should NOT flag real gold jewelry', () => {
    const result = hasCostumeJewelryTerms('14K Solid Gold Ring');
    expect(result.hasTerm).toBe(false);
  });
});

describe('hasJewelryToolTerms', () => {
  it('should detect jewelry making supplies', () => {
    const result = hasJewelryToolTerms('Jewelry Making Kit with Pliers');
    expect(result.hasTerm).toBe(true);
  });

  it('should detect jewelry tools', () => {
    const result = hasJewelryToolTerms('Professional Jewelry Tool Set');
    expect(result.hasTerm).toBe(true);
  });

  it('should detect testing equipment', () => {
    const result = hasJewelryToolTerms('Gold Acid Test Kit');
    expect(result.hasTerm).toBe(true);
  });

  it('should detect display items', () => {
    const result = hasJewelryToolTerms('Velvet Jewelry Box');
    expect(result.hasTerm).toBe(true);
  });

  it('should detect polishing equipment', () => {
    const result = hasJewelryToolTerms('Jewelry Polishing Machine');
    expect(result.hasTerm).toBe(true);
  });

  it('should NOT flag actual jewelry', () => {
    const result = hasJewelryToolTerms('14K Gold Diamond Ring');
    expect(result.hasTerm).toBe(false);
  });
});

describe('shouldExcludeByKeywords', () => {
  it('should exclude item with matching keyword', () => {
    const result = shouldExcludeByKeywords('Broken Gold Ring - For Repair', ['broken', 'damaged']);
    expect(result.exclude).toBe(true);
    expect(result.keyword).toBe('broken');
  });

  it('should exclude case-insensitively', () => {
    const result = shouldExcludeByKeywords('DAMAGED Gold Chain', ['broken', 'damaged']);
    expect(result.exclude).toBe(true);
    expect(result.keyword).toBe('damaged');
  });

  it('should NOT exclude when no keywords match', () => {
    const result = shouldExcludeByKeywords('Beautiful 14K Gold Ring', ['broken', 'damaged']);
    expect(result.exclude).toBe(false);
  });

  it('should handle empty keyword list', () => {
    const result = shouldExcludeByKeywords('Broken Ring', []);
    expect(result.exclude).toBe(false);
  });
});

describe('passesJewelryItemSpecs', () => {
  describe('bad metal detection', () => {
    it('should reject gold plated items', () => {
      const result = passesJewelryItemSpecs('Gold Ring', { 'metal': 'Gold Plated' });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('plated');
    });

    it('should reject gold filled items', () => {
      const result = passesJewelryItemSpecs('Gold Chain', { 'base metal': 'Gold Filled' });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('filled');
    });

    it('should reject stainless steel', () => {
      const result = passesJewelryItemSpecs('Gold Ring', { 'metal': 'Stainless Steel' });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('steel');
    });

    it('should reject brass', () => {
      const result = passesJewelryItemSpecs('Ring', { 'material': 'Brass' });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('brass');
    });
  });

  describe('base metal detection', () => {
    it('should reject titanium', () => {
      const result = passesJewelryItemSpecs('Ring', { 'metal': 'Titanium' });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('titanium');
    });

    it('should reject tungsten', () => {
      const result = passesJewelryItemSpecs('Ring', { 'metal': 'Tungsten Carbide' });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('tungsten');
    });
  });

  describe('silver filtering when not selected', () => {
    it('should reject silver when gold-only selected', () => {
      const result = passesJewelryItemSpecs('Ring', { 'metal': 'Sterling Silver' }, { metal: ['Gold'] });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('silver');
    });

    it('should reject 925 silver when gold-only selected', () => {
      const result = passesJewelryItemSpecs('Ring', { 'metal': '.925 Silver' }, { metal: ['Gold'] });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('silver');
    });

    it('should PASS silver when silver is selected', () => {
      const result = passesJewelryItemSpecs('Sterling Silver Ring', { 'metal': 'Sterling Silver' }, { metal: ['Silver', 'Gold'] });
      expect(result.pass).toBe(true);
    });
  });

  describe('stone filtering', () => {
    it('should reject items with diamond in specs (no_stone default)', () => {
      const result = passesJewelryItemSpecs('Gold Ring', { 'main stone': 'Diamond' });
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('stone');
    });

    it('should reject items with stone keywords in title', () => {
      const result = passesJewelryItemSpecs('14K Gold Diamond Ring', {});
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('diamond');
    });

    it('should PASS items with stones when no_stone is false', () => {
      const result = passesJewelryItemSpecs('14K Gold Diamond Ring', { 'main stone': 'Diamond' }, { no_stone: false });
      expect(result.pass).toBe(true);
    });

    it('should PASS items with "None" in stone specs', () => {
      const result = passesJewelryItemSpecs('14K Gold Band', { 'main stone': 'None' });
      expect(result.pass).toBe(true);
    });
  });

  describe('costume jewelry detection', () => {
    it('should reject rhinestone items', () => {
      const result = passesJewelryItemSpecs('Rhinestone Crystal Necklace', {});
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('rhinestone');
    });

    it('should reject vermeil', () => {
      const result = passesJewelryItemSpecs('Gold Vermeil Earrings', {});
      expect(result.pass).toBe(false);
      expect(result.reason).toContain('vermeil');
    });
  });

  describe('valid jewelry passes', () => {
    it('should PASS 14K solid gold ring', () => {
      const result = passesJewelryItemSpecs('14K Yellow Gold Wedding Band', { 'metal': '14K Gold', 'main stone': 'None' });
      expect(result.pass).toBe(true);
    });

    it('should PASS 18K gold chain', () => {
      const result = passesJewelryItemSpecs('18K Gold Chain Necklace', { 'metal': '18K Yellow Gold' });
      expect(result.pass).toBe(true);
    });

    it('should PASS platinum jewelry', () => {
      const result = passesJewelryItemSpecs('Platinum Wedding Band', { 'metal': 'Platinum' });
      expect(result.pass).toBe(true);
    });
  });
});
