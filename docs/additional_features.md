# Additional Features - Backlog

## Weight Filter for Jewelry

### Problem
The eBay Browse API does not provide a native weight filter. Weight is an "item specific" attribute that sellers manually enter, often appearing in:
- Item title (e.g., "14K Gold Ring 5.2g")
- Item description
- Item specifics section

Currently, when searching for gold jewelry to scrap, we cannot filter by minimum weight at the API level. This means:
1. Worker fetches ALL jewelry listings under max price
2. Many listings are lightweight pieces with low melt value
3. Manual review required to identify heavy pieces worth scrapping

### Proposed Solution

#### Option 1: AI Analyzer Enhancement (Recommended)
Re-enable and enhance the AI analyzer to:
1. Extract weight from listing title using regex patterns
2. Extract weight from item specifics (if available in API response)
3. Calculate melt value based on extracted weight + karat + spot price
4. Filter out items below minimum weight threshold
5. Score items by profit potential

**Regex patterns to detect weight:**
```javascript
// Common patterns in titles
const weightPatterns = [
  /(\d+\.?\d*)\s*(?:g|gram|grams)\b/i,           // "5.2g", "5.2 grams"
  /(\d+\.?\d*)\s*(?:dwt|pennyweight)/i,          // "3.5 dwt"
  /(\d+\.?\d*)\s*(?:oz|ounce|ounces)\b/i,        // "0.5 oz"
  /weight[:\s]+(\d+\.?\d*)\s*(?:g|gram)/i,       // "Weight: 5.2g"
];
```

**Weight conversion:**
- 1 gram = 0.0321507 troy oz
- 1 dwt (pennyweight) = 1.55517 grams
- 1 troy oz = 31.1035 grams

#### Option 2: Title Keyword Search
Add weight keywords to search query:
- Search for "14k gold ring 5g" instead of just "14k gold ring"
- Limitation: Misses many listings, sellers use inconsistent formatting

#### Option 3: Post-Processing Filter in Worker
Add weight extraction and filtering in the worker itself:
```javascript
// In processTask, after fetching items
const filteredItems = items.filter(item => {
  const weight = extractWeightFromTitle(item.title);
  const minWeight = task.jewelry_filters?.min_weight_g || 0;
  return weight >= minWeight;
});
```

### UI Changes Required
Add to jewelry task creation form:
- Minimum weight (grams) input field
- Store in `jewelry_filters.min_weight_g`

### Database Changes
None required - `jewelry_filters` is already a JSONB column that can store `min_weight_g`.

### Priority
Medium - Would significantly improve gold scrap hunting efficiency by filtering out lightweight pieces that aren't worth the shipping/melting costs.

### Related
- AI Analyzer is currently disabled due to 500 errors
- Re-enabling AI would also bring back quality scoring and deal analysis
