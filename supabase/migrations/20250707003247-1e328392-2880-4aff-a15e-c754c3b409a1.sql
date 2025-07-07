-- Remove watch-specific aspects from jewelry_merged category
DELETE FROM ebay_aspects 
WHERE category_id = 'jewelry_merged' 
AND aspect_name IN (
  'Band Material', 'Band Color', 'Band Width', 'Band/Strap',
  'Case Material', 'Case Color', 'Case Size', 'Case Thickness', 
  'Case Finish', 'Caseback', 'Dial Color', 'Dial Pattern', 
  'Movement', 'Water Resistance', 'Bezel Color', 'Bezel Material'
);

-- Add missing Platinum and Palladium to Metal aspect in jewelry_merged
UPDATE ebay_aspects 
SET values_json = values_json || '[{"value": "Platinum", "meaning": "Platinum"}, {"value": "Palladium", "meaning": "Palladium"}]'::jsonb
WHERE category_id = 'jewelry_merged' 
AND aspect_name = 'Metal'
AND NOT (values_json::text LIKE '%Platinum%' AND values_json::text NOT LIKE '%Platinum Plated%');