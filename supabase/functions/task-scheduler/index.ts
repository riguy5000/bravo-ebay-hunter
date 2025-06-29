
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
  listing_format?: string[];
  min_seller_feedback?: number;
  poll_interval?: number;
  watch_filters?: any;
  jewelry_filters?: any;
  gemstone_filters?: any;
  created_at: string;
  updated_at: string;
}

const buildSearchKeywords = (task: Task): string => {
  let keywords = '';
  
  // Base keywords by item type
  switch (task.item_type) {
    case 'watch':
      keywords = task.watch_filters?.brand 
        ? `${task.watch_filters.brand} watch`
        : 'watch';
      if (task.watch_filters?.model) {
        keywords += ` ${task.watch_filters.model}`;
      }
      break;
    case 'jewelry':
      keywords = task.jewelry_filters?.material 
        ? `${task.jewelry_filters.material} jewelry`
        : 'jewelry';
      if (task.jewelry_filters?.type) {
        keywords += ` ${task.jewelry_filters.type}`;
      }
      break;
    case 'gemstone':
      keywords = task.gemstone_filters?.type 
        ? `${task.gemstone_filters.type} gemstone`
        : 'gemstone';
      if (task.gemstone_filters?.cut) {
        keywords += ` ${task.gemstone_filters.cut}`;
      }
      break;
  }
  
  return keywords || task.name;
};

const mapListingFormats = (formats?: string[]): string[] => {
  if (!formats) return [];
  
  const formatMap: { [key: string]: string } = {
    'auction': 'Auction',
    'buy_it_now': 'FixedPrice',
    'best_offer': 'AuctionWithBIN',
    'classified': 'Classified'
  };
  
  return formats.map(f => formatMap[f] || f).filter(Boolean);
};

const processTask = async (task: Task) => {
  console.log(`Processing task: ${task.name} (${task.id})`);
  
  try {
    const searchParams = {
      keywords: buildSearchKeywords(task),
      maxPrice: task.max_price,
      listingType: mapListingFormats(task.listing_format),
      minFeedback: task.min_seller_feedback || 0
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
      return;
    }

    // Process each item and create matches
    for (const item of items) {
      // Skip if price is too high
      if (task.max_price && item.price > task.max_price) {
        continue;
      }

      // Skip if seller feedback is too low
      if (task.min_seller_feedback && item.sellerInfo?.feedbackScore < task.min_seller_feedback) {
        continue;
      }

      // Check if we already have this item
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('ebay_item_id', item.itemId)
        .eq('task_id', task.id)
        .single();

      if (existingMatch) {
        console.log(`Item ${item.itemId} already exists, skipping`);
        continue;
      }

      // Create new match
      const matchData = {
        task_id: task.id,
        user_id: task.user_id,
        ebay_item_id: item.itemId,
        title: item.title,
        price: item.price,
        seller_name: item.sellerInfo?.name,
        seller_feedback: item.sellerInfo?.feedbackScore,
        listing_url: item.listingUrl,
        image_url: item.imageUrl,
        end_time: item.endTime ? new Date(item.endTime).toISOString() : null,
        status: 'new' as const
      };

      const { error: insertError } = await supabase
        .from('matches')
        .insert(matchData);

      if (insertError) {
        console.error('Error inserting match:', insertError);
      } else {
        console.log(`Created match for item: ${item.title}`);
      }
    }

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
      // Check if enough time has passed since last execution
      const lastRun = new Date(task.updated_at);
      const now = new Date();
      const timeDiff = (now.getTime() - lastRun.getTime()) / 1000;
      const pollInterval = task.poll_interval || 300;

      if (timeDiff >= pollInterval) {
        await processTask(task);
        
        // Update the task's updated_at timestamp
        await supabase
          .from('tasks')
          .update({ updated_at: now.toISOString() })
          .eq('id', task.id);
        
        processedCount++;
      } else {
        console.log(`Task ${task.name} not ready yet (${Math.round(pollInterval - timeDiff)}s remaining)`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Task scheduler completed`,
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
