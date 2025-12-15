-- Add unique constraints to prevent duplicate matches at database level
-- A listing should only appear once per task

ALTER TABLE matches_watch
ADD CONSTRAINT unique_watch_listing_per_task
UNIQUE (ebay_listing_id, task_id);

ALTER TABLE matches_jewelry
ADD CONSTRAINT unique_jewelry_listing_per_task
UNIQUE (ebay_listing_id, task_id);

ALTER TABLE matches_gemstone
ADD CONSTRAINT unique_gemstone_listing_per_task
UNIQUE (ebay_listing_id, task_id);
