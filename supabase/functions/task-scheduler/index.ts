
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface Task {
  id: string;
  user_id: string;
  name: string;
  item_type: 'watch' | 'jewelry' | 'gemstone';
  status: 'active' | 'paused' | 'stopped';
  max_price?: number;
  price_percentage?: number;
  price_delta_type?: string;
  price_delta_value?: number;
  listing_format?: string[];
  min_seller_feedback?: number;
  poll_interval?: number;
  exclude_keywords?: string[];
  auction_alert?: boolean;
  date_from?: string;
  date_to?: string;
  item_location?: string;
  watch_filters?: any;
  jewelry_filters?: any;
  gemstone_filters?: any;
  created_at: string;
  updated_at: string;
}

const buildSearchKeywords = (task: Task): string => {
  let keywords = '';
  
  // Build search keywords from task type and filters
  switch (task.item_type) {
    case 'watch':
      keywords = 'watch';
      if (task.watch_filters?.brands?.length > 0) {
        keywords = `${task.watch_filters.brands[0]} watch`;
      }
      if (task.watch_filters?.keywords) {
        keywords += ` ${task.watch_filters.keywords}`;
      }
      break;
    case 'jewelry':
      keywords = 'jewelry';
      if (task.jewelry_filters?.metal?.length > 0) {
        keywords = `${task.jewelry_filters.metal[0]} jewelry`;
      }
      if (task.jewelry_filters?.categories?.length > 0) {
        keywords += ` ${task.jewelry_filters.categories[0]}`;
      }
      if (task.jewelry_filters?.keywords) {
        keywords += ` ${task.jewelry_filters.keywords}`;
      }
      break;
    case 'gemstone':
      keywords = 'gemstone';
      if (task.gemstone_filters?.stone_types?.length > 0) {
        keywords = `${task.gemstone_filters.stone_types[0]}`;
      }
      if (task.gemstone_filters?.keywords) {
        keywords += ` ${task.gemstone_filters.keywords}`;
      }
      break;
  }
  
  return keywords || task.name.toLowerCase();
};

const getMatchTableName = (itemType: string): string => {
  return `matches_${itemType}`;
};

const createMatchRecord = (task: Task, item: any) => {
  const baseMatch = {
    task_id: task.id,
    user_id: task.user_id,
    ebay_listing_id: item.itemId,
    ebay_title: item.title,
    ebay_url: item.listingUrl,
    listed_price: item.price,
    currency: item.currency || 'USD',
    buy_format: item.listingType || 'Unknown',
    seller_feedback: item.sellerInfo?.feedbackScore || 0,
    found_at: new Date().toISOString(),
    status: 'new' as const
  };

  // Add type-specific fields based on item type
  switch (task.item_type) {
    case 'watch':
      return {
        ...baseMatch,
        case_material: item.caseMaterial || 'Unknown',
        band_material: item.bandMaterial || 'Unknown',
        movement: item.movement || 'Unknown',
        dial_colour: item.dialColour || 'Unknown',
        case_size_mm: item.caseSizeMm || null,
      };
    
    case 'jewelry':
      return {
        ...baseMatch,
        weight_g: item.weightG || null,
        karat: item.karat || null,
        metal_type: item.metalType || 'Unknown',
        spot_price_oz: item.spotPriceOz || null,
        melt_value: item.meltValue || null,
        profit_scrap: item.profitScrap || null,
      };
    
    case 'gemstone':
      return {
        ...baseMatch,
        shape: item.shape || 'Unknown',
        carat: item.carat || null,
        colour: item.colour || 'Unknown',
        clarity: item.clarity || 'Unknown',
        cut_grade: item.cutGrade || 'Unknown',
        cert_lab: item.certLab || 'Unknown',
      };
    
    default:
      return baseMatch;
  }
};

const processTask = async (task: Task) => {
  console.log(`Processing task: ${task.name} (${task.id}) - Type: ${task.item_type}`);
  
  try {
    const searchParams = {
      keywords: buildSearchKeywords(task),
      maxPrice: task.max_price,
      listingType: task.listing_format || ['Auction', 'FixedPrice'],
      minFeedback: task.min_seller_feedback || 0,
      itemLocation: task.item_location,
      dateFrom: task.date_from,
      dateTo: task.date_to
    };

    console.log('Search params:', searchParams);

    // Call the eBay search function
    const searchResponse = await supabase.functions.invoke('ebay-search', {
      body: searchParams
    });

    if (searchResponse.error) {
      console.error('Error calling eBay search:', searchResponse.error);
      return;
    }

    const { items } = searchResponse.data;
    console.log(`Found ${items?.length || 0} items for task ${task.name}`);

    if (!items || items.length === 0) {
      console.log(`No items found for task ${task.name}`);
      return;
    }

    const tableName = getMatchTableName(task.item_type);
    let newMatches = 0;
    
    // Process each item and create matches
    for (const item of items.slice(0, 10)) { // Limit to first 10 items for testing
      // Skip if price is too high
      if (task.max_price && item.price > task.max_price) {
        console.log(`Skipping item ${item.itemId} - price too high: $${item.price}`);
        continue;
      }

      // Skip if seller feedback is too low
      if (task.min_seller_feedback && item.sellerInfo?.feedbackScore < task.min_seller_feedback) {
        console.log(`Skipping item ${item.itemId} - feedback too low: ${item.sellerInfo?.feedbackScore}`);
        continue;
      }

      // Skip if contains excluded keywords
      if (task.exclude_keywords && task.exclude_keywords.length > 0) {
        const titleLower = item.title.toLowerCase();
        const hasExcludedKeyword = task.exclude_keywords.some(keyword => 
          titleLower.includes(keyword.toLowerCase())
        );
        if (hasExcludedKeyword) {
          console.log(`Skipping item due to excluded keyword: ${item.title}`);
          continue;
        }
      }

      // Check if we already have this item
      const { data: existingMatch } = await supabase
        .from(tableName)
        .select('id')
        .eq('ebay_listing_id', item.itemId)
        .eq('task_id', task.id)
        .single();

      if (existingMatch) {
        console.log(`Item ${item.itemId} already exists, skipping`);
        continue;
      }

      // Create new match record
      const matchData = createMatchRecord(task, item);

      const { error: insertError } = await supabase
        .from(tableName)
        .insert(matchData);

      if (insertError) {
        console.error('Error inserting match:', insertError);
      } else {
        console.log(`✓ Created ${task.item_type} match: ${item.title} - $${item.price}`);
        newMatches++;
      }
    }

    console.log(`✓ Task ${task.name} processed: ${newMatches} new matches created`);

  } catch (error) {
    console.error(`Error processing task ${task.id}:`, error);
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Task scheduler started');

    // Get all active tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    console.log(`Found ${tasks?.length || 0} active tasks`);

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active tasks to process',
        tasksProcessed: 0
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Process each task
    let processedCount = 0;
    for (const task of tasks) {
      console.log(`\n--- Processing Task: ${task.name} ---`);
      await processTask(task);
      
      // Update the task's updated_at timestamp
      await supabase
        .from('tasks')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', task.id);
      
      processedCount++;
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Task scheduler completed successfully`,
      tasksProcessed: processedCount,
      totalTasks: tasks.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in task scheduler:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
