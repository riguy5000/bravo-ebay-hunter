# eBay API Usage Analysis - Feb 20, 2026

## Current Setup

- **Scanner**: PM2 worker (`worker-node/index.ts`)
- **Task Scheduler**: Disabled (was a duplicate system burning extra calls)
- **API Keys**: 16 keys, 5,000 calls/day each = **80,000 daily limit**
- **Cycle Time**: ~8 minutes (12 search terms × 30s delay + processing)

## Actual Usage (from `api_usage` table)

| Metric | Value |
|--------|-------|
| Total calls/day | ~75,000 |
| Search calls/day | ~28,000 |
| Item detail calls/day | ~47,000 |
| Avg calls/hour | ~3,500 |
| Calls per key/day | ~4,700 (close to 5,000 limit) |

### Hourly Breakdown Pattern

- Off-peak hours (when both systems ran): ~4,300 calls/hr
- After disabling task-scheduler: ~3,300 calls/hr
- Task-scheduler was responsible for ~18,000 calls/day (logged as source "unknown")

## How Calls Break Down

### Search Calls (~28,000/day)

Each cycle runs 12 search terms for a Yellow Gold task:
- `expandMetalSearchTerms()` expands "Yellow Gold" into: Yellow Gold, 18K Gold, 14K Gold, 10K Gold, 24K Gold, 18kt Gold, 14kt Gold, 10kt Gold (8 terms)
- Plus any other metals configured (e.g. White Gold = 4 more terms)
- Each term = 1 eBay Browse API `item_summary/search` call

### Item Detail Calls (~47,000/day)

Each item that passes basic filters gets a `fetchItemDetails` call to check:
- Category (reject if not jewelry)
- Item specifics (karat, weight, stones, metal type)
- Description (check for plated/filled indicators)

### What Gets Filtered BEFORE Item Detail Calls (no API cost)

These checks happen using search result data only:
1. Rejected items cache (48hr TTL, ~3,700 items cached)
2. Exclude keywords (title-based)
3. Condition filter (Pre-owned vs New)
4. Plated/filled/vermeil title check
5. Base metal title check (brass, titanium, etc.)
6. Price range filter
7. Seller feedback filter
8. Duplicate check (already in matches table)

### Top Rejection Reasons (from `rejected_items` cache)

| Reason | Count | Requires API Call? |
|--------|-------|--------------------|
| Wrong condition "New with packaging" | 1,147 | No (filtered from search data) |
| Wrong condition "New without packaging" | 466 | No |
| Title contains "diamond" | 463 | No |
| Has stone (from item specs) | 348 | Yes |
| Metal/Material contains "tone" | 195 | Yes |
| Contains excluded keyword | 88 | No |
| Title contains "pearl" | 56 | No |

## Scaling: Polling Every 1 Minute

### Why Current Cycle Takes ~8 Minutes

```
12 search terms × 30s delay between each = 5.5 min waiting
+ API response time (~1-2s per search)
+ Item detail fetches for passing items
+ DB operations (inserts, duplicate checks)
= ~8 minutes total
```

The 30s delay was added to prevent eBay API rate limiting.

### Option 1: Remove Delay, Keep All 12 Terms

- Cycle time: ~1-2 min (just API latency + processing)
- Search calls: 28,000 × 8 = **~224,000/day**
- Item detail calls: **~50,000-60,000/day** (stays roughly the same — same items on eBay regardless of poll frequency, rejected cache prevents re-fetching)
- **Total: ~275,000-285,000 calls/day**
- **Keys needed: ~57** (at 5,000/key)
- Risk: High burst rate may trigger eBay per-second rate limits (undocumented ~5 calls/sec)

### Option 2: Rotate Search Terms (Recommended)

Instead of running all 12 terms every cycle, rotate 2-3 terms per cycle. Each term gets searched every 4-6 minutes.

- Cycle time: ~1 min
- Search calls: 3 terms × 1,440 cycles/day = **~4,300/day**
- Item detail calls: **~47,000-50,000/day** (similar — same items found, just spread across more cycles)
- **Total: ~52,000-55,000 calls/day**
- **Keys needed: ~11** (fits within current 16 keys with headroom)
- Tradeoff: Each individual term is searched every ~4 min instead of ~8 min

### Option 3: Reduce Terms + Remove Delay

Cut `expandMetalSearchTerms` down — e.g. just "Yellow Gold", "14K Gold", "18K Gold" instead of all 8 variations. Then run with no delay.

- Cycle time: ~1 min
- Search calls: 4 terms × 1,440 = **~5,760/day**
- Item detail calls: **~40,000-47,000/day** (slightly fewer since fewer searches = fewer items to evaluate)
- **Total: ~46,000-53,000 calls/day**
- **Keys needed: ~11**
- Tradeoff: May miss items that only match "10kt Gold" or "24K Gold" searches

### Comparison Table

| Option | Cycle Time | Search Calls/Day | Total Calls/Day | Keys Needed | Coverage |
|--------|-----------|-------------------|-----------------|-------------|----------|
| Current | ~8 min | 28,000 | 75,000 | 16 | Full |
| Option 1 (no delay) | ~1-2 min | 224,000 | 285,000 | 57 | Full |
| Option 2 (rotate) | ~1 min | 4,300 | 55,000 | 11 | Full (delayed per-term) |
| Option 3 (fewer terms) | ~1 min | 5,760 | 53,000 | 11 | Reduced |

## SQL Queries for Monitoring

### Calls per hour (last 24h)
```sql
SELECT
  date_trunc('hour', called_at) as hour,
  count(*) as calls
FROM api_usage
WHERE called_at > now() - interval '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Calls by type
```sql
SELECT
  call_type,
  count(*) as calls
FROM api_usage
WHERE called_at > now() - interval '24 hours'
GROUP BY call_type
ORDER BY calls DESC;
```

### Calls by source
```sql
SELECT
  source,
  count(*) as calls
FROM api_usage
WHERE called_at > now() - interval '24 hours'
GROUP BY source
ORDER BY calls DESC;
```

### Calls per key (check for even distribution)
```sql
SELECT
  api_key_label,
  count(*) as calls
FROM api_usage
WHERE called_at > now() - interval '24 hours'
GROUP BY api_key_label
ORDER BY calls DESC;
```

### Rejected items cache stats
```sql
SELECT
  rejection_reason,
  count(*) as items
FROM rejected_items
GROUP BY rejection_reason
ORDER BY items DESC
LIMIT 10;
```
