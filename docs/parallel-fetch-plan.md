# Parallel Item Fetch Implementation Plan

## Problem

The eBay Bulk API (`/buy/browse/v1/item?item_ids=`) returns 403 Forbidden because it requires the `buy.item.bulk` OAuth scope, which is a "Limited Release" feature only available to select eBay partners.

Currently, the worker falls back to **sequential single-item fetches**, which is slow:
- 50 items = 50 sequential API calls = ~25-30 seconds

## Solution

Parallelize the single-item fetches using concurrent requests with a configurable concurrency limit.

## Implementation

### 1. Add Concurrency Configuration

```javascript
// At top of worker/index.js
const PARALLEL_FETCH_CONCURRENCY = parseInt(process.env.PARALLEL_FETCH_CONCURRENCY || '5');
```

### 2. Create Parallel Fetch Helper

```javascript
/**
 * Fetch multiple items in parallel with concurrency limit
 * @param {string[]} itemIds - Array of item IDs to fetch
 * @param {number} concurrency - Max concurrent requests (default 5)
 * @returns {Map<string, object>} Map of itemId -> item details
 */
async function fetchItemDetailsParallel(itemIds, concurrency = PARALLEL_FETCH_CONCURRENCY) {
  const results = new Map();

  // Process in batches of `concurrency` size
  for (let i = 0; i < itemIds.length; i += concurrency) {
    const batch = itemIds.slice(i, i + concurrency);

    // Fetch all items in batch concurrently
    const batchPromises = batch.map(async (itemId) => {
      if (!rateLimiter.canMakeCall()) return { itemId, data: null };

      try {
        const data = await fetchItemDetails(itemId);
        return { itemId, data };
      } catch (error) {
        console.log(`  Failed to fetch ${itemId}: ${error.message}`);
        return { itemId, data: null };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const { itemId, data } of batchResults) {
      if (data) results.set(itemId, data);
    }
  }

  return results;
}
```

### 3. Modify fetchItemDetailsBulk Function

Replace the bulk API attempt with parallel fetches:

```javascript
async function fetchItemDetailsBulk(itemIds) {
  if (!itemIds || itemIds.length === 0) return new Map();

  const results = new Map();
  const uncachedIds = [];

  // Check cache first (existing logic)
  for (const itemId of itemIds) {
    const cached = itemDetailsCache.get(itemId);
    if (cached) {
      results.set(itemId, cached);
    } else {
      uncachedIds.push(itemId);
    }
  }

  if (uncachedIds.length === 0) return results;

  console.log(`  Fetching ${uncachedIds.length} items (${PARALLEL_FETCH_CONCURRENCY} concurrent)...`);

  // Use parallel fetch instead of bulk API
  const fetchedItems = await fetchItemDetailsParallel(uncachedIds);

  // Merge results and update cache
  for (const [itemId, data] of fetchedItems) {
    results.set(itemId, data);
    itemDetailsCache.set(itemId, data);
  }

  return results;
}
```

### 4. Optional: Skip Bulk API Entirely

Add a flag to skip the bulk API attempt entirely (since it always fails):

```javascript
const SKIP_BULK_API = process.env.SKIP_BULK_API === 'true' || true; // Default to skip
```

## Performance Comparison

| Approach | 50 Items | 100 Items |
|----------|----------|-----------|
| Sequential | ~25s | ~50s |
| Parallel (5) | ~5s | ~10s |
| Parallel (10) | ~2.5s | ~5s |
| Bulk API (if available) | ~1s | ~2s |

## Concurrency Recommendations

| Concurrency | Pros | Cons |
|-------------|------|------|
| 3 | Safe, low risk of rate limiting | Still somewhat slow |
| 5 | Good balance | Recommended starting point |
| 10 | Fast | May trigger rate limits on some keys |
| 20 | Very fast | Higher risk of 429 errors |

## Rate Limiting Considerations

- eBay allows 5,000 calls/day per key
- Parallel fetches use the same number of API calls as sequential
- No additional quota impact
- May trigger per-second rate limits if concurrency too high

## Environment Variables

```env
# Number of concurrent item fetches (default: 5)
PARALLEL_FETCH_CONCURRENCY=5

# Skip bulk API attempt entirely (default: true)
SKIP_BULK_API=true
```

## Testing Plan

1. Set `PARALLEL_FETCH_CONCURRENCY=5`
2. Run worker and observe poll times
3. Check logs for any 429 rate limit errors
4. Increase concurrency if no issues
5. Monitor API usage with `API calls today: X/4500` log

## Files to Modify

| File | Changes |
|------|---------|
| `worker/index.js` | Add `fetchItemDetailsParallel()`, modify `fetchItemDetailsBulk()` |
| `.env` | Add `PARALLEL_FETCH_CONCURRENCY` and `SKIP_BULK_API` |

## Estimated Changes

- ~40 lines new code
- ~20 lines modified
- No database changes
- No UI changes

## Rollback

If issues occur, set `PARALLEL_FETCH_CONCURRENCY=1` to revert to sequential behavior.
