const METAL_KEYWORDS = {
  'Yellow Gold': ['yellow gold'],
  'White Gold': ['white gold'],
  'Rose Gold': ['rose gold'],
  'Gold': ['gold', '10k', '14k', '18k', '24k', '10kt', '14kt', '18kt', '24kt'],
  'Sterling Silver': ['sterling silver', '925 silver', '.925'],
  'Silver': ['silver'],
  'Platinum': ['platinum'],
  'Palladium': ['palladium'],
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
  'Gold Plated': ['gold plated', 'gold-plated', 'plated'],
  'Gold Filled': ['gold filled', 'gold-filled', 'filled'],
  'Silver Plated': ['silver plated', 'silver-plated'],
  'Rhodium Plated': ['rhodium plated', 'rhodium-plated'],
};

function getMetalExclusionKeywords(selectedMetals) {
  if (!selectedMetals || selectedMetals.length === 0) return [];
  const exclusions = new Set();
  const selectedLower = selectedMetals.map(m => m.toLowerCase());
  const skipMetals = ['sterling silver', 'silver'];

  for (const [metalName, keywords] of Object.entries(METAL_KEYWORDS)) {
    if (skipMetals.includes(metalName.toLowerCase())) continue;
    const isSelected = selectedLower.some(selected =>
      metalName.toLowerCase().includes(selected) || selected.includes(metalName.toLowerCase())
    );
    if (!isSelected) {
      for (const keyword of keywords) {
        const mightMatchSelected = selectedLower.some(selected =>
          keyword.includes(selected.split(' ')[0]) || selected.includes(keyword.split(' ')[0])
        );
        if (!mightMatchSelected) exclusions.add(keyword);
      }
    }
  }
  return Array.from(exclusions);
}

// Test with the task's metals
const selectedMetals = ['White Gold', 'Yellow Gold', 'Platinum', 'Palladium', 'Rose Gold'];
const exclusions = getMetalExclusionKeywords(selectedMetals);

console.log('=== Metal Exclusion Test ===');
console.log('Selected metals:', selectedMetals.join(', '));
console.log('');
console.log('Auto-excluded keywords (' + exclusions.length + '):');
exclusions.forEach(kw => console.log('  -"' + kw + '"'));
console.log('');
console.log('Sample search query:');
const baseKeywords = 'White Gold jewelry';
const exclusionString = exclusions.slice(0, 10).map(kw => '-"' + kw + '"').join(' ');
console.log(baseKeywords + ' ' + exclusionString);
