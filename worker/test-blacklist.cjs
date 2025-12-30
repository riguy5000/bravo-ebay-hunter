// Test script for gemstone blacklist function

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

function passesGemstoneBlacklist(title, specs = {}, filters = {}) {
  const titleLower = title.toLowerCase();
  const allowLabCreated = filters.allow_lab_created || false;

  const stoneSpec = specs['type'] || specs['stone type'] || specs['gemstone'] || '';
  const creationSpec = specs['creation method'] || specs['natural/lab-created'] || '';

  const simulantTerms = ['cubic zirconia', 'cz', 'moissanite', 'simulant', 'simulated', 'fake', 'imitation'];
  for (const term of simulantTerms) {
    if (stoneSpec.toLowerCase().includes(term) || creationSpec.toLowerCase().includes(term)) {
      return { blocked: true, reason: `Simulant in specs: "${term}"` };
    }
  }

  for (const term of GEMSTONE_BLACKLIST) {
    if (allowLabCreated && LAB_CREATED_TERMS.includes(term)) {
      continue;
    }

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

  if (!allowLabCreated) {
    for (const term of LAB_CREATED_TERMS) {
      if (titleLower.includes(term)) {
        return { blocked: true, reason: `Lab-created: "${term}"` };
      }
    }
  }

  return { blocked: false, reason: null };
}

// Test cases
const tests = [
  // Should be BLOCKED
  { title: "2ct Round CZ Diamond Ring", specs: {}, filters: {}, expectBlocked: true },
  { title: "Cubic Zirconia 1.5ct Oval Cut", specs: {}, filters: {}, expectBlocked: true },
  { title: "Moissanite Diamond Alternative 2ct", specs: {}, filters: {}, expectBlocked: true },
  { title: "Lab Created Diamond 1ct GIA", specs: {}, filters: {}, expectBlocked: true },
  { title: "Synthetic Sapphire Blue Oval", specs: {}, filters: {}, expectBlocked: true },
  { title: "Lab-Grown Ruby 2ct", specs: {}, filters: {}, expectBlocked: true },
  { title: "Simulated Emerald Ring", specs: {}, filters: {}, expectBlocked: true },
  { title: "Glass Filled Ruby 3ct", specs: {}, filters: {}, expectBlocked: true },
  { title: "Swarovski Crystal Ring", specs: {}, filters: {}, expectBlocked: true },
  { title: "Diamond Doublet Ring", specs: {}, filters: {}, expectBlocked: true },

  // Should be ALLOWED
  { title: "Natural Sapphire Ceylon 2ct GIA", specs: {}, filters: {}, expectBlocked: false },
  { title: "1.5ct Round Diamond GIA Certified", specs: {}, filters: {}, expectBlocked: false },
  { title: "Burma Ruby Oval 1.2 Carat Natural", specs: {}, filters: {}, expectBlocked: false },
  { title: "Colombian Emerald Loose Stone Untreated", specs: {}, filters: {}, expectBlocked: false },

  // Lab-created ALLOWED when filter enabled
  { title: "Lab Created Diamond 1ct GIA", specs: {}, filters: { allow_lab_created: true }, expectBlocked: false },
  { title: "Synthetic Sapphire Blue Oval", specs: {}, filters: { allow_lab_created: true }, expectBlocked: false },

  // Simulants ALWAYS blocked even with allow_lab_created
  { title: "CZ Diamond Simulant 2ct", specs: {}, filters: { allow_lab_created: true }, expectBlocked: true },
  { title: "Moissanite Round 1.5ct", specs: {}, filters: { allow_lab_created: true }, expectBlocked: true },

  // Specs-based blocking
  { title: "Beautiful Round Stone 1ct", specs: { 'stone type': 'Cubic Zirconia' }, filters: {}, expectBlocked: true },
  { title: "Oval Gemstone Ring", specs: { 'natural/lab-created': 'Simulated' }, filters: {}, expectBlocked: true },
];

console.log('\n🧪 BLACKLIST TESTS\n' + '='.repeat(60) + '\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = passesGemstoneBlacklist(test.title, test.specs, test.filters);
  const testPassed = result.blocked === test.expectBlocked;

  if (testPassed) {
    passed++;
    console.log(`✅ PASS: "${test.title.substring(0, 40)}..."`);
    console.log(`   Expected: ${test.expectBlocked ? 'BLOCKED' : 'ALLOWED'}, Got: ${result.blocked ? 'BLOCKED' : 'ALLOWED'}`);
    if (result.reason) console.log(`   Reason: ${result.reason}`);
  } else {
    failed++;
    console.log(`❌ FAIL: "${test.title.substring(0, 40)}..."`);
    console.log(`   Expected: ${test.expectBlocked ? 'BLOCKED' : 'ALLOWED'}, Got: ${result.blocked ? 'BLOCKED' : 'ALLOWED'}`);
    if (result.reason) console.log(`   Reason: ${result.reason}`);
  }
  console.log();
}

console.log('='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${tests.length} tests\n`);

if (failed > 0) {
  process.exit(1);
}
