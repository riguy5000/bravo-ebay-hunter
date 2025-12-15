-- Enable real-time for matches tables
-- This allows the frontend to receive live updates when new matches are added

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE matches_watch;
ALTER PUBLICATION supabase_realtime ADD TABLE matches_jewelry;
ALTER PUBLICATION supabase_realtime ADD TABLE matches_gemstone;
