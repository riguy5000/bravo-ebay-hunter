-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove existing job if it exists (for idempotency)
select cron.unschedule('daily-gold-prices') where exists (
  select 1 from cron.job where jobname = 'daily-gold-prices'
);

-- Create cron job to call get-gold-prices daily at 7 AM Pacific (15:00 UTC)
-- Adjust the schedule if you're in a different timezone:
-- '0 12 * * *' = 7 AM Eastern (EST)
-- '0 15 * * *' = 7 AM Pacific (PST)
-- '0 14 * * *' = 7 AM Pacific (PDT - summer)
select cron.schedule(
  'daily-gold-prices',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://hzinvalidlnlhindttbu.supabase.co/functions/v1/get-gold-prices',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
