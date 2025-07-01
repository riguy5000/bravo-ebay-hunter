
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
  last_run?: string;
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

const analyzeItemWithAI = async (task: Task, item: any) => {
  try {
    console.log(`🤖 Analyzing item with AI: ${item.title}`);
    
    const analysisData = {
      title: item.title,
      description: item.description || '',
      price: item.price,
      currency: item.currency || 'USD',
      sellerInfo: item.sellerInfo,
      itemType: task.item_type
    };

    const { data: analysis, error } = await supabase.functions.invoke('ebay-item-analyzer', {
      body: analysisData
    });

    if (error) {
      console.error('AI analysis error:', error);
      return null;
    }

    console.log(`✓ AI Analysis - Quality: ${analysis.qualityScore}, Deal: ${analysis.dealScore}`);
    return analysis;
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return null;
  }
};

const shouldExcludeItem = (task: Task, item: any, aiAnalysis: any): { exclude: boolean; reason?: string } => {
  // Basic keyword exclusion
  if (task.exclude_keywords && task.exclude_keywords.length > 0) {
    const titleLower = item.title.toLowerCase();
    const hasExcludedKeyword = task.exclude_keywords.some(keyword => 
      titleLower.includes(keyword.toLowerCase())
    );
    if (hasExcludedKeyword) {
      return { exclude: true, reason: 'Contains excluded keyword' };
    }
  }

  // AI-based exclusion
  if (aiAnalysis) {
    if (aiAnalysis.qualityScore < 30) {
      return { exclude: true, reason: `Low quality score: ${aiAnalysis.qualityScore}` };
    }

    if (aiAnalysis.riskFlags && aiAnalysis.riskFlags.length > 2) {
      return { exclude: true, reason: `Multiple risk flags: ${aiAnalysis.riskFlags.join(', ')}` };
    }

    if (task.item_type === 'jewelry' && aiAnalysis.extractedData?.profit_scrap < -50) {
      return { exclude: true, reason: 'Negative scrap value profit' };
    }
  }

  return { exclude: false };
};

const getMatchTableName = (itemType: string): string => {
  return `matches_${itemType}`;
};

const createMatchRecord = (task: Task, item: any, aiAnalysis?: any) => {
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
    status: 'new' as const,
    ai_score: aiAnalysis?.qualityScore || null,
    ai_reasoning: aiAnalysis?.reasoning || null
  };

  // Add type-specific fields based on item type
  switch (task.item_type) {
    case 'watch':
      return {
        ...baseMatch,
        case_material: aiAnalysis?.caseMaterial || item.caseMaterial || 'Unknown',
        band_material: item.bandMaterial || 'Unknown',
        movement: aiAnalysis?.movement || item.movement || 'Unknown',
        dial_colour: item.dialColour || 'Unknown',
        case_size_mm: item.caseSizeMm || null,
        chrono24_avg: aiAnalysis?.marketValue || null,
        price_diff_percent: aiAnalysis?.marketValue ? 
          ((aiAnalysis.marketValue - item.price) / aiAnalysis.marketValue * 100) : null
      };
    
    case 'jewelry':
      return {
        ...baseMatch,
        weight_g: aiAnalysis?.extractedData?.weight_g || item.weightG || null,
        karat: aiAnalysis?.karat || item.karat || null,
        metal_type: aiAnalysis?.metalType || item.metalType || 'Unknown',
        spot_price_oz: aiAnalysis?.extractedData?.spot_price_oz || item.spotPriceOz || null,
        melt_value: aiAnalysis?.extractedData?.melt_value || item.meltValue || null,
        profit_scrap: aiAnalysis?.extractedData?.profit_scrap || item.profitScrap || null,
      };
    
    case 'gemstone':
      return {
        ...baseMatch,
        shape: aiAnalysis?.cut || item.shape || 'Unknown',
        carat: aiAnalysis?.carat || item.carat || null,
        colour: aiAnalysis?.color || item.colour || 'Unknown',
        clarity: aiAnalysis?.clarity || item.clarity || 'Unknown',
        cut_grade: aiAnalysis?.cut || item.cutGrade || 'Unknown',
        cert_lab: item.certLab || 'Unknown',
        rapnet_avg: aiAnalysis?.marketValue || null,
        price_diff_percent: aiAnalysis?.marketValue ? 
          ((aiAnalysis.marketValue - item.price) / aiAnalysis.marketValue * 100) : null
      };
    
    default:
      return baseMatch;
  }
};

const processTask = async (task: Task) => {
  console.log(`🔄 Processing task: ${task.name} (${task.id}) - Type: ${task.item_type}, Interval: ${task.poll_interval}s`);
  
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
    console.log(`📦 Found ${items?.length || 0} items for task ${task.name}`);

    if (!items || items.length === 0) {
      console.log(`📭 No items found for task ${task.name}`);
      return;
    }

    const tableName = getMatchTableName(task.item_type);
    let newMatches = 0;
    let analyzedItems = 0;
    let excludedItems = 0;
    
    // Process each item with AI analysis
    for (const item of items.slice(0, 10)) { // Limit to first 10 items
      analyzedItems++;
      
      // Skip if price is too high
      if (task.max_price && item.price > task.max_price) {
        console.log(`💰 Skipping item ${item.itemId} - price too high: $${item.price}`);
        excludedItems++;
        continue;
      }

      // Skip if seller feedback is too low
      if (task.min_seller_feedback && item.sellerInfo?.feedbackScore < task.min_seller_feedback) {
        console.log(`⭐ Skipping item ${item.itemId} - feedback too low: ${item.sellerInfo?.feedbackScore}`);
        excludedItems++;
        continue;
      }

      // Check if we already have this item (duplicate prevention)
      const { data: existingMatch } = await supabase
        .from(tableName)
        .select('id')
        .eq('ebay_listing_id', item.itemId)
        .eq('task_id', task.id)
        .single();

      if (existingMatch) {
        console.log(`🔄 Item ${item.itemId} already exists, skipping`);
        continue;
      }

      // AI Analysis
      const aiAnalysis = await analyzeItemWithAI(task, item);
      
      // Smart exclusion logic
      const exclusionCheck = shouldExcludeItem(task, item, aiAnalysis);
      if (exclusionCheck.exclude) {
        console.log(`🚫 Excluding item: ${exclusionCheck.reason} - ${item.title}`);
        excludedItems++;
        continue;
      }

      // Create new match record with AI analysis data
      const matchData = createMatchRecord(task, item, aiAnalysis);

      const { error: insertError } = await supabase
        .from(tableName)
        .insert(matchData);

      if (insertError) {
        console.error('❌ Error inserting match:', insertError);
      } else {
        const aiInfo = aiAnalysis ? `(AI: ${aiAnalysis.qualityScore}/100, Deal: ${aiAnalysis.dealScore}/100)` : '';
        console.log(`✅ Created ${task.item_type} match: ${item.title} - $${item.price} ${aiInfo}`);
        newMatches++;
      }
    }

    // Update task last_run timestamp
    await supabase
      .from('tasks')
      .update({ last_run: new Date().toISOString() })
      .eq('id', task.id);

    console.log(`🎯 Task ${task.name} completed: ${newMatches} new matches, ${excludedItems} excluded, ${analyzedItems} analyzed`);

  } catch (error) {
    console.error(`❌ Error processing task ${task.id}:`, error);
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Task scheduler with AI analysis started');

    const requestBody = await req.json().catch(() => ({}));
    const specificTaskId = requestBody.taskId;

    let tasks;
    
    if (specificTaskId) {
      // Process specific task (called by cron job)
      console.log(`🎯 Processing specific task: ${specificTaskId}`);
      const { data: taskData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', specificTaskId)
        .eq('status', 'active')
        .single();

      if (error || !taskData) {
        console.log(`⚠️ Task ${specificTaskId} not found or not active`);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Task not found or not active',
          taskId: specificTaskId
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      tasks = [taskData];
    } else {
      // Process all active tasks (manual trigger)
      console.log('🔄 Processing all active tasks');
      const { data: allTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      tasks = allTasks || [];
    }

    console.log(`📋 Found ${tasks.length} active task(s) to process`);

    if (tasks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active tasks to process',
        tasksProcessed: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Process each task
    let processedCount = 0;
    for (const task of tasks) {
      console.log(`\n--- Processing Task: ${task.name} ---`);
      await processTask(task);
      processedCount++;
    }

    const message = specificTaskId 
      ? `Individual task scheduler completed for task ${specificTaskId}`
      : `Batch task scheduler completed`;

    return new Response(JSON.stringify({ 
      success: true,
      message,
      tasksProcessed: processedCount,
      totalTasks: tasks.length,
      taskId: specificTaskId || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('💥 Error in task scheduler:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
