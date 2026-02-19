# Notification Delay Postmortem - Feb 19, 2026

## Symptom

Slack notifications for new eBay matches were arriving 1-3 minutes late. Every notification came through the `retryFailedNotifications` safety net (which queries for `notification_sent = false` at the end of each cycle) rather than being sent immediately when the match was found.

## Root Causes (Two Issues)

### 1. Two competing systems inserting matches

There are two independent systems scanning eBay and inserting matches into the same database table:

| System | Location | Runs | Cycle Time |
|--------|----------|------|------------|
| PM2 Worker | `worker-node/index.ts` | PM2 process on DigitalOcean | 8-15 min per full cycle |
| Task Scheduler | `supabase/functions/task-scheduler/index.ts` | pg_cron every 1 minute (`*/1 * * * *`) |  ~1 min |

The **task-scheduler** runs every minute and was inserting matches into `matches_jewelry` **without sending Slack notifications** and without setting `notification_sent = true`.

The **PM2 worker** takes 8-15 minutes per cycle (12 search terms x 30s delay between each). By the time it scanned the same listings, the task-scheduler had already inserted them. The worker's insert would fail with PostgreSQL error `23505` (unique constraint violation on `unique_jewelry_listing_per_task`), and the code would skip the notification.

The only way notifications got sent was through `retryFailedNotifications` — a sweep at the end of each PM2 cycle that queries `notification_sent = false` and sends any missed notifications. This caused the 1-3 minute delay.

**How we found it:** We grepped for all `INSERT` calls across the codebase and found 4 insert calls in the task-scheduler edge function. Then confirmed a pg_cron job in the `cron.job` table running it every minute for the same task ID.

### 2. `.single()` vs `.maybeSingle()` bug in the PM2 worker

While fixing the PM2 worker, we added an existence check before inserting — query the database first to see if the item already exists, and if it exists with `notification_sent = false`, send the notification.

The lookup query used Supabase's `.single()` method:

```typescript
const { data: existingMatch, error: lookupError } = await supabase
  .from(tableName)
  .select('id, notification_sent')
  .eq('ebay_listing_id', item.itemId)
  .eq('task_id', task.id)
  .single();  // BUG: errors on 0 rows
```

**The problem:** `.single()` returns a `PGRST116` error when 0 rows are found. For every brand new item (not yet in the database), the lookup errored out. That error was caught by the outer `try/catch`, which silently skipped the entire match processing block — no insert, no notification, no logs.

**The fix:** Change `.single()` to `.maybeSingle()`, which returns `{ data: null, error: null }` when 0 rows are found.

**How we found it:** We added comprehensive logging (`MATCH CANDIDATE`, `DB lookup result`, etc.) with isolated try/catch blocks around each step. The logs weren't appearing at all, which told us something was failing before any of the logging code ran. Reading the Supabase docs confirmed `.single()` errors on 0 rows.

## What We Changed

### PM2 Worker (`worker-node/index.ts`)

1. **Existence check before insert** — Query the DB first instead of blindly inserting and catching 23505
2. **`.maybeSingle()` instead of `.single()`** — Prevents PGRST116 error on 0 rows
3. **Comprehensive logging** — `MATCH CANDIDATE`, `DB lookup result`, `Inserting new match`, `Sending Slack notification`, timing measurements
4. **Isolated try/catch** — Each match is processed in its own try/catch so one failure doesn't kill the whole batch
5. **Inline retries** — If Slack notification fails, retry up to 2 times with backoff before giving up
6. **30s delay between searches** — Prevents eBay API rate limiting across 12 search terms

### Task Scheduler (`supabase/functions/task-scheduler/index.ts`)

1. **Added Slack notification sending** — Uses `SLACK_BOT_TOKEN` to post to specific channels via `chat.postMessage` API
2. **Notification format matches PM2 worker** — Green/red dot emoji, attachments with sidebar color, same fields
3. **Sets `notification_sent = true`** after successful Slack send
4. **Stores `slack_message_ts` and `slack_channel_id`** for future message updates
5. **Uses `.maybeSingle()`** on insert return to safely get the inserted row ID

### Supabase Secrets Added

- `SLACK_BOT_TOKEN` — Bot token for channel-specific posting
- `SLACK_WEBHOOK_URL` — Fallback webhook
- `DEFAULT_SLACK_CHANNEL` — Default channel if task has none configured

## Current Architecture

```
eBay API
   ↑
   ├── Task Scheduler (pg_cron, every 1 min)
   │     ├── Scans eBay
   │     ├── Inserts match into DB
   │     ├── Sends Slack notification ← NEW
   │     └── Sets notification_sent = true ← NEW
   │
   └── PM2 Worker (8-15 min cycle)
         ├── Scans eBay
         ├── Checks if item already exists (maybeSingle)
         ├── Inserts match if new → sends Slack notification
         ├── Sends notification if exists but not notified
         └── retryFailedNotifications sweep (backup safety net)
```

Both systems can now send notifications. The task-scheduler handles speed (1-min cycles), the PM2 worker handles reliability (backup sweep). Duplicate notifications are prevented because both systems check/set `notification_sent = true`.

## Lessons Learned

1. **Check for duplicate write paths.** When notifications are delayed but data appears in the DB on time, something else may be writing to the same table.
2. **Supabase `.single()` errors on 0 rows.** Always use `.maybeSingle()` when the query might return no results. `.single()` is only safe when you're certain exactly 1 row exists.
3. **Add logging before debugging logic.** Without `MATCH CANDIDATE` logs, we couldn't tell if our code was even running. Log entry/exit of critical code paths.
4. **PM2 caches compiled code.** After changing TypeScript source, you need `rm -rf node_modules/.cache && pm2 restart worker` to ensure the new code runs.
5. **pg_cron jobs are easy to forget.** The task-scheduler cron job was set up earlier and continued running silently. Check `cron.job` table when investigating unexpected database writes.

## Deployment Commands

```bash
# Deploy PM2 worker changes
cd /root/bravo-ebay-hunter && git pull && rm -rf node_modules/.cache && pm2 restart worker

# Deploy task-scheduler edge function
cd /root/bravo-ebay-hunter && npx supabase functions deploy task-scheduler

# Set Supabase secrets (or use dashboard)
npx supabase secrets set SLACK_BOT_TOKEN=xoxb-... SLACK_WEBHOOK_URL=https://hooks.slack.com/... DEFAULT_SLACK_CHANNEL=C...

# Check pg_cron jobs
SELECT * FROM cron.job;
```
