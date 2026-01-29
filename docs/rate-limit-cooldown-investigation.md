# Rate Limit Cooldown Investigation

**Date:** 2026-01-29
**Issue:** Should we remove the 5-minute cooldown that auto-resets rate-limited keys?

---

## Current Behavior

When a key gets a 429 error from eBay:
1. Key is marked as `rate_limited` with a timestamp
2. After 5 minutes, the key auto-resets to `active`
3. Key gets used again, potentially gets another 429
4. Repeat...

This wastes API calls when keys have exhausted their **daily quota** (5,000/day), which doesn't reset until midnight Pacific.

---

## Files That Handle Rate Limiting

| File | Purpose |
|------|---------|
| `supabase/functions/ebay-search/index.ts` | Edge function - has 5-min cooldown |
| `worker-node/index.ts` | Main worker - has 5-min cooldown |
| `worker/reset-keys.cjs` | Manual script to reset all keys |
| `src/components/settings/EbayApiKeysList.tsx` | UI - shows rate_limited badge |

---

## Why the 5-Minute Cooldown Exists

eBay has **two types** of rate limits:

1. **Per-minute burst limit** - "You're sending requests too fast"
   - Temporary, recovers in minutes
   - 5-minute cooldown helps here

2. **Daily quota (5,000/day)** - "You've used all your calls for today"
   - Permanent until midnight Pacific (8:00 AM UTC)
   - 5-minute cooldown is useless here

Both return a **429 error**, so we can't easily distinguish between them.

---

## Potential Issues if We Remove Cooldown

### 1. All Keys Could Get Stuck Forever
If all 15 keys get rate limited, searches stop until:
- Midnight Pacific (eBay's daily reset)
- You manually run `node worker/reset-keys.cjs`

No auto-recovery means potential downtime.

### 2. Fallback Behavior Still Wastes Calls
In `worker-node/index.ts` lines 2120-2128:
```javascript
if (availableKeys.length === 0) {
  // All keys rate limited - use the one that was rate limited longest ago
  keyToUse = sortedByRateLimitTime[0];
  console.log(`⚠️ All keys rate limited, using oldest: "${keyToUse?.label}"`);
}
```
When ALL keys are rate limited, it **still tries the oldest one** - wasting a call on a key that will fail.

### 3. Per-Minute Limits Won't Recover
Some 429s are temporary (sent requests too fast). Without cooldown, these keys stay stuck even though they'd be fine after 5 minutes.

---

## Recommended Changes

### Change 1: Remove Auto-Cooldown Reset
Keys stay `rate_limited` until midnight instead of auto-resetting after 5 minutes.

**Files to modify:**
- `worker-node/index.ts` - Remove lines 2094-2105
- `supabase/functions/ebay-search/index.ts` - Remove similar cooldown logic

### Change 2: Fix Fallback Behavior
When all keys are rate limited, **don't try any key**. Instead:
- Log a warning
- Sleep for 30-60 minutes before retrying
- Or stop searching until midnight

**Files to modify:**
- `worker-node/index.ts` - Change lines 2120-2128

### Change 3: Add Automatic Midnight Reset
Create a scheduled job (pg_cron or external) that runs at 8:00 AM UTC to:
- Reset all keys from `rate_limited` to `active`
- Reset `calls_today` to 0
- Reset `calls_reset_date` to new date

**Implementation options:**
- Supabase pg_cron job
- External cron calling an edge function
- Worker-node scheduled task

### Change 4: Keep Manual Reset Script
Keep `worker/reset-keys.cjs` as emergency backup for manual recovery.

---

## Implementation Priority

1. **Change 3 (Midnight Reset)** - Most important, ensures keys recover daily
2. **Change 1 (Remove Cooldown)** - Prevents wasted calls on exhausted keys
3. **Change 2 (Fix Fallback)** - Prevents wasted calls when all keys exhausted
4. **Change 4 (Keep Manual)** - Already exists, no action needed

---

## SQL for Midnight Reset Job (pg_cron)

```sql
-- Create the reset function
CREATE OR REPLACE FUNCTION reset_ebay_keys_daily()
RETURNS void AS $$
DECLARE
  config jsonb;
  updated_keys jsonb;
BEGIN
  -- Get current config
  SELECT value_json INTO config FROM settings WHERE key = 'ebay_keys';

  -- Reset all keys (except ones with auth_error status)
  SELECT jsonb_agg(
    CASE
      WHEN key->>'status' = 'auth_error' THEN key
      ELSE key || '{"status": "active", "rate_limited_at": null, "calls_today": 0}'::jsonb
    END
  ) INTO updated_keys
  FROM jsonb_array_elements(config->'keys') AS key;

  -- Update settings
  UPDATE settings
  SET value_json = jsonb_set(config, '{keys}', updated_keys),
      updated_at = NOW()
  WHERE key = 'ebay_keys';

  RAISE NOTICE 'eBay API keys reset at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule to run at 8:00 AM UTC (midnight Pacific)
SELECT cron.schedule('reset-ebay-keys', '0 8 * * *', 'SELECT reset_ebay_keys_daily()');
```

---

## Testing Plan

Before deploying:
1. Test midnight reset function manually
2. Verify keys reset correctly
3. Monitor for 24-48 hours to ensure stability
4. Check that searches resume after reset

---

## Rollback Plan

If issues occur:
1. Re-enable the 5-minute cooldown
2. Run `node worker/reset-keys.cjs` to recover stuck keys
3. Investigate and fix before retrying
