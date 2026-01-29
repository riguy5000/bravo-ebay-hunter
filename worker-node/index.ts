// ============================================
// eBay Hunter Worker - Node.js Version
// Runs continuously on Digital Ocean Droplet
// ============================================

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10); // 60 seconds

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Slack configuration
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || ''; // Legacy fallback
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const DEFAULT_SLACK_CHANNEL = process.env.DEFAULT_SLACK_CHANNEL || ''; // Default channel if none specified
const SLACK_INVITE_USERS = process.env.SLACK_INVITE_USERS || 'U0A4V979EKZ,U0A4P0XL9E3'; // Users to auto-invite to new channels

// Test seller username - listings from this seller bypass all filters
const TEST_SELLER_USERNAME = process.env.TEST_SELLER_USERNAME || 'pe952597';

// Track test listings we've already notified about (in-memory cache)
const notifiedTestListings = new Set<string>();

// Test listings log file - only logs test seller detections
const TEST_LISTINGS_LOG = path.join(__dirname, 'test-listings.log');

function logTestListing(item: any, message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n` +
    `  Title: ${item.title}\n` +
    `  Price: $${item.price}\n` +
    `  Item ID: ${item.itemId}\n` +
    `  URL: ${item.listingUrl}\n` +
    `  Seller: ${item.sellerInfo?.name || 'Unknown'}\n` +
    `---\n`;

  fs.appendFileSync(TEST_LISTINGS_LOG, logEntry);
  console.log(`📝 Logged to ${TEST_LISTINGS_LOG}`);
}

// ============================================
// Slack Notification Functions
// ============================================

// Helper function to calculate latency from item creation to now
function calculateLatency(itemCreationDate?: string | null): string {
  if (!itemCreationDate) return 'N/A';

  try {
    const listingTime = new Date(itemCreationDate).getTime();
    const now = Date.now();
    const latencyMs = now - listingTime;

    if (latencyMs < 0) return 'N/A'; // Future date (shouldn't happen)

    const hours = Math.floor(latencyMs / 3600000);
    const mins = Math.floor((latencyMs % 3600000) / 60000);
    const secs = Math.floor((latencyMs % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  } catch (e) {
    return 'N/A';
  }
}

// Helper function to post to Slack using Bot API or webhook fallback
// Returns message timestamp (ts) and channel ID for tracking reactions
async function postToSlack(
  message: any,
  channel?: string
): Promise<{ ok: boolean; error?: string; ts?: string; channelId?: string }> {
  // If we have a bot token and a channel, use the Slack API
  if (SLACK_BOT_TOKEN && channel) {
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
        },
        body: JSON.stringify({
          channel: channel,
          ...message
        })
      });

      const result = await response.json() as any;
      if (!result.ok) {
        console.log(`  ⚠️ Slack API error: ${result.error}`);
        return { ok: false, error: result.error };
      }
      // Return message timestamp and channel ID for reaction tracking
      return { ok: true, ts: result.ts, channelId: result.channel };
    } catch (error: any) {
      console.log(`  ⚠️ Slack API request failed: ${error.message}`);
      return { ok: false, error: error.message };
    }
  }

  // Fallback to webhook if no bot token or no channel specified
  if (SLACK_WEBHOOK_URL) {
    try {
      const response = await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        return { ok: false, error: `${response.status} ${response.statusText}` };
      }
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: false, error: 'No Slack configuration available' };
}

// Create a Slack channel for a task
async function createSlackChannel(taskName: string): Promise<{ ok: boolean; channel?: string; channelId?: string; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    return { ok: false, error: 'No Slack bot token configured' };
  }

  // Convert task name to valid Slack channel name (lowercase, no spaces, max 80 chars)
  const channelName = taskName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')  // Replace invalid chars with dashes
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-|-$/g, '')         // Remove leading/trailing dashes
    .substring(0, 80);             // Max 80 chars

  if (!channelName) {
    return { ok: false, error: 'Invalid channel name' };
  }

  try {
    console.log(`  📢 Creating Slack channel: #${channelName}`);

    const response = await fetch('https://slack.com/api/conversations.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify({
        name: channelName,
        is_private: false
      })
    });

    const result = await response.json() as any;

    if (!result.ok) {
      // If channel already exists, try to get its ID by looking it up
      if (result.error === 'name_taken') {
        console.log(`  ℹ️ Channel #${channelName} already exists, looking up ID...`);
        const existingChannelId = await getChannelIdByName(channelName);
        return { ok: true, channel: channelName, channelId: existingChannelId };
      }
      console.log(`  ⚠️ Failed to create channel: ${result.error}`);
      return { ok: false, error: result.error };
    }

    console.log(`  ✅ Created Slack channel: #${channelName}`);

    // Auto-invite users to the new channel
    const channelId = result.channel.id;
    await inviteUsersToChannel(channelId, channelName);

    return { ok: true, channel: result.channel.name, channelId: channelId };
  } catch (error: any) {
    console.log(`  ⚠️ Error creating Slack channel: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

// Get channel ID by name
async function getChannelIdByName(channelName: string): Promise<string | undefined> {
  if (!SLACK_BOT_TOKEN) return undefined;

  try {
    const response = await fetch(`https://slack.com/api/conversations.list?types=public_channel&limit=1000`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
      }
    });

    const result = await response.json() as any;
    if (!result.ok) return undefined;

    const channel = result.channels?.find((c: any) => c.name === channelName);
    return channel?.id;
  } catch {
    return undefined;
  }
}

// Invite users to a Slack channel
async function inviteUsersToChannel(channelId: string, channelName: string): Promise<void> {
  if (!SLACK_BOT_TOKEN || !SLACK_INVITE_USERS) return;

  const userIds = SLACK_INVITE_USERS.split(',').map(id => id.trim()).filter(id => id);
  if (userIds.length === 0) return;

  console.log(`  👥 Inviting ${userIds.length} user(s) to #${channelName}...`);

  for (const userId of userIds) {
    try {
      const response = await fetch('https://slack.com/api/conversations.invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
        },
        body: JSON.stringify({
          channel: channelId,
          users: userId
        })
      });

      const result = await response.json() as any;

      if (!result.ok) {
        // already_in_channel is fine, other errors we log
        if (result.error !== 'already_in_channel') {
          console.log(`  ⚠️ Failed to invite ${userId}: ${result.error}`);
        }
      } else {
        console.log(`  ✅ Invited user ${userId} to #${channelName}`);
      }
    } catch (error: any) {
      console.log(`  ⚠️ Error inviting ${userId}: ${error.message}`);
    }
  }
}

// Ensure a task has a Slack channel, creating one if needed
async function ensureTaskSlackChannel(task: Task): Promise<string | undefined> {
  // If task already has a channel, use it
  if (task.slack_channel) {
    return task.slack_channel;
  }

  // If no bot token, can't create channels
  if (!SLACK_BOT_TOKEN) {
    return undefined;
  }

  // Create a channel based on task name
  const result = await createSlackChannel(task.name);

  if (result.ok && result.channel) {
    // Update the task with the new channel and channel ID
    const updateData: any = { slack_channel: result.channel };
    if (result.channelId) {
      updateData.slack_channel_id = result.channelId;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', task.id);

    if (error) {
      console.log(`  ⚠️ Failed to save channel to task: ${error.message}`);
    } else {
      console.log(`  ✅ Saved channel #${result.channel} (ID: ${result.channelId}) to task`);
      // Update the task object in memory too
      task.slack_channel = result.channel;
      task.slack_channel_id = result.channelId;
    }

    return result.channel;
  }

  return undefined;
}

// Special notification for test listings (bypasses all filters)
async function sendTestListingNotification(item: any, channel?: string): Promise<void> {
  if (!SLACK_BOT_TOKEN && !SLACK_WEBHOOK_URL) return;

  try {
    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🧪 *TEST LISTING DETECTED*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${item.title.substring(0, 150)}*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `💰 $${item.price} | Seller: ${item.sellerInfo?.name || 'Unknown'}`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View on eBay", emoji: true },
              url: item.listingUrl,
              style: "primary"
            }
          ]
        }
      ]
    };

    const result = await postToSlack(message, channel || DEFAULT_SLACK_CHANNEL);

    if (!result.ok) {
      console.log(`⚠️ Test listing Slack notification failed: ${result.error}`);
    } else {
      console.log(`🧪 Test listing notification sent!`);
    }
  } catch (error) {
    console.error('❌ Error sending test listing notification:', error);
  }
}

async function sendJewelrySlackNotification(
  match: any,
  karat: number | null,
  weightG: number | null,
  shippingCost: number | undefined,
  shippingType: string | undefined,
  meltValue: number | null,
  channel?: string,
  itemCreationDate?: string | null
): Promise<{ sent: boolean; ts?: string; channelId?: string }> {
  if (!SLACK_BOT_TOKEN && !SLACK_WEBHOOK_URL) {
    console.log('  ⚠️ Slack not configured, skipping notification');
    return { sent: false };
  }

  console.log(`  📤 Sending Slack notification for: ${match.ebay_title.substring(0, 50)}...`);

  try {
    // Calculate latency (time from item listed on eBay to notification)
    const latency = calculateLatency(itemCreationDate);

    // Determine if shipping is known (free or fixed with a value)
    const shippingKnown = shippingType === 'free' || (shippingCost !== undefined && shippingType !== 'calculated');
    const actualShipping = shippingKnown ? (shippingCost || 0) : 0;
    const totalCost = match.listed_price + actualShipping;

    // Format price display: "$X total" if shipping known, "$X + shipping" if unknown
    const priceDisplay = shippingKnown
      ? `*$${totalCost.toFixed(2)}* total`
      : `*$${match.listed_price.toFixed(2)}* + shipping`;

    const offerPrice = meltValue ? (meltValue * 0.87).toFixed(0) : null;
    const breakEven = meltValue ? meltValue * 0.97 : null;
    const profit = breakEven ? (breakEven - totalCost).toFixed(0) : null;
    const profitMarginPct = breakEven && totalCost > 0 ? ((breakEven - totalCost) / totalCost * 100).toFixed(0) : null;
    const profitEmoji = profit && parseFloat(profit) >= 0 ? '🟢 ' : '';
    const profitDisplay = shippingKnown && profitMarginPct ? `${profitEmoji}${profitMarginPct}%` : '?';

    // Determine sidebar color based on profit
    const sidebarColor = profit && parseFloat(profit) > 0 ? '#36a64f' : '#dc3545';

    // Fallback text for push notifications
    const notificationText = `💍 ${match.ebay_title.substring(0, 80)} | ${karat || '?'}K | ${weightG ? weightG.toFixed(2) + 'g' : '?'} | Offer: ${offerPrice ? '$' + offerPrice : '?'}`;

    const message = {
      attachments: [
        {
          color: sidebarColor,
          fallback: notificationText,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${match.ebay_title.substring(0, 150)}*`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `💍 ${priceDisplay} | *${karat || '?'}K* | *${weightG ? weightG.toFixed(2) + 'g' : '?'}* | Offer: *${offerPrice ? '$' + offerPrice : '?'}* | Profit: *${profitDisplay}*`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `⏱️ Latency: *${latency}*`
                }
              ]
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View on eBay", emoji: true },
                  url: match.ebay_url,
                  style: "primary"
                }
              ]
            }
          ]
        }
      ]
    };

    const targetChannel = channel || DEFAULT_SLACK_CHANNEL;
    if (!targetChannel) {
      console.log(`  ⚠️ No Slack channel specified and no DEFAULT_SLACK_CHANNEL set`);
      return { sent: false };
    }

    const result = await postToSlack(message, targetChannel);

    if (!result.ok) {
      console.log(`  ⚠️ Slack notification failed: ${result.error}`);
      console.log(`  ⚠️ [DEBUG] Failed channel: ${targetChannel}, BOT_TOKEN set: ${!!SLACK_BOT_TOKEN}`);
      return { sent: false };
    } else {
      console.log(`  ✅ Slack notification sent successfully to ${targetChannel}`);
      return { sent: true, ts: result.ts, channelId: result.channelId };
    }
  } catch (error: any) {
    console.log(`  ⚠️ Slack notification error: ${error.message}`);
    console.log(`  ⚠️ [DEBUG] Error stack: ${error.stack}`);
    return { sent: false };
  }
}

async function sendGemstoneSlackNotification(
  match: any,
  stone: any,
  dealScore: number,
  riskScore: number,
  channel?: string,
  itemCreationDate?: string | null
): Promise<{ sent: boolean; ts?: string; channelId?: string }> {
  if (!SLACK_BOT_TOKEN && !SLACK_WEBHOOK_URL) return { sent: false };

  try {
    // Calculate latency (time from item listed on eBay to notification)
    const latency = calculateLatency(itemCreationDate);

    const scoreEmoji = dealScore >= 80 ? '🔥' : dealScore >= 60 ? '💎' : '📋';
    const riskEmoji = riskScore >= 50 ? '⚠️' : riskScore >= 30 ? '🔶' : '✅';
    const riskText = riskScore >= 50 ? 'High' : riskScore >= 30 ? 'Med' : 'Low';

    const stoneDetails = [
      stone.shape || '?',
      stone.color || '?',
      stone.clarity || '?',
      stone.certification || 'No Cert'
    ].join(' | ');

    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${scoreEmoji} *${stone.carat ? stone.carat.toFixed(2) + 'ct' : '?ct'} ${stone.stone_type || 'Stone'}* - $${match.listed_price}\n${stoneDetails} | Deal: *${dealScore}* | Risk: ${riskEmoji}${riskText}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: match.ebay_title.substring(0, 150)
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `⏱️ Latency: *${latency}*`
            }
          ]
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View on eBay", emoji: true },
              url: match.ebay_url,
              style: "primary"
            }
          ]
        }
      ]
    };

    const result = await postToSlack(message, channel || DEFAULT_SLACK_CHANNEL);

    if (!result.ok) {
      console.log(`⚠️ Gemstone Slack notification failed: ${result.error}`);
      return { sent: false };
    }
    return { sent: true, ts: result.ts, channelId: result.channelId };
  } catch (error: any) {
    console.log(`⚠️ Gemstone Slack notification error: ${error.message}`);
    return { sent: false };
  }
}

// ============================================
// Notification Retry Mechanism
// ============================================

async function retryFailedNotifications(): Promise<void> {
  console.log('🔄 Checking for failed notifications to retry...');

  // Retry jewelry notifications - join with tasks to get slack_channel
  const { data: jewelryMatches, error: jewelryError } = await supabase
    .from('matches_jewelry')
    .select('*, tasks!inner(slack_channel)')
    .eq('notification_sent', false)
    .order('found_at', { ascending: false })
    .limit(10);

  if (jewelryError) {
    console.log(`  ⚠️ Error fetching jewelry matches for retry: ${jewelryError.message}`);
  } else if (jewelryMatches && jewelryMatches.length > 0) {
    console.log(`  📋 Found ${jewelryMatches.length} jewelry matches to retry`);

    for (const match of jewelryMatches) {
      // For retries, shipping_cost being null means unknown, otherwise it's known
      const shippingKnown = match.shipping_cost !== null;
      const slackChannel = (match.tasks as any)?.slack_channel;
      console.log(`  🔄 Retrying notification for match ${match.id} to channel: ${slackChannel || 'default'}...`);
      const slackResult = await sendJewelrySlackNotification(
        match,
        match.karat,
        match.weight_g,
        match.shipping_cost ?? undefined,
        shippingKnown ? 'fixed' : undefined,  // Infer type from stored data
        match.melt_value,
        slackChannel,
        match.item_creation_date
      );

      if (slackResult.sent) {
        const updateData: any = { notification_sent: true };
        if (slackResult.ts) updateData.slack_message_ts = slackResult.ts;
        if (slackResult.channelId) updateData.slack_channel_id = slackResult.channelId;

        await supabase
          .from('matches_jewelry')
          .update(updateData)
          .eq('id', match.id);
        console.log(`  ✅ Retry successful for: ${match.ebay_title.substring(0, 40)}... (ts: ${slackResult.ts})`);
      } else {
        console.log(`  ❌ Retry FAILED for match ${match.id}: ${match.ebay_title.substring(0, 40)}...`);
      }

      // Rate limit delay for Slack (they silently drop messages if sent too fast)
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }

  // Retry gemstone notifications - join with tasks to get slack_channel
  const { data: gemstoneMatches, error: gemstoneError } = await supabase
    .from('matches_gemstone')
    .select('*, tasks!inner(slack_channel)')
    .eq('notification_sent', false)
    .order('found_at', { ascending: false })
    .limit(10);

  if (gemstoneError) {
    console.log(`  ⚠️ Error fetching gemstone matches for retry: ${gemstoneError.message}`);
  } else if (gemstoneMatches && gemstoneMatches.length > 0) {
    console.log(`  📋 Found ${gemstoneMatches.length} gemstone matches to retry`);

    for (const match of gemstoneMatches) {
      // For gemstone, we need to reconstruct the stone object
      const stone = {
        stone_type: match.stone_type,
        shape: match.shape,
        carat: match.carat,
        color: match.colour,
        clarity: match.clarity,
        certification: match.cert_lab,
        treatment: match.treatment,
        is_natural: match.is_natural,
      };

      const slackChannel = (match.tasks as any)?.slack_channel;
      // Actually send the notification and mark as sent
      console.log(`  🔄 Retrying gemstone notification for match ${match.id} to channel: ${slackChannel || 'default'}...`);
      const slackResult = await sendGemstoneSlackNotification(match, stone, match.deal_score || 0, match.risk_score || 0, slackChannel, match.item_creation_date);

      if (slackResult.sent) {
        const updateData: any = { notification_sent: true };
        if (slackResult.ts) updateData.slack_message_ts = slackResult.ts;
        if (slackResult.channelId) updateData.slack_channel_id = slackResult.channelId;

        await supabase
          .from('matches_gemstone')
          .update(updateData)
          .eq('id', match.id);
        console.log(`  ✅ Retry successful for: ${match.ebay_title?.substring(0, 40) || 'gemstone'}... (ts: ${slackResult.ts})`);
      } else {
        console.log(`  ❌ Retry FAILED for gemstone match ${match.id}: ${match.ebay_title?.substring(0, 40) || 'gemstone'}...`);
      }

      // Rate limit delay for Slack (they silently drop messages if sent too fast)
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }

  console.log('🔄 Notification retry check complete');
}

// ============================================
// Watch Extraction Functions
// ============================================

function extractWatchCaseMaterial(title: string, specs: Record<string, string> = {}): string | null {
  const caseMaterial = specs['case material'] || specs['case/bezel material'] || specs['material'] || '';
  if (caseMaterial) return caseMaterial;

  const titleLower = title.toLowerCase();
  const materials = [
    'stainless steel', 'steel', 'titanium', 'gold', 'rose gold', 'white gold',
    'yellow gold', 'platinum', 'ceramic', 'carbon fiber', 'bronze', 'brass',
    'plastic', 'resin', 'aluminum', 'silver'
  ];

  for (const material of materials) {
    if (titleLower.includes(material)) {
      return material.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

function extractWatchBandMaterial(title: string, specs: Record<string, string> = {}): string | null {
  const bandMaterial = specs['band material'] || specs['band/strap material'] ||
                       specs['strap material'] || specs['bracelet material'] || '';
  if (bandMaterial) return bandMaterial;

  const titleLower = title.toLowerCase();
  const materials = ['leather', 'rubber', 'silicone', 'nato', 'nylon', 'canvas',
                     'stainless steel', 'steel', 'mesh', 'bracelet', 'gold', 'titanium'];

  for (const material of materials) {
    if (titleLower.includes(material + ' band') ||
        titleLower.includes(material + ' strap') ||
        titleLower.includes(material + ' bracelet')) {
      return material.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

function extractWatchMovement(title: string, specs: Record<string, string> = {}): string | null {
  const movement = specs['movement'] || specs['watch movement'] || specs['movement type'] || '';
  if (movement) return movement;

  const movements = [
    { pattern: /automatic/i, value: 'Automatic' },
    { pattern: /self[- ]?wind/i, value: 'Automatic' },
    { pattern: /mechanical/i, value: 'Mechanical' },
    { pattern: /manual[- ]?wind/i, value: 'Manual' },
    { pattern: /hand[- ]?wound/i, value: 'Manual' },
    { pattern: /quartz/i, value: 'Quartz' },
    { pattern: /solar/i, value: 'Solar' },
    { pattern: /kinetic/i, value: 'Kinetic' },
    { pattern: /eco[- ]?drive/i, value: 'Eco-Drive' },
    { pattern: /spring drive/i, value: 'Spring Drive' }
  ];

  for (const { pattern, value } of movements) {
    if (pattern.test(title)) return value;
  }
  return null;
}

function extractWatchDialColor(title: string, specs: Record<string, string> = {}): string | null {
  const dialColor = specs['dial color'] || specs['dial colour'] || specs['face color'] || '';
  if (dialColor) return dialColor;

  const colorMatch = title.match(/(black|white|blue|green|silver|gold|grey|gray|red|brown|champagne|mother of pearl|mop)\s*dial/i);
  if (colorMatch) {
    const color = colorMatch[1];
    return color.charAt(0).toUpperCase() + color.slice(1);
  }
  return null;
}

function extractWatchYear(title: string, specs: Record<string, string> = {}): number | null {
  const yearFields = ['year manufactured', 'year', 'year of manufacture',
                      'manufacture year', 'model year', 'production year'];

  for (const field of yearFields) {
    const value = specs[field];
    if (value) {
      const yearMatch = value.match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year >= 1800 && year <= new Date().getFullYear() + 1) return year;
      }
    }
  }

  const yearMatch = title.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1900 && year <= new Date().getFullYear() + 1) return year;
  }
  return null;
}

function extractWatchBrand(title: string, specs: Record<string, string> = {}): string | null {
  const brand = specs['brand'] || '';
  if (brand && brand.toLowerCase() !== 'unbranded') return brand;

  const brands = [
    'Rolex', 'Omega', 'Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin',
    'Jaeger-LeCoultre', 'IWC', 'Cartier', 'Breitling', 'TAG Heuer', 'Tudor',
    'Panerai', 'Hublot', 'Zenith', 'Grand Seiko', 'Seiko', 'Citizen', 'Casio',
    'Tissot', 'Longines', 'Hamilton', 'Oris', 'Bell & Ross', 'Nomos',
    'Sinn', 'Fortis', 'Junghans', 'Movado', 'Bulova', 'Timex', 'Fossil',
    'Michael Kors', 'Invicta', 'Orient', 'Rado', 'Maurice Lacroix',
    'Frederique Constant', 'Baume & Mercier', 'Chopard', 'Girard-Perregaux'
  ];

  const titleLower = title.toLowerCase();
  for (const b of brands) {
    if (titleLower.includes(b.toLowerCase())) return b;
  }
  return null;
}

function extractWatchModel(title: string, specs: Record<string, string> = {}): string | null {
  const model = specs['model'] || specs['model number'] || '';
  if (model) return model;
  return null;
}

// ============================================
// Metal Exclusion Keywords
// ============================================

const METAL_KEYWORDS: Record<string, string[]> = {
  // Precious metals (gold)
  'Yellow Gold': ['yellow gold'],
  'White Gold': ['white gold'],
  'Rose Gold': ['rose gold'],
  'Gold': ['gold', '10k', '14k', '18k', '24k', '10kt', '14kt', '18kt', '24kt'],

  // Precious metals (other)
  'Sterling Silver': ['sterling silver', '925 silver', '.925'],
  'Silver': ['silver'],
  'Platinum': ['platinum'],
  'Palladium': ['palladium'],

  // Base/fashion metals (to exclude for scrap hunting)
  'Stainless Steel': ['stainless steel', 'stainless'],
  'Steel': ['steel'],
  'Titanium': ['titanium'],
  'Tungsten': ['tungsten', 'tungsten carbide'],
  'Brass': ['brass'],
  'Bronze': ['bronze'],
  'Copper': ['copper'],
  'Pewter': ['pewter'],
  'Aluminum': ['aluminum', 'aluminium'],
  'Nickel': ['nickel'],
  'Alloy': ['alloy', 'metal alloy'],

  // Plated/filled (usually excluded anyway)
  'Gold Plated': ['gold plated', 'gold-plated', 'plated'],
  'Gold Filled': ['gold filled', 'gold-filled', 'filled'],
  'Silver Plated': ['silver plated', 'silver-plated'],
  'Rhodium Plated': ['rhodium plated', 'rhodium-plated'],
};

/**
 * Get exclusion keywords based on metals NOT selected
 * Returns keywords that should be excluded from search to avoid non-selected metals
 */
function getMetalExclusionKeywords(selectedMetals: string[]): string[] {
  if (!selectedMetals || selectedMetals.length === 0) {
    return []; // No metals selected = no auto-exclusions
  }

  const exclusions = new Set<string>();
  const selectedLower = selectedMetals.map(m => m.toLowerCase());

  for (const [metalName, keywords] of Object.entries(METAL_KEYWORDS)) {

    // Check if this metal (or a parent category) is selected
    const isSelected = selectedLower.some(selected =>
      metalName.toLowerCase().includes(selected) ||
      selected.includes(metalName.toLowerCase())
    );

    if (!isSelected) {
      // Add keywords for unselected metals
      // But be smart - don't add generic terms that might match selected metals
      for (const keyword of keywords) {
        // Skip if keyword might match a selected metal
        const mightMatchSelected = selectedLower.some(selected =>
          keyword.includes(selected.split(' ')[0]) ||
          selected.includes(keyword.split(' ')[0])
        );

        if (!mightMatchSelected) {
          exclusions.add(keyword);
        }
      }
    }
  }

  return Array.from(exclusions);
}

// ============================================
// Gemstone Constants
// ============================================

const GEMSTONE_TYPES = [
  'Diamond', 'Ruby', 'Sapphire', 'Emerald', 'Alexandrite',
  'Spinel', 'Tanzanite', 'Tourmaline', 'Garnet', 'Aquamarine',
  'Morganite', 'Amethyst', 'Citrine', 'Topaz', 'Peridot',
  'Opal', 'Jade', 'Turquoise', 'Zircon', 'Tsavorite',
  'Paraiba', 'Padparadscha', 'Kunzite', 'Beryl', 'Chrysoberyl'
];

const STONE_SHAPES = [
  'Round', 'Oval', 'Cushion', 'Princess', 'Emerald', 'Radiant',
  'Asscher', 'Marquise', 'Pear', 'Heart', 'Trillion', 'Baguette',
  'Square', 'Octagon', 'Cabochon', 'Rose Cut', 'Old Mine', 'Old European'
];

const DIAMOND_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
const DIAMOND_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'];

const CERT_LABS = {
  premium: ['GIA', 'AGS', 'AGL', 'Gubelin', 'SSEF', 'GRS'],
  standard: ['IGI', 'GCAL', 'HRD', 'CGL'],
  budget: ['EGL', 'GSI', 'IGL', 'Other']
};

// Gemstone blacklist - simulants and fakes
const GEMSTONE_BLACKLIST = [
  'cz', 'cubic zirconia', 'cubic zircona', 'moissanite', 'moissonite',
  'simulant', 'simulated', 'faux', 'fake', 'imitation',
  'lab created', 'lab-created', 'lab grown', 'lab-grown',
  'synthetic', 'man made', 'man-made', 'cultured diamond',
  'glass', 'crystal', 'rhinestone', 'acrylic', 'plastic', 'resin',
  'diamonique', 'swarovski', 'yag', 'ggg', 'strontium titanate',
  'doublet', 'triplet', 'composite', 'assembled'
];

const LAB_CREATED_TERMS = [
  'lab created', 'lab-created', 'lab grown', 'lab-grown',
  'synthetic', 'man made', 'man-made', 'cultured diamond', 'cvd', 'hpht'
];

// eBay category IDs for gemstones (to filter out machinery/tools)
const GEMSTONE_CATEGORY_IDS = ['10207', '51089', '164694', '262026', '262027'];

// eBay category IDs for jewelry (based on actual eBay leaf categories from API responses)
// Parent categories
const JEWELRY_CATEGORY_IDS = [
  '281',      // Jewelry & Watches (parent)
  '164331',   // Fine Jewelry (parent)
  '67681',    // Fashion Jewelry (parent)
  '67680',    // Vintage & Antique Jewelry (parent)
  '261990',   // Men's Jewelry (parent)
  // Fine Jewelry leaf categories (261xxx-262xxx range)
  '261988',   // Fine Bracelets
  '261989',   // Fine Pins & Brooches
  '261993',   // Fine Pendants
  '261994',   // Fine Rings
  '261995',   // Fine Necklaces
  '262003',   // Fine Bracelets (alt)
  '262004',   // Fine Brooches & Pins
  '262008',   // Fine Earrings
  '262011',   // Fine Necklaces (alt)
  '262013',   // Fine Pendants (alt)
  '262014',   // Fine Jewelry (general)
  '262016',   // Fine Jewelry Lots
  '261975',   // Themed Fine Jewelry
  // Fashion Jewelry leaf categories
  '50637',    // Fashion Rings
  '155101',   // Fashion Necklaces & Pendants
  '50610',    // Fashion Bracelets
  '50647',    // Fashion Earrings
  '50692',    // Fashion Jewelry Sets
  // Vintage Jewelry leaf categories
  '48579',    // Vintage Rings
  '48585',    // Vintage Necklaces
  '48583',    // Vintage Bracelets
  '48581',    // Vintage Earrings
  // Other jewelry
  '110633',   // Loose Diamonds & Gemstones
  '75576',    // Designer Jewelry
];

// Categories to explicitly REJECT (not jewelry)
const JEWELRY_BLACKLIST_CATEGORIES = [
  '182901',   // Welding equipment
  '262017',   // Jewelry Boxes/Storage
  '13837',    // Decorative Collectibles
  '31387',    // Watches
  '261669',   // Lamps
  '10034',    // Collectibles
  '166725',   // Display stands
  '16102',    // Trinkets
  '38199',    // Furniture
  '1378',     // Disney Collectibles
  '261642',   // Other collectibles
];

// ============================================
// Jewelry Constants (No Stone Filtering)
// ============================================

// Values that indicate "no stone" in eBay item specifics
const NO_STONE_VALUES = [
  'no stone',
  'none',
  'n/a',
  'na',
  'not applicable',
  'not specified',
  'unknown',
  'no main stone',
  'no gemstone',
  ''
];

// Common stone keywords to detect in titles
const STONE_KEYWORDS = [
  'diamond', 'diamonds', 'morganite', 'sapphire', 'ruby', 'emerald',
  'amethyst', 'topaz', 'opal', 'pearl', 'aquamarine', 'garnet',
  'peridot', 'tanzanite', 'tourmaline', 'citrine', 'onyx', 'turquoise',
  'moissanite', 'cz', 'cubic zirconia', 'zirconia', 'crystal', 'crystals',
  'gemstone', 'gemstones', 'stone', 'stones', 'pave', 'pavé', 'halo',
  'solitaire', 'three stone', '3 stone', 'birthstone',
  'malachite', 'lapis', 'jade', 'coral', 'carnelian', 'agate', 'jasper',
  'moonstone', 'labradorite', 'alexandrite', 'iolite', 'spinel', 'zircon'
];

// Costume/fashion jewelry keywords to always exclude
const COSTUME_JEWELRY_EXCLUSIONS = [
  'snap jewelry', 'snap button', 'rhinestone', 'costume', 'fashion jewelry',
  'acrylic', 'plastic', 'glass bead', 'simulated', 'faux', 'fake', 'imitation',
  'cubic zirconia', 'cz stone', ' cz ', 'crystal bead', 'resin', 'enamel',
  'leather', 'cord', 'rope chain', 'paracord',
  ' gf ', ' gf', 'gold gf', ' gp ', ' gp', 'gold gp',
  ' hge ', ' rgp ', ' gep ', 'gold tone', 'goldtone',
  'gold plated', 'gold-plated', 'silver plated', 'silver-plated',
  'gold filled', 'gold-filled', 'rolled gold', 'vermeil'
];

// Bad metals to reject
const BAD_METALS = ['plated', 'filled', 'steel', 'brass', 'bronze', 'copper', 'alloy', 'tone'];

// Jewelry tools, supplies, and equipment to exclude
const JEWELRY_TOOLS_EXCLUSIONS = [
  'welding',
  'welder',
  'soldering',
  'solder',
  'torch',
  'pliers',
  'mandrel',
  'polishing',
  'polisher',
  'buffing',
  'tumbler',
  'jewelry making',
  'jewelry tool',
  'jewelry tools',
  'craft supplies',
  'beading',
  'bead kit',
  'findings',
  'clasps lot',
  'jump rings lot',
  'wire wrap',
  'display stand',
  'jewelry box',
  'jewelry case',
  'ring sizer',
  'loupe',
  'magnifier',
  'scale gram',
  'test kit',
  'acid test',
  'repair kit',
  'mold',
  'casting',
  'crucible',
  'mannequin',
  'bust display',
  'organizer',
  'storage box',
  // Plating equipment
  'plating machine',
  'plating rectifier',
  'electroplating',
  'plater',
  'pen plater',
  // Testing equipment
  'tester',
  'testing kit',
  'appraisal kit',
  'testing acid',
  'test stone',
  'touchstone',
  // Photos/collectibles that mention jewelry
  'daguerreotype',
  'photograph',
  'vintage photo',
  'antique photo',
  'tintype',
  'cabinet card',
  'cdv photo',
  // Trinket boxes and vanity items
  'trinket box',
  'jewelry box',
  'ring box',
  'keepsake box',
  'vanity box',
  'pill box',
  'music box',
  'compact mirror',
  'makeup mirror',
  'vanity mirror',
  'cosmetic mirror',
  'hand mirror',
  'travel mirror',
  'folding mirror',
];

// ============================================
// Jewelry Filtering Functions
// ============================================

function isNoStoneValue(value: string | null | undefined): boolean {
  if (!value) return true;
  return NO_STONE_VALUES.includes(value.toLowerCase().trim());
}

function titleContainsStone(title: string): boolean {
  if (!title) return false;
  const titleLower = title.toLowerCase();
  return STONE_KEYWORDS.some(keyword => titleLower.includes(keyword));
}

function hasCostumeJewelryTerms(title: string): { hasTerm: boolean; term: string | null } {
  const titleLower = ' ' + title.toLowerCase() + ' ';
  for (const term of COSTUME_JEWELRY_EXCLUSIONS) {
    if (titleLower.includes(term)) {
      return { hasTerm: true, term };
    }
  }
  return { hasTerm: false, term: null };
}

function hasJewelryToolTerms(title: string): { hasTerm: boolean; term: string | null } {
  const titleLower = title.toLowerCase();
  for (const term of JEWELRY_TOOLS_EXCLUSIONS) {
    if (titleLower.includes(term)) {
      return { hasTerm: true, term };
    }
  }
  return { hasTerm: false, term: null };
}

function isFakeTone(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return (v.includes('tone') &&
          !v.includes('two-tone') &&
          !v.includes('two tone') &&
          !v.includes('tri-tone') &&
          !v.includes('tri tone') &&
          !v.includes('bicolor') &&
          !v.includes('tricolor'));
}

// Base metals that should always be rejected for precious metal searches
const BASE_METALS_TO_REJECT = [
  'stainless steel', 'stainless', 'steel',
  'titanium', 'tungsten', 'tungsten carbide',
  'brass', 'bronze', 'copper', 'pewter',
  'aluminum', 'aluminium', 'nickel', 'zinc',
  'iron', 'chrome', 'chromium',
  // Non-metal materials
  'glass', 'plastic', 'resin', 'acrylic', 'wood', 'leather', 'fabric', 'cloth', 'rubber',
];

function passesJewelryItemSpecifics(
  title: string,
  specs: Record<string, string>,
  filters: any = {}
): { pass: boolean; reason: string | null } {
  const baseMetal = (specs['base metal'] || '').toLowerCase();
  const metal = (specs['metal'] || '').toLowerCase();
  const material = (specs['material'] || '').toLowerCase();

  // Check for bad metals (plated, filled, etc.)
  for (const bad of BAD_METALS) {
    if (baseMetal.includes(bad) || metal.includes(bad) || material.includes(bad)) {
      return { pass: false, reason: `Metal/Material contains "${bad}"` };
    }
  }

  // Check if silver is NOT selected but item specs contain silver
  const selectedMetals = filters.metal || [];
  const selectedMetalsLower = selectedMetals.map((m: string) => m.toLowerCase());
  const silverSelected = selectedMetalsLower.some((m: string) => m.includes('silver'));

  if (!silverSelected) {
    // Check all metal-related specs for silver
    const allMetalSpecs = `${baseMetal} ${metal} ${material}`;
    if (allMetalSpecs.includes('silver') || allMetalSpecs.includes('925') || allMetalSpecs.includes('.925')) {
      return { pass: false, reason: `Item specs contain silver (not selected): "${metal || material || baseMetal}"` };
    }
  }

  // Check for base metals in specs (stainless steel, titanium, etc.)
  for (const baseMet of BASE_METALS_TO_REJECT) {
    if (baseMetal.includes(baseMet) || metal.includes(baseMet) || material.includes(baseMet)) {
      return { pass: false, reason: `Base metal detected: "${baseMet}"` };
    }
  }

  // Check for fake tone (gold tone, silvertone - not real gold)
  if (isFakeTone(baseMetal) || isFakeTone(metal)) {
    return { pass: false, reason: 'Metal appears to be fake tone (not two-tone/tri-tone)' };
  }

  // Check for costume jewelry terms in title
  const costumeCheck = hasCostumeJewelryTerms(title);
  if (costumeCheck.hasTerm) {
    return { pass: false, reason: `Costume jewelry term: "${costumeCheck.term}"` };
  }

  // Check if "no stone" filtering is enabled (default: true for scrap jewelry)
  const requireNoStone = filters.no_stone !== false; // Default to true

  if (requireNoStone) {
    const mainStone = specs['main stone'] || '';
    const gemstone = specs['gemstone'] || '';
    const stone = specs['stone'] || '';

    // Check if item has stones in specs
    const hasStoneInSpecs = !isNoStoneValue(mainStone) || !isNoStoneValue(gemstone) || !isNoStoneValue(stone);

    if (hasStoneInSpecs) {
      return { pass: false, reason: `Has stone: Main="${mainStone}", Gemstone="${gemstone}", Stone="${stone}"` };
    }

    // Backup: Check title for stone keywords
    if (titleContainsStone(title)) {
      const matchedKeyword = STONE_KEYWORDS.find(kw => title.toLowerCase().includes(kw));
      return { pass: false, reason: `Title contains stone keyword: "${matchedKeyword}"` };
    }
  }

  return { pass: true, reason: null };
}

// ============================================
// Metal Prices & Melt Value Functions
// ============================================

let metalPricesCache: Record<string, any> | null = null;
let metalPricesCacheTime = 0;
const METAL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getMetalPrices(): Promise<Record<string, any> | null> {
  const now = Date.now();
  if (metalPricesCache && (now - metalPricesCacheTime) < METAL_CACHE_TTL) {
    return metalPricesCache;
  }

  try {
    const { data, error } = await supabase
      .from('metal_prices')
      .select('metal, price_gram_10k, price_gram_14k, price_gram_18k, price_gram_24k');

    if (error || !data || data.length === 0) {
      console.log('⚠️ Could not fetch metal prices');
      return null;
    }

    const pricesMap: Record<string, any> = {};
    data.forEach((row: any) => {
      pricesMap[row.metal] = row;
    });

    metalPricesCache = pricesMap;
    metalPricesCacheTime = now;
    return pricesMap;
  } catch (err: any) {
    console.log('⚠️ Error fetching metal prices:', err.message);
    return null;
  }
}

function calculateGoldMeltValue(karat: number | null, weightG: number | null, goldPrices: any): number | null {
  if (!karat || !weightG || !goldPrices) return null;

  const pricePerGram: Record<number, number> = {
    9: goldPrices.price_gram_10k * 0.97,  // 9K is 3% less than 10K
    10: goldPrices.price_gram_10k,
    14: goldPrices.price_gram_14k,
    18: goldPrices.price_gram_18k,
    22: goldPrices.price_gram_18k * (22/18),
    24: goldPrices.price_gram_24k,
  };

  const price = pricePerGram[karat];
  if (!price) return null;

  return weightG * price;
}

function calculateSilverMeltValue(purity: number | null, weightG: number | null, silverPrices: any): number | null {
  if (!purity || !weightG || !silverPrices) return null;
  const purePrice = silverPrices.price_gram_24k;
  if (!purePrice) return null;
  const purityFraction = purity / 1000;
  return weightG * purePrice * purityFraction;
}

function calculatePlatinumMeltValue(purity: number | null, weightG: number | null, platinumPrices: any): number | null {
  if (!purity || !weightG || !platinumPrices) return null;
  const purePrice = platinumPrices.price_gram_24k;
  if (!purePrice) return null;
  const purityFraction = purity / 1000;
  return weightG * purePrice * purityFraction;
}

function detectMetalType(title: string, specs: Record<string, string>): { type: string; purity: number | null } {
  const titleLower = title.toLowerCase();
  const metalSpec = (specs['metal'] || specs['metal type'] || '').toLowerCase();
  const metalPurity = (specs['metal purity'] || specs['purity'] || specs['fineness'] || '').toLowerCase();
  const combined = titleLower + ' ' + metalSpec + ' ' + metalPurity;

  // Check for platinum
  if (combined.includes('platinum') || combined.includes('plat') || combined.includes('pt950') || combined.includes('pt900')) {
    let purity = 950; // Default platinum purity
    // Check metal purity spec first (e.g., "950", "900")
    const purityMatch = metalPurity.match(/(\d{3})/);
    if (purityMatch) {
      const p = parseInt(purityMatch[1]);
      if ([950, 900, 850].includes(p)) purity = p;
    } else if (combined.includes('pt900') || combined.includes('900')) {
      purity = 900;
    } else if (combined.includes('pt850') || combined.includes('850')) {
      purity = 850;
    }
    return { type: 'platinum', purity };
  }

  // Check for palladium
  if (combined.includes('palladium') || combined.includes('pd950') || combined.includes('pd500')) {
    let purity = 950;
    // Check metal purity spec first
    const purityMatch = metalPurity.match(/(\d{3})/);
    if (purityMatch) {
      const p = parseInt(purityMatch[1]);
      if ([950, 500].includes(p)) purity = p;
    } else if (combined.includes('pd500') || combined.includes('500')) {
      purity = 500;
    }
    return { type: 'palladium', purity };
  }

  // Check for silver
  if (combined.includes('sterling') || combined.includes('925') || combined.includes('silver')) {
    let purity = 925; // Default sterling
    // Check metal purity spec first
    const purityMatch = metalPurity.match(/(\d{3})/);
    if (purityMatch) {
      const p = parseInt(purityMatch[1]);
      if ([999, 925, 900, 800].includes(p)) purity = p;
    } else if (combined.includes('999') || combined.includes('fine silver')) {
      purity = 999;
    } else if (combined.includes('900') || combined.includes('coin silver')) {
      purity = 900;
    } else if (combined.includes('800')) {
      purity = 800;
    }
    return { type: 'silver', purity };
  }

  // Default to gold
  return { type: 'gold', purity: null };
}

// ============================================
// Caching Functions (Rejected Items & Item Details)
// ============================================

// Get rejected item IDs for a task (to skip re-processing)
async function getRejectedItemIds(taskId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('rejected_items')
      .select('ebay_listing_id')
      .eq('task_id', taskId)
      .gt('expires_at', new Date().toISOString());

    if (error || !data) return new Set();

    return new Set(data.map((r: any) => r.ebay_listing_id));
  } catch (e) {
    return new Set();
  }
}

// Cache a rejected item (48 hour expiry)
async function cacheRejectedItem(taskId: string, itemId: string, reason: string): Promise<void> {
  try {
    await supabase.from('rejected_items').upsert({
      task_id: taskId,
      ebay_listing_id: itemId,
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
    }, { onConflict: 'task_id,ebay_listing_id' });
  } catch (e) {
    // Cache errors shouldn't break the flow
  }
}

// ============================================
// Pagination Tracking
// ============================================

// Track pagination offset per task (cycles through pages 0, 200, 400, etc.)
const taskPaginationOffsets = new Map<string, number>();
const MAX_PAGINATION_OFFSET = 800; // Max offset before resetting (eBay limits deep pagination)

function getTaskPaginationOffset(taskId: string): number {
  return taskPaginationOffsets.get(taskId) || 0;
}

function advanceTaskPagination(taskId: string, itemsReturned: number): void {
  const currentOffset = taskPaginationOffsets.get(taskId) || 0;

  // If we got fewer items than the limit (200), we've reached the end - reset to page 0
  // Also reset if we've hit the max offset
  if (itemsReturned < 200 || currentOffset >= MAX_PAGINATION_OFFSET) {
    taskPaginationOffsets.set(taskId, 0);
    if (currentOffset > 0) {
      console.log(`📄 Pagination: Completed full cycle, resetting to page 0`);
    }
  } else {
    // Advance to next page
    const newOffset = currentOffset + 200;
    taskPaginationOffsets.set(taskId, newOffset);
    console.log(`📄 Pagination: Advanced to offset ${newOffset} for next poll`);
  }
}

// Get cached item details (24 hour cache)
async function getCachedItemDetails(itemId: string, includeShipping: boolean = false): Promise<any | null> {
  // Skip cache if we need shipping info (cache doesn't store it)
  if (includeShipping) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('ebay_item_cache')
      .select('item_specifics, title, description')
      .eq('ebay_item_id', itemId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    // Return cached data in same format as eBay API
    return {
      localizedAspects: data.item_specifics,
      title: data.title,
      description: data.description || '',
      _fromCache: true
    };
  } catch (e) {
    return null;
  }
}

// Cache item details (24 hour expiry)
async function cacheItemDetails(itemId: string, itemDetails: any): Promise<void> {
  try {
    const itemSpecifics = itemDetails.localizedAspects || [];

    await supabase
      .from('ebay_item_cache')
      .upsert({
        ebay_item_id: itemId,
        item_specifics: itemSpecifics,
        title: itemDetails.title || '',
        description: itemDetails.description || '',
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }, { onConflict: 'ebay_item_id' });
  } catch (e) {
    // Cache errors shouldn't break the flow
  }
}

// Clean up expired cache entries
async function cleanupExpiredCache(): Promise<void> {
  try {
    // Clean expired rejected items
    await supabase
      .from('rejected_items')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Clean expired item cache
    await supabase
      .from('ebay_item_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());
  } catch (e) {
    // Cleanup errors shouldn't break the flow
  }
}

// ============================================
// Gemstone Parsing Functions
// ============================================

function detectStoneType(title: string, specs: Record<string, string> = {}): string | null {
  // Check specs first
  const stoneSpec = specs['type'] || specs['stone type'] || specs['gemstone'] || specs['variety'] || '';
  for (const stoneType of GEMSTONE_TYPES) {
    if (stoneSpec.toLowerCase().includes(stoneType.toLowerCase())) {
      return stoneType;
    }
  }

  // Check title
  const titleLower = title.toLowerCase();
  for (const stoneType of GEMSTONE_TYPES) {
    if (titleLower.includes(stoneType.toLowerCase())) {
      return stoneType;
    }
  }

  return null;
}

function extractStoneShape(title: string, specs: Record<string, string> = {}): string | null {
  const shapeSpec = specs['cut'] || specs['shape'] || specs['cut style'] || '';
  for (const shape of STONE_SHAPES) {
    if (shapeSpec.toLowerCase().includes(shape.toLowerCase())) {
      return shape;
    }
  }

  const titleLower = title.toLowerCase();
  for (const shape of STONE_SHAPES) {
    if (titleLower.includes(shape.toLowerCase())) {
      return shape;
    }
  }

  return null;
}

function extractCaratWeight(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
  // Check specs first
  const weightSpec = specs['total carat weight'] || specs['carat weight'] || specs['carat'] || specs['ct'] || '';
  if (weightSpec) {
    const match = weightSpec.match(/(\d+\.?\d*)/);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 0 && value < 10000) return value;
    }
  }

  // Patterns to extract carat from title
  const patterns = [
    /(\d+\.?\d*)\s*(?:ct|carat|carats|tcw|ctw)/i,
    /(\d+\.?\d*)\s*(?:total\s*(?:carat|ct))/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (value > 0 && value < 10000) return value;
    }
  }

  // Check description
  if (description) {
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (value > 0 && value < 10000) return value;
      }
    }
  }

  return null;
}

function extractStoneColor(title: string, specs: Record<string, string> = {}, stoneType: string | null): string | null {
  // Check specs
  const colorSpec = specs['color'] || specs['colour'] || specs['color grade'] || '';
  if (colorSpec) {
    // For diamonds, extract letter grade
    if (stoneType === 'Diamond') {
      const match = colorSpec.match(/^([D-P])\b/i);
      if (match) return match[1].toUpperCase();
    }
    return colorSpec;
  }

  // For diamonds, check title for color grade
  if (stoneType === 'Diamond') {
    const titleUpper = title.toUpperCase();
    for (const color of DIAMOND_COLORS) {
      const regex = new RegExp(`\\b${color}\\s*(?:color|colour)?\\b`, 'i');
      if (regex.test(title)) return color;
    }
  }

  return null;
}

function extractStoneClarity(title: string, specs: Record<string, string> = {}, stoneType: string | null): string | null {
  const claritySpec = specs['clarity'] || specs['clarity grade'] || '';
  if (claritySpec) {
    for (const clarity of DIAMOND_CLARITIES) {
      if (claritySpec.toUpperCase().includes(clarity)) return clarity;
    }
    return claritySpec;
  }

  if (stoneType === 'Diamond') {
    const titleUpper = title.toUpperCase();
    for (const clarity of DIAMOND_CLARITIES) {
      if (titleUpper.includes(clarity)) return clarity;
    }
  }

  return null;
}

function extractCertification(title: string, specs: Record<string, string> = {}): string | null {
  const certSpec = specs['certification'] || specs['certificate'] || specs['lab'] || specs['grading lab'] || '';

  const allLabs = [...CERT_LABS.premium, ...CERT_LABS.standard, ...CERT_LABS.budget];

  for (const lab of allLabs) {
    if (certSpec.toUpperCase().includes(lab)) return lab;
    if (title.toUpperCase().includes(lab)) return lab;
  }

  if (/certified/i.test(title) || /certified/i.test(certSpec)) {
    return 'Certified';
  }

  return null;
}

function extractTreatment(title: string, specs: Record<string, string> = {}): string | null {
  const treatmentSpec = specs['treatment'] || specs['enhancement'] || '';

  const noTreatmentTerms = ['untreated', 'no treatment', 'natural', 'unheated', 'no heat', 'none'];
  const heatTerms = ['heat', 'heated', 'heat only', 'heat treated'];
  const heavyTerms = ['filled', 'glass filled', 'lead glass', 'fracture filled', 'irradiated', 'diffused', 'coated'];

  const checkText = (treatmentSpec + ' ' + title).toLowerCase();

  for (const term of noTreatmentTerms) {
    if (checkText.includes(term)) return 'Not Enhanced';
  }

  for (const term of heavyTerms) {
    if (checkText.includes(term)) return 'Heavy Treatment';
  }

  for (const term of heatTerms) {
    if (checkText.includes(term)) return 'Heat Only';
  }

  return null;
}

function isNaturalStone(title: string, specs: Record<string, string> = {}): boolean {
  const checkText = (title + ' ' + (specs['natural/lab-created'] || '') + ' ' + (specs['creation method'] || '')).toLowerCase();

  for (const term of LAB_CREATED_TERMS) {
    if (checkText.includes(term)) return false;
  }

  if (checkText.includes('natural') || checkText.includes('genuine')) {
    return true;
  }

  return true; // Default to natural if not specified
}

function parseStoneDetails(title: string, specs: Record<string, string> = {}, description: string = ''): any {
  const stoneType = detectStoneType(title, specs);

  return {
    stone_type: stoneType,
    shape: extractStoneShape(title, specs),
    carat: extractCaratWeight(title, specs, description),
    color: extractStoneColor(title, specs, stoneType),
    clarity: extractStoneClarity(title, specs, stoneType),
    certification: extractCertification(title, specs),
    treatment: extractTreatment(title, specs),
    is_natural: isNaturalStone(title, specs),
  };
}

// ============================================
// Gemstone Blacklist & Filtering
// ============================================

function passesGemstoneBlacklist(title: string, specs: Record<string, string> = {}, filters: any = {}): { blocked: boolean; reason: string | null } {
  const titleLower = title.toLowerCase();
  const allowLabCreated = filters.allow_lab_created || false;

  // Check item specifics for simulant indicators
  const stoneSpec = (specs['type'] || specs['stone type'] || specs['gemstone'] || '').toLowerCase();
  const creationSpec = (specs['creation method'] || specs['natural/lab-created'] || '').toLowerCase();

  const simulantTerms = ['cubic zirconia', 'cz', 'moissanite', 'simulant', 'simulated', 'fake', 'imitation'];
  for (const term of simulantTerms) {
    if (stoneSpec.includes(term) || creationSpec.includes(term)) {
      return { blocked: true, reason: `Simulant in specs: "${term}"` };
    }
  }

  // Check title against blacklist
  for (const term of GEMSTONE_BLACKLIST) {
    // Skip lab-created terms if allowed
    if (allowLabCreated && LAB_CREATED_TERMS.includes(term)) {
      continue;
    }

    // For short terms like "cz", require word boundaries
    if (term.length <= 3) {
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(title)) {
        return { blocked: true, reason: `Blacklisted term: "${term}"` };
      }
    } else {
      if (titleLower.includes(term.toLowerCase())) {
        return { blocked: true, reason: `Blacklisted term: "${term}"` };
      }
    }
  }

  // Check for lab-created if not allowed
  if (!allowLabCreated) {
    for (const term of LAB_CREATED_TERMS) {
      if (titleLower.includes(term)) {
        return { blocked: true, reason: `Lab-created: "${term}"` };
      }
    }
  }

  return { blocked: false, reason: null };
}

function passesGemstoneFilters(stone: any, filters: any = {}): { passes: boolean; reason: string | null } {
  // Carat range filter
  if (filters.carat_min !== undefined && stone.carat !== null) {
    if (stone.carat < filters.carat_min) {
      return { passes: false, reason: `Carat ${stone.carat} below min ${filters.carat_min}` };
    }
  }
  if (filters.carat_max !== undefined && stone.carat !== null) {
    if (stone.carat > filters.carat_max) {
      return { passes: false, reason: `Carat ${stone.carat} above max ${filters.carat_max}` };
    }
  }

  return { passes: true, reason: null };
}

// ============================================
// Gemstone Scoring Functions
// ============================================

function calculateSellerQuality(seller: any): number {
  if (!seller) return 0;

  let score = 0;
  const feedback = seller.feedbackScore || 0;
  const percentage = seller.feedbackPercentage ? parseFloat(seller.feedbackPercentage) : 0;

  if (feedback >= 10000) score += 8;
  else if (feedback >= 5000) score += 7;
  else if (feedback >= 1000) score += 6;
  else if (feedback >= 500) score += 5;
  else if (feedback >= 100) score += 4;
  else if (feedback >= 50) score += 3;
  else if (feedback >= 10) score += 2;
  else if (feedback > 0) score += 1;

  if (percentage >= 100) score += 7;
  else if (percentage >= 99.5) score += 6;
  else if (percentage >= 99) score += 5;
  else if (percentage >= 98) score += 4;
  else if (percentage >= 97) score += 3;
  else if (percentage >= 95) score += 2;
  else if (percentage >= 90) score += 1;

  return score;
}

function calculateFormatScore(buyingOptions: string[] = []): number {
  if (!buyingOptions || !Array.isArray(buyingOptions)) {
    buyingOptions = [];
  }

  const options = buyingOptions.map(o => o.toUpperCase());

  if (options.includes('BEST_OFFER')) return 10;
  if (options.includes('FIXED_PRICE')) return 7;
  if (options.includes('AUCTION')) return 5;

  return 3;
}

function calculateCertBonus(certification: string | null): number {
  if (!certification) return 0;

  const certUpper = certification.toUpperCase();

  if (CERT_LABS.premium.some(lab => certUpper.includes(lab))) return 15;
  if (CERT_LABS.standard.some(lab => certUpper.includes(lab))) return 10;
  if (CERT_LABS.budget.some(lab => certUpper.includes(lab))) return 5;
  if (certUpper.includes('CERTIFIED') || certUpper.includes('CERT')) return 3;

  return 0;
}

function calculateMatchQuality(stone: any, filters: any = {}): number {
  let score = 0;
  let maxScore = 0;

  if (filters.stone_types && filters.stone_types.length > 0) {
    maxScore += 5;
    if (stone.stone_type && filters.stone_types.includes(stone.stone_type)) {
      score += 5;
    }
  }

  if (filters.shapes && filters.shapes.length > 0) {
    maxScore += 5;
    if (stone.shape && filters.shapes.includes(stone.shape)) {
      score += 5;
    }
  }

  if (filters.carat_min !== undefined || filters.carat_max !== undefined) {
    maxScore += 5;
    if (stone.carat !== null) {
      const inMin = filters.carat_min === undefined || stone.carat >= filters.carat_min;
      const inMax = filters.carat_max === undefined || stone.carat <= filters.carat_max;
      if (inMin && inMax) score += 5;
    }
  }

  if (maxScore === 0) {
    if (stone.stone_type) score += 5;
    if (stone.shape) score += 5;
    if (stone.carat) score += 5;
    if (stone.color) score += 5;
    if (stone.clarity) score += 5;
    return Math.min(25, score);
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 25) : 25;
}

function calculateDealScore(stone: any, listing: any, filters: any = {}): number {
  let score = 0;

  score += calculateMatchQuality(stone, filters);
  score += calculateSellerQuality(listing.seller);
  score += calculateFormatScore(listing.buyingOptions);
  score += calculateCertBonus(stone.certification);

  let detailBonus = 0;
  if (stone.carat) detailBonus += 2;
  if (stone.color) detailBonus += 2;
  if (stone.clarity) detailBonus += 2;
  if (stone.shape) detailBonus += 2;
  if (stone.treatment) detailBonus += 2;
  score += Math.min(10, detailBonus);

  if (stone.is_natural) score += 5;
  if (stone.treatment === 'Not Enhanced' && stone.stone_type !== 'Diamond') score += 5;

  score = Math.round((score / 85) * 100);
  return Math.min(100, Math.max(0, score));
}

function calculateRiskScore(stone: any, listing: any): number {
  let risk = 0;

  const title = listing.title || '';
  const titleLower = title.toLowerCase();
  const seller = listing.seller || {};

  const syntheticFlags = ['lab', 'synthetic', 'created', 'cvd', 'hpht', 'simulant'];
  for (const flag of syntheticFlags) {
    if (titleLower.includes(flag)) {
      risk += 30;
      break;
    }
  }

  const returnPolicy = listing.returnTerms || listing.returnPolicy || {};
  const returnsAccepted = returnPolicy.returnsAccepted !== false;
  if (!returnsAccepted) risk += 20;

  let missingCount = 0;
  if (!stone.carat) missingCount++;
  if (!stone.color) missingCount++;
  if (!stone.clarity) missingCount++;
  if (!stone.stone_type) missingCount++;
  risk += missingCount * 5;

  const heavyTreatments = ['filled', 'glass', 'lead', 'fracture', 'diffused', 'coated'];
  for (const treatment of heavyTreatments) {
    if (titleLower.includes(treatment)) {
      risk += 15;
      break;
    }
  }

  const feedback = seller.feedbackScore || 0;
  const percentage = seller.feedbackPercentage ? parseFloat(seller.feedbackPercentage) : 100;
  if (feedback < 50) risk += 10;
  else if (feedback < 100) risk += 5;
  if (percentage < 98) risk += 5;

  const vagueTerms = ['estate', 'not sure', 'i think', 'possibly', 'maybe', 'as is', 'no guarantee'];
  for (const term of vagueTerms) {
    if (titleLower.includes(term)) {
      risk += 10;
      break;
    }
  }

  if (stone.carat && stone.carat >= 1) {
    const price = listing.price?.value || listing.price || 0;
    const pricePerCarat = price / stone.carat;
    if (stone.is_natural && pricePerCarat < 50) risk += 10;
  }

  return Math.min(100, risk);
}

// ============================================
// Jewelry Parsing Functions
// ============================================

function extractKarat(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
  // Check specs first - eBay uses various field names for metal purity
  const purityFieldNames = ['metal purity', 'purity', 'karat', 'gold purity', 'fineness'];
  for (const field of purityFieldNames) {
    const value = specs[field];
    if (value) {
      const karatMatch = value.match(/(\d+)\s*[kK]/);
      if (karatMatch) {
        const karat = parseInt(karatMatch[1]);
        if ([8, 9, 10, 14, 18, 22, 24].includes(karat)) return karat;
      }
    }
  }

  // Check title
  const patterns = [
    /(\d+)\s*[kK](?:arat|t)?(?:\s|$|[^a-zA-Z])/,
    /(\d+)\s*(?:karat|kt)/i,
    /\b(10|14|18|22|24)[kK]\b/,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const karat = parseInt(match[1]);
      if ([8, 9, 10, 14, 18, 22, 24].includes(karat)) return karat;
    }
  }

  // Check description (strip HTML first)
  if (description) {
    const cleanDesc = description
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n)))
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // Look for karat patterns in description
    const descPatterns = [
      /(\d+)\s*[kK](?:arat|t)?(?:\s|gold|\b)/i,
      /\b(9|10|14|18|22|24)\s*karat\b/i,
      /\b(9|10|14|18|22|24)k\s*gold\b/i,
    ];

    for (const pattern of descPatterns) {
      const match = cleanDesc.match(pattern);
      if (match) {
        const karat = parseInt(match[1]);
        if ([8, 9, 10, 14, 18, 22, 24].includes(karat)) {
          console.log(`    📏 Found karat ${karat}K in description`);
          return karat;
        }
      }
    }
  }

  return null;
}

function extractWeight(title: string, specs: Record<string, string> = {}, description: string = ''): number | null {
  // Check item specifics first - eBay uses many different field names
  // NOTE: 'total carat weight' removed - eBay uses it for karat purity (14K, 18K), not gram weight
  const weightFieldNames = [
    'total weight', 'gram weight', 'total gram weight', 'metal weight(grams)',
    'item weight', 'weight', 'item weight (approx.)',
    'approximate weight', 'metal weight', 'metal weight gram', 'chain weight', 'necklace weight',
    'ring weight', 'bracelet weight', 'gold weight', 'total metal weight',
    'net weight', 'jewelry weight', 'metal wt.', 'metal wt', 'gross weight',
    'platinum weight', 'silver weight', 'weight (approx.)', 'approx. weight'
  ];

  let weightSpec = '';
  for (const field of weightFieldNames) {
    if (specs[field]) {
      weightSpec = specs[field];
      break;
    }
  }

  if (weightSpec) {
    const specLower = weightSpec.toLowerCase();

    // Try grams - require unit to avoid matching bare karat numbers like "14" from "Total Carat Weight: 14"
    const gramMatch = specLower.match(/([\d.]+)\s*(?:g|gr|gm|gms|gram|grams)\b/i);
    if (gramMatch) {
      const value = parseFloat(gramMatch[1]);
      if (!specLower.includes('oz') && !specLower.includes('dwt') && !specLower.includes('ct')) {
        return value;
      }
    }

    // Try oz (1 oz = 28.3495g)
    const ozMatch = specLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)/i);
    if (ozMatch) {
      return parseFloat(ozMatch[1]) * 28.3495;
    }

    // Try dwt (1 dwt = 1.555g)
    const dwtMatch = specLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
    if (dwtMatch) {
      return parseFloat(dwtMatch[1]) * 1.555;
    }
  }

  // Check title
  const titleLower = title.toLowerCase();

  // Match patterns like "5g", "5.5g", "10 grams", "0.74gm" - the unit is required so "14K" won't match
  let gramMatch = titleLower.match(/([\d.]+)\s*(?:g|gm|gr|gram|grams)\b/i);
  if (gramMatch) return parseFloat(gramMatch[1]);

  let ozMatch = titleLower.match(/([\d.]+)\s*(?:oz|ounce|ounces)\b/i);
  if (ozMatch) return parseFloat(ozMatch[1]) * 28.3495;

  let dwtMatch = titleLower.match(/([\d.]+)\s*(?:dwt|pennyweight)/i);
  if (dwtMatch) return parseFloat(dwtMatch[1]) * 1.555;

  // Check description (strip HTML first)
  if (description) {
    const cleanDesc = description
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n)))
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // Weight patterns in description
    const weightPatterns = [
      /(?:weight|weighs|wt)[:\s\-]+([\d.]+)\s*(?:g|gm|gr|gram|grams)\b/i,  // handles "Weight - .53 grams"
      /([\d.]+)\s*(?:g|gm|gr|gram|grams)\s*(?:total|weight)/i,
      /(?:total|approx\.?|approximately)\s*([\d.]+)\s*(?:g|gm|gr|gram|grams)\b/i,
      /([\d.]+)\s*(?:g|gm|gr|gram|grams)\b/i,
    ];

    for (const pattern of weightPatterns) {
      const match = cleanDesc.match(pattern);
      if (match) {
        let rawValue = match[1];
        // Fix common seller typo: ".1.08" should be "1.08" (errant leading period)
        if (rawValue.startsWith('.') && (rawValue.match(/\./g) || []).length > 1) {
          rawValue = rawValue.substring(1); // Remove the leading period
          console.log(`    🔧 Fixed typo: .${rawValue} → ${rawValue}`);
        }
        const value = parseFloat(rawValue);
        if (value > 0 && value < 1000) {
          console.log(`    📏 Found weight ${value}g in description`);
          return value;
        }
      }
    }

    // Check for oz in description
    ozMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*([\d.]+)\s*(?:oz|ounce|ounces)\b/i);
    if (ozMatch) {
      const value = parseFloat(ozMatch[1]) * 28.3495;
      console.log(`    📏 Found weight ${ozMatch[1]}oz (${value.toFixed(2)}g) in description`);
      return value;
    }

    // Check for dwt in description
    dwtMatch = cleanDesc.match(/(?:weight|weighs|wt)?[:\s]*([\d.]+)\s*(?:dwt|penny\s*weight)/i);
    if (dwtMatch) {
      const value = parseFloat(dwtMatch[1]) * 1.555;
      console.log(`    📏 Found weight ${dwtMatch[1]}dwt (${value.toFixed(2)}g) in description`);
      return value;
    }
  }

  return null;
}

// ============================================
// Token & API Functions
// ============================================

let cachedToken: { token: string; expiresAt: number; keyLabel: string } | null = null;

// Rate limit cooldown period (60 seconds)
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes - eBay needs time to reset

// Invalidate cached token and mark key as rate-limited (called when we get a 429)
const invalidateCachedToken = async () => {
  if (cachedToken) {
    const keyLabel = cachedToken.keyLabel;
    console.log(`🔄 Invalidating cached token from key "${keyLabel}" due to rate limit`);

    // Mark the key as rate-limited in the database with a timestamp
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('value_json')
        .eq('key', 'ebay_keys')
        .single();

      if (settings?.value_json) {
        const config = settings.value_json as { keys: any[] };
        const updatedKeys = config.keys.map((k: any) => {
          if (k.label === keyLabel) {
            console.log(`⚠️ Marking key "${keyLabel}" as rate_limited for ${RATE_LIMIT_COOLDOWN_MS / 1000}s`);
            return {
              ...k,
              status: 'rate_limited',
              rate_limited_at: new Date().toISOString()
            };
          }
          return k;
        });

        await supabase
          .from('settings')
          .update({ value_json: { ...config, keys: updatedKeys } })
          .eq('key', 'ebay_keys');
      }
    } catch (error) {
      console.error('Failed to update key status:', error);
    }

    cachedToken = null;
  }
};

const getEbayToken = async (): Promise<string | null> => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('value_json')
      .eq('key', 'ebay_keys')
      .single();

    if (error || !settings?.value_json) {
      console.error('❌ No eBay API keys configured');
      return null;
    }

    const config = settings.value_json as { keys: any[], rotation_strategy?: string };
    const now = Date.now();
    let keysUpdated = false;

    // Auto-reset rate_limited keys after cooldown period
    const keysWithReset = config.keys.map((k: any) => {
      if (k.status === 'rate_limited' && k.rate_limited_at) {
        const rateLimitedTime = new Date(k.rate_limited_at).getTime();
        if (now - rateLimitedTime > RATE_LIMIT_COOLDOWN_MS) {
          console.log(`✅ Key "${k.label}" cooldown expired, resetting to active`);
          keysUpdated = true;
          return { ...k, status: 'active', rate_limited_at: null };
        }
      }
      return k;
    });

    // Update database if any keys were reset
    if (keysUpdated) {
      await supabase
        .from('settings')
        .update({ value_json: { ...config, keys: keysWithReset } })
        .eq('key', 'ebay_keys');
    }

    // Filter available keys (not rate_limited, not error)
    const availableKeys = keysWithReset.filter((k: any) => k.status !== 'rate_limited' && k.status !== 'error');

    // Select key based on rotation strategy
    let keyToUse: any;
    if (availableKeys.length === 0) {
      // All keys rate limited - use the one that was rate limited longest ago
      const sortedByRateLimitTime = [...keysWithReset].sort((a: any, b: any) => {
        const timeA = a.rate_limited_at ? new Date(a.rate_limited_at).getTime() : 0;
        const timeB = b.rate_limited_at ? new Date(b.rate_limited_at).getTime() : 0;
        return timeA - timeB; // Oldest first
      });
      keyToUse = sortedByRateLimitTime[0];
      console.log(`⚠️ All keys rate limited, using oldest: "${keyToUse?.label}"`);
    } else if (config.rotation_strategy === 'least_used') {
      // Sort by calls_today ascending (least used first)
      const sortedByUsage = [...availableKeys].sort((a: any, b: any) => {
        return (a.calls_today || 0) - (b.calls_today || 0);
      });
      keyToUse = sortedByUsage[0];
    } else {
      // Default: round-robin (use least recently used)
      const sortedByLastUsed = [...availableKeys].sort((a: any, b: any) => {
        const timeA = a.last_used ? new Date(a.last_used).getTime() : 0;
        const timeB = b.last_used ? new Date(b.last_used).getTime() : 0;
        return timeA - timeB; // Oldest first
      });
      keyToUse = sortedByLastUsed[0];
    }

    if (!keyToUse) {
      console.error('❌ No eBay API keys available');
      return null;
    }

    const credentials = btoa(`${keyToUse.app_id}:${keyToUse.cert_id}`);
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to get eBay OAuth token:', response.status);
      console.error('   Error details:', errorText);
      console.error('   App ID used:', keyToUse.app_id?.substring(0, 20) + '...');
      return null;
    }

    const tokenData: any = await response.json();
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000) - 60000,
      keyLabel: keyToUse.label || 'unknown'
    };
    console.log(`🔑 Got new OAuth token from key "${cachedToken.keyLabel}"`);

    return cachedToken.token;
  } catch (error) {
    console.error('❌ Error getting eBay token:', error);
    return null;
  }
};

const fetchItemDetails = async (itemId: string, token: string, includeShipping: boolean = true, retryCount: number = 0): Promise<any | null> => {
  // Check cache first (skip if we need shipping since cache doesn't store it)
  const cached = await getCachedItemDetails(itemId, includeShipping);
  if (cached) {
    return cached;
  }

  try {
    const url = `https://api.ebay.com/buy/browse/v1/item/${itemId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=US,zip=10001',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Handle rate limiting - invalidate token and retry once with a new token
      if (response.status === 429 && retryCount === 0) {
        console.log(`⚠️ Rate limited (429) fetching ${itemId}, switching API key...`);
        await invalidateCachedToken();
        const newToken = await getEbayToken();
        if (newToken) {
          return fetchItemDetails(itemId, newToken, includeShipping, retryCount + 1);
        }
      }
      console.log(`⚠️ Failed to fetch details for ${itemId}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Cache the result for 24 hours
    await cacheItemDetails(itemId, data);

    return data;
  } catch (error) {
    console.error(`❌ Error fetching item details for ${itemId}:`, error);
    return null;
  }
};

const extractItemSpecifics = (itemDetails: any): Record<string, string> => {
  if (!itemDetails?.localizedAspects) return {};

  const specs: Record<string, string> = {};
  for (const aspect of itemDetails.localizedAspects) {
    specs[aspect.name.toLowerCase()] = aspect.value;
  }
  return specs;
};

/**
 * Extract shipping cost from eBay API item details
 * Handles multiple API response formats
 */
const extractShippingCostFromDetails = (itemDetails: any): { cost: number; type: string } => {
  // Default: no shipping info found
  let cost = 0;
  let type = 'unknown';

  // Try shippingOptions array first (most common)
  if (itemDetails?.shippingOptions && itemDetails.shippingOptions.length > 0) {
    const option = itemDetails.shippingOptions[0];

    // Format 1: shippingCost.value (standard format)
    if (option.shippingCost?.value !== undefined) {
      cost = parseFloat(option.shippingCost.value) || 0;
      type = cost === 0 ? 'free' : 'fixed';
      return { cost, type };
    }

    // Format 2: shippingServiceCost.value (alternate format)
    if (option.shippingServiceCost?.value !== undefined) {
      cost = parseFloat(option.shippingServiceCost.value) || 0;
      type = cost === 0 ? 'free' : 'fixed';
      return { cost, type };
    }

    // Format 3: Check for FREE shipping indicators
    if (option.shippingCostType === 'FREE' ||
        option.type === 'FREE' ||
        option.shippingType === 'FREE') {
      return { cost: 0, type: 'free' };
    }

    // Format 4: CALCULATED shipping
    if (option.shippingCostType === 'CALCULATED' || option.type === 'CALCULATED') {
      type = 'calculated';
      // Try to get estimated cost if available
      if (option.estimatedShippingCost?.value !== undefined) {
        cost = parseFloat(option.estimatedShippingCost.value) || 0;
      }
      return { cost, type };
    }

    // Format 5: FIXED_OR_CALCULATED - try to extract cost
    if (option.shippingCostType === 'FIXED_OR_CALCULATED') {
      type = 'calculated';
      if (option.shippingCost?.value !== undefined) {
        cost = parseFloat(option.shippingCost.value) || 0;
        type = 'fixed';
      }
      return { cost, type };
    }

    // Log unknown format for debugging
    console.log(`  ⚠️ Unknown shipping format: ${JSON.stringify(option).substring(0, 300)}`);
  }

  // Try direct shippingCost on item (some API versions)
  if (itemDetails?.shippingCost?.value !== undefined) {
    cost = parseFloat(itemDetails.shippingCost.value) || 0;
    type = cost === 0 ? 'free' : 'fixed';
    return { cost, type };
  }

  // Try shipToLocations format (indicates calculated shipping)
  if (itemDetails?.shipToLocations?.regionIncluded) {
    type = 'calculated';
  }

  return { cost, type };
};

// ============================================
// Task Interfaces
// ============================================

interface Task {
  id: string;
  user_id: string;
  name: string;
  item_type: 'watch' | 'jewelry' | 'gemstone';
  status: 'active' | 'paused' | 'stopped';
  min_price?: number;
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
  min_profit_margin?: number;
  last_run?: string;
  slack_channel?: string;
  slack_channel_id?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Search & Processing Functions
// ============================================

// Expand metal types to include karat variations
// "18K Gold" without a color = yellow gold, so add these variations for Yellow Gold
const expandMetalSearchTerms = (metals: string[]): string[] => {
  const expanded: string[] = [];

  for (const metal of metals) {
    expanded.push(metal); // Always include the original

    // For Yellow Gold, add karat-only variations (18K Gold, 14K Gold, etc.)
    // These are typically yellow gold when no color is specified
    if (metal.toLowerCase() === 'yellow gold') {
      expanded.push('18K Gold');
      expanded.push('14K Gold');
      expanded.push('10K Gold');
      expanded.push('24K Gold');
      expanded.push('18kt Gold');
      expanded.push('14kt Gold');
      expanded.push('10kt Gold');
    }
  }

  return expanded;
};

const buildSearchKeywords = (task: Task, metalOverride: string | null = null): string => {
  let keywords = '';
  let exclusionKeywords: string[] = [];

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
      // Always include "jewelry" to avoid random unrelated items (paint, phone cases, etc.)
      const metalToSearch = metalOverride || (task.jewelry_filters?.metal?.length > 0 ? task.jewelry_filters.metal[0] : 'gold');
      keywords = `${metalToSearch} jewelry`;
      if (task.jewelry_filters?.categories?.length > 0) {
        keywords += ` ${task.jewelry_filters.categories[0]}`;
      }
      if (task.jewelry_filters?.keywords) {
        keywords += ` ${task.jewelry_filters.keywords}`;
      }

      // Get metal exclusion keywords for jewelry searches
      if (task.jewelry_filters?.metal?.length > 0) {
        exclusionKeywords = getMetalExclusionKeywords(task.jewelry_filters.metal);
        if (exclusionKeywords.length > 0) {
          console.log(`🚫 Auto-excluding metals: ${exclusionKeywords.slice(0, 5).join(', ')}${exclusionKeywords.length > 5 ? '...' : ''}`);
        }
      }
      break;
    case 'gemstone':
      keywords = 'loose gemstone natural';
      if (task.gemstone_filters?.stone_types?.length > 0) {
        keywords = `${task.gemstone_filters.stone_types[0]} loose natural`;
      }
      if (task.gemstone_filters?.keywords) {
        keywords += ` ${task.gemstone_filters.keywords}`;
      }
      break;
  }

  // Append exclusion keywords as negative search terms (eBay supports -keyword syntax)
  if (exclusionKeywords.length > 0) {
    // Limit to top 10 exclusions to avoid query length issues
    const limitedExclusions = exclusionKeywords.slice(0, 10);
    const exclusionString = limitedExclusions.map(kw => `-"${kw}"`).join(' ');
    keywords += ` ${exclusionString}`;
  }

  return keywords || task.name.toLowerCase();
};

const getConditionsFromFilters = (task: Task): string[] => {
  const conditions: string[] = [];

  switch (task.item_type) {
    case 'jewelry':
      if (task.jewelry_filters?.conditions) {
        conditions.push(...task.jewelry_filters.conditions);
      }
      break;
    case 'watch':
      if (task.watch_filters?.conditions) {
        conditions.push(...task.watch_filters.conditions);
      }
      break;
    case 'gemstone':
      if (task.gemstone_filters?.conditions) {
        conditions.push(...task.gemstone_filters.conditions);
      }
      break;
  }

  return conditions;
};

const shouldExcludeItem = (task: Task, item: any): { exclude: boolean; reason?: string } => {
  if (task.exclude_keywords && task.exclude_keywords.length > 0) {
    const titleLower = item.title.toLowerCase();
    const hasExcludedKeyword = task.exclude_keywords.some((keyword: string) =>
      titleLower.includes(keyword.toLowerCase())
    );
    if (hasExcludedKeyword) {
      return { exclude: true, reason: 'Contains excluded keyword' };
    }
  }

  return { exclude: false };
};

const getMatchTableName = (itemType: string): string => {
  return `matches_${itemType}`;
};

const createMatchRecord = (task: Task, item: any, stone?: any, dealScore?: number, riskScore?: number) => {
  const baseMatch = {
    task_id: task.id,
    user_id: task.user_id,
    ebay_listing_id: item.itemId,
    ebay_title: item.title,
    ebay_url: item.listingUrl,
    listed_price: item.price,
    shipping_cost: item.shippingCost ?? null, // null = unknown, 0 = free, >0 = actual cost
    currency: item.currency || 'USD',
    buy_format: item.listingType || 'Unknown',
    seller_feedback: item.sellerInfo?.feedbackScore || 0,
    found_at: new Date().toISOString(),
    item_creation_date: item.itemCreationDate || null, // When item was listed on eBay (for latency tracking)
    status: 'new' as const,
    notification_sent: false, // Track if Slack notification was sent
  };

  switch (task.item_type) {
    case 'gemstone':
      return {
        ...baseMatch,
        stone_type: stone?.stone_type || null,
        shape: stone?.shape || null,
        carat: stone?.carat || null,
        colour: stone?.color || null,
        clarity: stone?.clarity || null,
        cert_lab: stone?.certification || null,
        treatment: stone?.treatment || null,
        is_natural: stone?.is_natural ?? true,
        deal_score: dealScore || null,
        risk_score: riskScore || null,
      };

    case 'jewelry':
      return {
        ...baseMatch,
        karat: item.karat || null,
        weight_g: item.weight_g || null,
        metal_type: item.metalType || 'Unknown',
        melt_value: item.meltValue || null,
        profit_scrap: item.profitScrap || null,
        break_even: item.breakEven || null,
        suggested_offer: item.suggestedOffer || null,
      };

    case 'watch':
      return {
        ...baseMatch,
        case_material: item.caseMaterial || null,
        band_material: item.bandMaterial || null,
        movement: item.movement || null,
        dial_color: item.dialColor || null,
        year: item.year || null,
        brand: item.brand || null,
        model: item.model || null,
      };

    default:
      return baseMatch;
  }
};

// ============================================
// Main Task Processing
// ============================================

interface TaskStats {
  itemsFound: number;
  newMatches: number;
  excludedItems: number;
}

const processTask = async (task: Task): Promise<TaskStats> => {
  console.log(`🔄 Processing task: ${task.name} (${task.id}) - Type: ${task.item_type}`);

  // Ensure task has a Slack channel (creates one if needed)
  await ensureTaskSlackChannel(task);

  try {
    const lastRunDate = task.last_run ? new Date(task.last_run) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateFrom = lastRunDate.toISOString();

    // Get pagination offset for this task
    const paginationOffset = getTaskPaginationOffset(task.id);
    if (paginationOffset > 0) {
      console.log(`📄 Pagination: Using offset ${paginationOffset} (page ${paginationOffset / 200 + 1})`);
    }

    // Build search parameters
    const searchParams = {
      keywords: buildSearchKeywords(task),
      maxPrice: task.max_price,
      minPrice: task.min_price,
      listingType: task.listing_format || ['Auction', 'Fixed Price (BIN)'],
      minFeedback: task.min_seller_feedback || 0,
      itemLocation: task.item_location,
      dateFrom: dateFrom,
      dateTo: task.date_to,
      itemType: task.item_type,
      typeSpecificFilters: task.item_type === 'watch' ? task.watch_filters :
                          task.item_type === 'jewelry' ? task.jewelry_filters :
                          task.item_type === 'gemstone' ? task.gemstone_filters : null,
      condition: getConditionsFromFilters(task),
      // Add category filtering for gemstones and jewelry
      categoryIds: task.item_type === 'gemstone' ? GEMSTONE_CATEGORY_IDS.join(',') :
                   task.item_type === 'jewelry' ? JEWELRY_CATEGORY_IDS.join(',') : undefined,
      // Pagination offset
      offset: paginationOffset,
    };

    // Check if jewelry task has multiple metals - need to search for each
    const basemetals = task.item_type === 'jewelry' ? (task.jewelry_filters?.metal || []) : [];
    // Expand metals to include karat variations (e.g., "Yellow Gold" -> "Yellow Gold", "18K Gold", "14K Gold", etc.)
    const metals = task.item_type === 'jewelry' ? expandMetalSearchTerms(basemetals) : basemetals;
    const needsMultiMetalSearch = task.item_type === 'jewelry' && metals.length > 1;

    let items: any[] = [];

    if (needsMultiMetalSearch) {
      // Run separate search for each metal type and combine results
      console.log(`🔧 Searching for ${metals.length} search terms (from ${basemetals.length} metals): ${metals.join(', ')}`);
      const seenItemIds = new Set<string>();

      for (let i = 0; i < metals.length; i++) {
        const metal = metals[i];
        const metalSearchParams = {
          ...searchParams,
          keywords: buildSearchKeywords(task, metal),
        };

        console.log(`🎯 Search [${metal}]: ${metalSearchParams.keywords}`);

        const searchResponse = await supabase.functions.invoke('ebay-search', {
          body: metalSearchParams
        });

        if (searchResponse.error) {
          console.error(`❌ Error searching for ${metal}:`, searchResponse.error);
          // Add delay even on error to avoid hammering rate-limited API
          if (i < metals.length - 1) {
            console.log(`⏳ Waiting 5s before next search (after error)...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          continue;
        }

        const metalItems = searchResponse.data?.items || [];
        console.log(`  📦 Found ${metalItems.length} items for ${metal}`);

        // Deduplicate - only add items we haven't seen
        for (const item of metalItems) {
          if (!seenItemIds.has(item.itemId)) {
            seenItemIds.add(item.itemId);
            items.push(item);
          }
        }

        // Add delay between searches to avoid eBay rate limits
        if (i < metals.length - 1) {
          console.log(`⏳ Waiting 5s before next search...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      console.log(`📦 Total unique items across all metals: ${items.length}`);
    } else {
      // Single search (non-jewelry or single metal)
      console.log(`🎯 Search: ${searchParams.keywords}`);

      const searchResponse = await supabase.functions.invoke('ebay-search', {
        body: searchParams
      });

      if (searchResponse.error) {
        console.error('❌ Error calling eBay search:', searchResponse.error);
        return;
      }

      items = searchResponse.data?.items || [];
      console.log(`📦 Found ${items.length} items`);
    }

    // Advance pagination for next poll cycle
    advanceTaskPagination(task.id, items.length);

    if (!items || items.length === 0) {
      console.log(`📭 No new items found for task ${task.name}`);
      await supabase.from('tasks').update({ last_run: new Date().toISOString() }).eq('id', task.id);
      return { itemsFound: 0, newMatches: 0, excludedItems: 0 };
    }

    // DEBUG: Log shipping data for first 5 items to diagnose shipping issues
    console.log(`📦 SHIPPING DEBUG - First 5 items from edge function:`);
    for (let i = 0; i < Math.min(5, items.length); i++) {
      const item = items[i];
      console.log(`  ${item.itemId}: $${item.price} + ship=${item.shippingCost} (${item.shippingType})`);
    }

    const itemsFound = items.length;

    const tableName = getMatchTableName(task.item_type);
    let newMatches = 0;
    let excludedItems = 0;
    let skippedRejected = 0;
    let cacheHits = 0;
    const token = await getEbayToken();

    // Pre-fetch rejected item IDs to skip them (saves API calls)
    const rejectedItemIds = await getRejectedItemIds(task.id);
    if (rejectedItemIds.size > 0) {
      console.log(`📋 Loaded ${rejectedItemIds.size} previously rejected items to skip`);
    }

    for (const item of items) {
      // Check for test listing (from our test seller) - bypass all filters
      const sellerName = item.sellerInfo?.name?.toLowerCase() || '';
      const isTestListing = sellerName === TEST_SELLER_USERNAME.toLowerCase();

      if (isTestListing) {
        // Only notify once per test listing
        if (!notifiedTestListings.has(item.itemId)) {
          console.log(`🧪 TEST LISTING DETECTED from ${sellerName}: ${item.title.substring(0, 50)}...`);
          logTestListing(item, '🧪 TEST LISTING DETECTED - will process through normal flow');
          await sendTestListingNotification(item, task.slack_channel);
          notifiedTestListings.add(item.itemId);
        }
        // Don't continue - let it go through normal processing to add to matches
      }

      // Skip already rejected items (saves API calls) - but not test listings
      if (!isTestListing && rejectedItemIds.has(item.itemId)) {
        skippedRejected++;
        continue;
      }

      // Basic exclusion check - skip for test listings
      if (!isTestListing) {
        const exclusionCheck = shouldExcludeItem(task, item);
        if (exclusionCheck.exclude) {
          console.log(`🚫 Excluding: ${exclusionCheck.reason}`);
          await cacheRejectedItem(task.id, item.itemId, exclusionCheck.reason || 'Basic exclusion');
          excludedItems++;
          continue;
        }
      }

      // Condition filter - check if item matches selected conditions (skip for test listings)
      if (!isTestListing) {
        const selectedConditions = getConditionsFromFilters(task);
        if (selectedConditions.length > 0 && item.condition) {
          const itemCondition = item.condition.toLowerCase();
          const conditionsLower = selectedConditions.map((c: string) => c.toLowerCase());

          // Check if item condition matches any selected condition
          const conditionMatches = conditionsLower.some((selected: string) => {
            // Handle variations: "Pre-owned" matches "pre-owned", "Pre-Owned", etc.
            if (selected === 'pre-owned' && (itemCondition.includes('pre-owned') || itemCondition.includes('pre owned') || itemCondition === 'used')) {
              return true;
            }
            if (selected === 'new' && itemCondition === 'new') {
              return true;
            }
            return itemCondition.includes(selected);
          });

          if (!conditionMatches) {
            const reason = `Wrong condition "${item.condition}" (want: ${selectedConditions.join(', ')})`;
            console.log(`🚫 Excluding ${reason}: ${item.title.substring(0, 40)}...`);
            await cacheRejectedItem(task.id, item.itemId, reason);
            excludedItems++;
            continue;
          }
        }
      }

      // Early check for plated/filled/base metal items (common false positives) - skip for test listings
      if (!isTestListing && task.item_type === 'jewelry') {
        const titleLower = item.title.toLowerCase();
        // Check for plated/filled
        if (titleLower.includes('plated') || titleLower.includes('gold-plated') ||
            titleLower.includes('silver-plated') || titleLower.includes('filled') ||
            titleLower.includes('gold-filled') || titleLower.includes('vermeil') ||
            titleLower.includes('gold tone') || titleLower.includes('goldtone')) {
          const reason = 'Plated/filled/vermeil';
          console.log(`🚫 Excluding ${reason}: ${item.title.substring(0, 50)}...`);
          await cacheRejectedItem(task.id, item.itemId, reason);
          excludedItems++;
          continue;
        }
        // Check for base metals in title
        const baseMet = ['brass', 'bronze', 'copper', 'pewter', 'alloy', 'stainless', 'titanium', 'tungsten', 'nickel'];
        const foundBaseMetal = baseMet.find(m => titleLower.includes(m));
        if (foundBaseMetal) {
          const reason = `Base metal "${foundBaseMetal}"`;
          console.log(`🚫 Excluding ${reason}: ${item.title.substring(0, 50)}...`);
          await cacheRejectedItem(task.id, item.itemId, reason);
          excludedItems++;
          continue;
        }

        // Check if silver is NOT selected but item contains silver
        const selectedMetals = task.jewelry_filters?.metal || [];
        const selectedMetalsLower = selectedMetals.map((m: string) => m.toLowerCase());
        const silverSelected = selectedMetalsLower.some((m: string) => m.includes('silver'));

        if (!silverSelected && (titleLower.includes('sterling silver') ||
            titleLower.includes('925 silver') || titleLower.includes('.925') ||
            (titleLower.includes('silver') && !titleLower.includes('gold')))) {
          const reason = 'Silver (not selected)';
          console.log(`🚫 Excluding ${reason}: ${item.title.substring(0, 50)}...`);
          await cacheRejectedItem(task.id, item.itemId, reason);
          excludedItems++;
          continue;
        }
      }

      // Price filters - skip for test listings
      if (!isTestListing) {
        if (task.min_price && item.price < task.min_price) {
          const reason = `Below min price ($${item.price} < $${task.min_price})`;
          await cacheRejectedItem(task.id, item.itemId, reason);
          excludedItems++;
          continue;
        }
        if (task.max_price && item.price > task.max_price) {
          const reason = `Above max price ($${item.price} > $${task.max_price})`;
          await cacheRejectedItem(task.id, item.itemId, reason);
          excludedItems++;
          continue;
        }
      }

      // Seller feedback filter - skip for test listings
      if (!isTestListing && task.min_seller_feedback && task.min_seller_feedback > 0) {
        const sellerFeedback = item.sellerInfo?.feedbackScore || 0;
        if (sellerFeedback < task.min_seller_feedback) {
          const reason = `Low seller feedback (${sellerFeedback} < ${task.min_seller_feedback})`;
          console.log(`  🚫 Excluding ${reason}: ${item.title.substring(0, 40)}...`);
          await cacheRejectedItem(task.id, item.itemId, reason);
          excludedItems++;
          continue;
        }
      }

      // Check for duplicates
      const { data: existingMatch } = await supabase
        .from(tableName)
        .select('id')
        .eq('ebay_listing_id', item.itemId)
        .eq('task_id', task.id)
        .single();

      if (existingMatch) {
        continue;
      }

      // Gemstone-specific processing
      if (task.item_type === 'gemstone') {
        const gemstoneFilters = task.gemstone_filters || {};

        // Use shipping from search results (more reliable than item details)
        if (item.shippingCost !== undefined && item.shippingCost > 0) {
          console.log(`  📦 Shipping: $${item.shippingCost} (${item.shippingType || 'from search'})`);
        } else if (item.shippingType === 'calculated') {
          console.log(`  📦 Shipping: Calculated (unknown cost)`);
        } else if (item.shippingType === 'free') {
          console.log(`  📦 Shipping: Free`);
        }

        // Check total cost (price + shipping) against max price
        const totalCostCheck = item.price + (item.shippingCost || 0);
        if (task.max_price && totalCostCheck > task.max_price) {
          console.log(`  🚫 Excluding: total cost $${totalCostCheck.toFixed(2)} > max $${task.max_price}: ${item.title.substring(0, 40)}...`);
          excludedItems++;
          continue;
        }

        // Fetch item details for specs
        let specs: Record<string, string> = {};
        let description = '';
        if (token) {
          const itemDetails = await fetchItemDetails(item.itemId, token);
          if (itemDetails) {
            specs = extractItemSpecifics(itemDetails);
            description = itemDetails.description || '';

            // Check category - reject if not a gemstone category
            const categoryId = itemDetails.categoryId || itemDetails.primaryCategory?.categoryId;
            if (categoryId && !GEMSTONE_CATEGORY_IDS.includes(String(categoryId)) &&
                !JEWELRY_CATEGORY_IDS.includes(String(categoryId))) {
              const reason = `Wrong category ${categoryId}`;
              console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
              await cacheRejectedItem(task.id, item.itemId, reason);
              excludedItems++;
              continue;
            }
          }
        }

        // Parse stone details
        const stone = parseStoneDetails(item.title, specs, description);

        // Check blacklist
        const blacklistCheck = passesGemstoneBlacklist(item.title, specs, gemstoneFilters);
        if (blacklistCheck.blocked) {
          console.log(`  ❌ REJECTED (${blacklistCheck.reason}): ${item.title.substring(0, 40)}...`);
          await cacheRejectedItem(task.id, item.itemId, blacklistCheck.reason || 'Blacklisted');
          excludedItems++;
          continue;
        }

        // Check filters (carat range, etc.)
        const filterCheck = passesGemstoneFilters(stone, gemstoneFilters);
        if (!filterCheck.passes) {
          console.log(`  ❌ REJECTED (${filterCheck.reason}): ${item.title.substring(0, 40)}...`);
          await cacheRejectedItem(task.id, item.itemId, filterCheck.reason || 'Failed filter check');
          excludedItems++;
          continue;
        }

        // Calculate scores
        const dealScore = calculateDealScore(stone, item, gemstoneFilters);
        const riskScore = calculateRiskScore(stone, item);

        // Create match record
        const matchData = createMatchRecord(task, item, stone, dealScore, riskScore);
        const { data: insertedMatch, error: insertError } = await supabase
          .from(tableName)
          .insert(matchData)
          .select('id')
          .single();

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          console.log(`✅ Match: ${stone.carat || '?'}ct ${stone.stone_type || 'Stone'} - $${item.price} (Deal: ${dealScore}, Risk: ${riskScore})`);
          newMatches++;

          // Send Slack notification for gemstone match
          console.log(`  📤 Sending Slack notification to channel: ${task.slack_channel || 'default'}...`);
          const slackResult = await sendGemstoneSlackNotification(matchData, stone, dealScore, riskScore, task.slack_channel, item.itemCreationDate);

          // Update notification_sent flag and Slack message tracking
          if (slackResult.sent && insertedMatch?.id) {
            const updateData: any = { notification_sent: true };
            if (slackResult.ts) updateData.slack_message_ts = slackResult.ts;
            if (slackResult.channelId) updateData.slack_channel_id = slackResult.channelId;

            await supabase
              .from(tableName)
              .update(updateData)
              .eq('id', insertedMatch.id);
            console.log(`  ✅ Slack notification sent successfully (ts: ${slackResult.ts})`);
          } else {
            console.log(`  ❌ Slack notification FAILED for gemstone match ${insertedMatch?.id} - will retry later`);
          }

          // Rate limit delay for Slack (they silently drop messages if sent too fast)
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      }
      // Jewelry-specific processing
      else if (task.item_type === 'jewelry') {
        const jewelryFilters = task.jewelry_filters || {};
        let specs: Record<string, string> = {};
        let description = '';

        // Use shipping from search results (more reliable than item details)
        if (item.shippingCost !== undefined) {
          console.log(`  📦 Shipping: $${item.shippingCost} (${item.shippingType || 'from search'})`);
        } else if (item.shippingType === 'calculated') {
          console.log(`  📦 Shipping: Calculated (unknown cost)`);
        } else if (item.shippingType === 'free') {
          console.log(`  📦 Shipping: Free`);
        }

        // Check total cost (price + shipping) against max price - skip for test listings
        if (!isTestListing) {
          const totalCostCheck = item.price + (item.shippingCost || 0);
          if (task.max_price && totalCostCheck > task.max_price) {
            console.log(`  🚫 Excluding: total cost $${totalCostCheck.toFixed(2)} > max $${task.max_price}: ${item.title.substring(0, 40)}...`);
            excludedItems++;
            continue;
          }
        }

        if (token) {
          const fetchDetailsStart = Date.now();
          const itemDetails = await fetchItemDetails(item.itemId, token);
          const fetchDetailsTime = Date.now() - fetchDetailsStart;
          console.log(`  ⏱️ [TIMING] fetchItemDetails: ${fetchDetailsTime}ms ${itemDetails ? '(success)' : '(failed)'}`);
          if (itemDetails) {
            specs = extractItemSpecifics(itemDetails);
            description = itemDetails.description || '';

            // Check category - reject if in blacklist OR not in jewelry whitelist (skip for test listings)
            if (!isTestListing) {
              const categoryId = String(itemDetails.categoryId || itemDetails.primaryCategory?.categoryId || '');
              if (categoryId) {
                if (JEWELRY_BLACKLIST_CATEGORIES.includes(categoryId)) {
                  const reason = `Blacklisted category ${categoryId}`;
                  console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                  await cacheRejectedItem(task.id, item.itemId, reason);
                  excludedItems++;
                  continue;
                }
                // Also reject if not in jewelry categories whitelist
                if (!JEWELRY_CATEGORY_IDS.includes(categoryId)) {
                  const reason = `Not a jewelry category ${categoryId}`;
                  console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                  await cacheRejectedItem(task.id, item.itemId, reason);
                  excludedItems++;
                  continue;
                }
              }
            }
          }

          // Check description for plated/base metal indicators - skip for test listings
          if (!isTestListing && description) {
            const descLower = description.toLowerCase().replace(/<[^>]*>/g, ' ');
            const platedTerms = ['gold plated', 'gold-plated', 'rose gold plated', 'silver plated', 'plated brass', 'brass plated', 'plated metal', 'electroplated', 'gold filled', 'gold-filled', 'rose gold filled', 'silver filled', 'gold toned', 'gold-toned', 'rose gold toned', 'silver toned', 'goldtone', 'silvertone'];
            const baseMetalTerms = ['made of brass', 'brass base', 'base metal: brass', 'brass with', 'brass material', 'solid brass'];

            let descRejected = false;
            for (const term of platedTerms) {
              if (descLower.includes(term)) {
                const reason = `Description contains plated term: "${term}"`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await cacheRejectedItem(task.id, item.itemId, reason);
                excludedItems++;
                descRejected = true;
                break;
              }
            }
            if (descRejected) continue;

            for (const term of baseMetalTerms) {
              if (descLower.includes(term)) {
                const reason = `Description contains base metal: "${term}"`;
                console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                await cacheRejectedItem(task.id, item.itemId, reason);
                excludedItems++;
                descRejected = true;
                break;
              }
            }
            if (descRejected) continue;
          }
        }

        // Check for jewelry tools/supplies (welding, display stands, etc.) - skip for test listings
        if (!isTestListing) {
          const toolCheck = hasJewelryToolTerms(item.title);
          if (toolCheck.hasTerm) {
            const reason = `Jewelry tool/supply: "${toolCheck.term}"`;
            console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
            await cacheRejectedItem(task.id, item.itemId, reason);
            excludedItems++;
            continue;
          }
        }

        // Check item specifics (no stones, no plated/filled, no costume jewelry) - skip for test listings
        if (!isTestListing) {
          const specsCheck = passesJewelryItemSpecifics(item.title, specs, jewelryFilters);
          if (!specsCheck.pass) {
            console.log(`  ❌ REJECTED (${specsCheck.reason}): ${item.title.substring(0, 40)}...`);
            await cacheRejectedItem(task.id, item.itemId, specsCheck.reason || 'Failed specs check');
            excludedItems++;
            continue;
          }
        }

        // Extract karat and weight (from title, specs, or description)
        // Debug: log description status
        if (description && description.length > 0) {
          console.log(`    📝 Description: ${description.length} chars`);
        } else {
          console.log(`    ⚠️ No description available for weight extraction`);
        }

        const karat = extractKarat(item.title, specs, description);
        const weight = extractWeight(item.title, specs, description);

        // Debug: log if weight wasn't found but description exists
        if (!weight && description && description.length > 50) {
          console.log(`    ⚠️ Weight not extracted from description: "${description.substring(0, 100)}..."`);
        }

        // Check weight filters (min/max) - skip for test listings
        if (!isTestListing && weight) {
          const minWeight = jewelryFilters.weight_min;
          const maxWeight = jewelryFilters.weight_max;

          if (minWeight && weight < minWeight) {
            const reason = `Below min weight (${weight}g < ${minWeight}g)`;
            console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
            await cacheRejectedItem(task.id, item.itemId, reason);
            excludedItems++;
            continue;
          }

          if (maxWeight && weight > maxWeight) {
            const reason = `Above max weight (${weight}g > ${maxWeight}g)`;
            console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
            await cacheRejectedItem(task.id, item.itemId, reason);
            excludedItems++;
            continue;
          }
        }

        // Detect metal type (gold, silver, platinum, palladium)
        const metalInfo = detectMetalType(item.title, specs);
        const metalType = metalInfo.type;
        const purity = metalInfo.purity || (karat ? karat : null);

        // Calculate melt value and break-even
        let meltValue: number | null = null;
        let profitScrap: number | null = null;
        let breakEven: number | null = null;
        const shippingCost = item.shippingCost || 0;
        const totalCost = item.price + shippingCost;

        if (purity && weight) {
          const metalPrices = await getMetalPrices();
          if (metalPrices) {
            if (metalType === 'gold' && metalPrices.Gold) {
              meltValue = calculateGoldMeltValue(karat, weight, metalPrices.Gold);
            } else if (metalType === 'silver' && metalPrices.Silver) {
              meltValue = calculateSilverMeltValue(purity, weight, metalPrices.Silver);
            } else if (metalType === 'platinum' && metalPrices.Platinum) {
              meltValue = calculatePlatinumMeltValue(purity, weight, metalPrices.Platinum);
            } else if (metalType === 'palladium' && metalPrices.Palladium) {
              meltValue = calculatePlatinumMeltValue(purity, weight, metalPrices.Palladium);
            }

            if (meltValue) {
              breakEven = meltValue * 0.97; // 3% refining cost
              profitScrap = meltValue - totalCost;

              // Check profit margin against user's minimum setting - skip for test listings
              if (!isTestListing) {
                const profitMarginPct = ((breakEven - totalCost) / totalCost) * 100;
                // Check task-level setting first, then fall back to filter setting
                const minProfitMargin = task.min_profit_margin ?? jewelryFilters.min_profit_margin;

                // If user set a minimum profit margin, filter by that; otherwise use default -50%
                const marginThreshold = minProfitMargin !== null && minProfitMargin !== undefined
                  ? minProfitMargin
                  : -50;

                if (profitMarginPct < marginThreshold) {
                  const reason = `Low margin ${profitMarginPct.toFixed(0)}% < min ${marginThreshold}% - BE $${breakEven.toFixed(0)} vs cost $${totalCost.toFixed(0)}`;
                  console.log(`  ❌ REJECTED (${reason}): ${item.title.substring(0, 40)}...`);
                  await cacheRejectedItem(task.id, item.itemId, reason);
                  excludedItems++;
                  continue;
                }
              }
            }
          }
        }

        // Calculate suggested offer (break-even minus buffer for profit)
        const suggestedOffer = breakEven ? Math.floor(breakEven * 0.85) : null; // 15% below break-even

        const matchData = createMatchRecord(task, {
          ...item,
          karat,
          weight_g: weight,
          metalType,
          meltValue,
          profitScrap,
          breakEven,
          suggestedOffer,
        });

        // TIMING: Track the full match → notify flow
        const matchFlowStart = Date.now();
        console.log(`  ⏱️ [TIMING] Starting match flow at ${new Date().toISOString()}`);

        const insertStart = Date.now();
        const { data: insertedMatch, error: insertError } = await supabase
          .from(tableName)
          .insert(matchData)
          .select('id')
          .single();
        const insertTime = Date.now() - insertStart;

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          const meltStr = meltValue ? `Melt: $${meltValue.toFixed(0)}` : '';
          const breakEvenStr = breakEven ? `BE: $${breakEven.toFixed(0)}` : '';
          console.log(`✅ Match: ${karat || '?'}K ${weight || '?'}g - $${item.price} ${meltStr} ${breakEvenStr}`);
          console.log(`  ⏱️ [TIMING] DB insert: ${insertTime}ms`);
          newMatches++;

          // Send Slack notification for jewelry match
          console.log(`  📤 Sending Slack notification to channel: ${task.slack_channel || 'default'}...`);
          const notifyStart = Date.now();
          const slackResult = await sendJewelrySlackNotification(matchData, karat, weight, item.shippingCost, item.shippingType, meltValue, task.slack_channel, item.itemCreationDate);
          const notifyTime = Date.now() - notifyStart;
          console.log(`  ⏱️ [TIMING] Slack API call: ${notifyTime}ms`);

          // Update notification_sent flag and Slack message tracking
          if (slackResult.sent && insertedMatch?.id) {
            const updateData: any = { notification_sent: true };
            if (slackResult.ts) updateData.slack_message_ts = slackResult.ts;
            if (slackResult.channelId) updateData.slack_channel_id = slackResult.channelId;

            const updateStart = Date.now();
            await supabase
              .from(tableName)
              .update(updateData)
              .eq('id', insertedMatch.id);
            const updateTime = Date.now() - updateStart;
            console.log(`  ⏱️ [TIMING] DB update: ${updateTime}ms`);
            console.log(`  ✅ Slack notification sent successfully (ts: ${slackResult.ts})`);
            console.log(`  ⏱️ [TIMING] TOTAL match flow: ${Date.now() - matchFlowStart}ms`);
          } else {
            console.log(`  ❌ Slack notification FAILED for match ${insertedMatch?.id} - will retry later`);
            console.log(`  ❌ [DEBUG] slackResult.sent=${slackResult.sent}, channel=${task.slack_channel}, matchId=${insertedMatch?.id}`);
            console.log(`  ❌ [DEBUG] SLACK_BOT_TOKEN set: ${!!SLACK_BOT_TOKEN}, SLACK_WEBHOOK_URL set: ${!!SLACK_WEBHOOK_URL}`);
            console.log(`  ⏱️ [TIMING] Flow failed after: ${Date.now() - matchFlowStart}ms`);
          }

          // Rate limit delay for Slack (they silently drop messages if sent too fast)
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      }
      // Watch processing
      else if (task.item_type === 'watch') {
        // Use shipping from search results (more reliable than item details)
        if (item.shippingCost !== undefined && item.shippingCost > 0) {
          console.log(`  📦 Shipping: $${item.shippingCost} (${item.shippingType || 'from search'})`);
        } else if (item.shippingType === 'calculated') {
          console.log(`  📦 Shipping: Calculated (unknown cost)`);
        } else if (item.shippingType === 'free') {
          console.log(`  📦 Shipping: Free`);
        }

        // Check total cost (price + shipping) against max price
        const totalCostCheck = item.price + (item.shippingCost || 0);
        if (task.max_price && totalCostCheck > task.max_price) {
          console.log(`  🚫 Excluding: total cost $${totalCostCheck.toFixed(2)} > max $${task.max_price}: ${item.title.substring(0, 40)}...`);
          excludedItems++;
          continue;
        }

        let specs: Record<string, string> = {};

        if (token) {
          const itemDetails = await fetchItemDetails(item.itemId, token);
          if (itemDetails) {
            specs = extractItemSpecifics(itemDetails);
          }
        }

        // Extract watch properties
        const caseMaterial = extractWatchCaseMaterial(item.title, specs);
        const bandMaterial = extractWatchBandMaterial(item.title, specs);
        const movement = extractWatchMovement(item.title, specs);
        const dialColor = extractWatchDialColor(item.title, specs);
        const year = extractWatchYear(item.title, specs);
        const brand = extractWatchBrand(item.title, specs);
        const model = extractWatchModel(item.title, specs);

        const matchData = createMatchRecord(task, {
          ...item,
          caseMaterial,
          bandMaterial,
          movement,
          dialColor,
          year,
          brand,
          model,
        });

        const { error: insertError } = await supabase.from(tableName).insert(matchData);

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          console.log(`✅ Match: ${brand || '?'} ${model || ''} ${movement || '?'} - $${item.price}`);
          newMatches++;
        }
      }
      // Default/other processing
      else {
        const matchData = createMatchRecord(task, item);
        const { error: insertError } = await supabase.from(tableName).insert(matchData);

        if (insertError) {
          console.error('❌ Error inserting match:', insertError);
        } else {
          console.log(`✅ Match: ${item.title.substring(0, 50)}... - $${item.price}`);
          newMatches++;
        }
      }
    }

    // Update task last_run
    await supabase.from('tasks').update({ last_run: new Date().toISOString() }).eq('id', task.id);

    // Log completion with cache stats
    const skipMsg = skippedRejected > 0 ? `, ${skippedRejected} skipped (cached rejections)` : '';
    console.log(`🎯 Task ${task.name} completed: ${newMatches} new matches, ${excludedItems} excluded${skipMsg}`);

    // Cleanup expired cache entries periodically (1 in 10 chance)
    if (Math.random() < 0.1) {
      await cleanupExpiredCache();
    }

    return { itemsFound, newMatches, excludedItems };

  } catch (error: unknown) {
    console.error(`❌ Error processing task ${task.id}:`, error);
    await supabase.from('tasks').update({ last_run: new Date().toISOString() }).eq('id', task.id);
    return { itemsFound: 0, newMatches: 0, excludedItems: 0 };
  }
};

// ============================================
// Main Worker Loop
// ============================================

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function runOnce(): Promise<void> {
  const cycleStartTime = Date.now();
  console.log(`\n🚀 Poll cycle started at ${new Date().toISOString()}`);

  try {
    // Fetch all active tasks
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    if (!tasks || tasks.length === 0) {
      console.log('📭 No active tasks to process');
      // Still record health metric for empty cycle
      await recordHealthMetrics(cycleStartTime, 0, 0, 0, 0, 0);
      return;
    }

    console.log(`📋 Found ${tasks.length} active task(s) to process`);

    // Process tasks sequentially to avoid rate limiting
    console.log(`🚀 Running ${tasks.length} task(s) sequentially...`);

    let successCount = 0;
    let errorCount = 0;
    let totalItemsFound = 0;
    let totalMatches = 0;
    let totalExcluded = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`\n--- Starting Task ${i + 1}/${tasks.length}: ${task.name} ---`);

      try {
        const stats = await processTask(task);
        successCount++;
        totalItemsFound += stats.itemsFound;
        totalMatches += stats.newMatches;
        totalExcluded += stats.excludedItems;
      } catch (error) {
        errorCount++;
        console.error(`❌ Task ${task.name} failed:`, error);
      }

      // Add delay between tasks to avoid rate limiting
      if (i < tasks.length - 1) {
        console.log(`⏳ Waiting 3s before next task...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`✅ Poll cycle completed: ${successCount} successful, ${errorCount} failed`);

    // Record health metrics
    await recordHealthMetrics(cycleStartTime, successCount, errorCount, totalItemsFound, totalMatches, totalExcluded);

    // Retry any failed notifications every cycle (was 10%, now 100%)
    await retryFailedNotifications();

  } catch (error: any) {
    console.error('💥 Error in poll cycle:', error);
  }
}

// Record health metrics to Supabase
async function recordHealthMetrics(
  cycleStartTime: number,
  tasksProcessed: number,
  tasksFailed: number,
  totalItemsFound: number,
  totalMatches: number,
  totalExcluded: number
): Promise<void> {
  try {
    const cycleDuration = Date.now() - cycleStartTime;
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

    await supabase.from('worker_health_metrics').insert({
      cycle_timestamp: new Date().toISOString(),
      cycle_duration_ms: cycleDuration,
      tasks_processed: tasksProcessed,
      tasks_failed: tasksFailed,
      total_items_found: totalItemsFound,
      total_matches: totalMatches,
      total_excluded: totalExcluded,
      memory_usage_mb: memoryUsage.toFixed(2),
    });
  } catch (error) {
    console.error('Failed to record health metrics:', error);
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('🏃 eBay Hunter Worker Starting...');
  console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`🔗 Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log('='.repeat(50));

  // Verify Supabase connection
  const { error } = await supabase.from('tasks').select('count').limit(1);
  if (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    process.exit(1);
  }
  console.log('✅ Connected to Supabase');

  // Main loop
  while (true) {
    const startTime = Date.now();

    await runOnce();

    // Calculate time to wait for next poll
    const elapsed = Date.now() - startTime;
    const waitTime = Math.max(0, POLL_INTERVAL_MS - elapsed);

    if (waitTime > 0) {
      await sleep(waitTime);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Test mode - send test notifications and exit
if (process.argv.includes('--test-notification')) {
  const argIndex = process.argv.indexOf('--test-notification');
  const channel = process.argv[argIndex + 1] || 'tester';
  const countArg = process.argv[argIndex + 2];
  const count = countArg ? parseInt(countArg) : 1;

  console.log('🧪 Testing sendJewelrySlackNotification...');
  console.log(`   Channel: ${channel}`);
  console.log(`   Count: ${count}`);
  console.log('');

  const results: { success: number; failed: number; latencies: number[] } = {
    success: 0,
    failed: 0,
    latencies: []
  };

  (async () => {
    for (let i = 1; i <= count; i++) {
      const testMatch = {
        ebay_item_id: `TEST${i}`,
        ebay_title: `14K Gold Ring Test #${i} of ${count}`,
        ebay_price: 99.99,
        ebay_url: `https://www.ebay.com/itm/TEST${i}`,
        image_url: 'https://via.placeholder.com/150',
      };

      const start = Date.now();
      const result = await sendJewelrySlackNotification(
        testMatch,
        14,           // karat
        5.5,          // weight
        8.99,         // shipping
        'fixed',      // shipping type
        250.00,       // melt value
        channel,      // slack channel
        new Date().toISOString()  // item creation date
      );
      const elapsed = Date.now() - start;

      if (result.sent) {
        results.success++;
        results.latencies.push(elapsed);
        console.log(`✅ ${i}/${count}: sent in ${elapsed}ms`);
      } else {
        results.failed++;
        console.log(`❌ ${i}/${count}: FAILED`);
      }

      // Small delay between messages to avoid obvious rate limiting
      if (i < count) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log('');
    console.log('📊 SUMMARY:');
    console.log(`   Success: ${results.success}/${count}`);
    console.log(`   Failed:  ${results.failed}/${count}`);
    if (results.latencies.length > 0) {
      const avg = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
      const min = Math.min(...results.latencies);
      const max = Math.max(...results.latencies);
      console.log(`   Avg latency: ${avg.toFixed(0)}ms`);
      console.log(`   Min: ${min}ms, Max: ${max}ms`);
    }
    process.exit(results.failed > 0 ? 1 : 0);
  })();
} else if (process.argv.includes('--test-match-flow')) {
  // Test the full match flow: insert → notify → update
  const argIndex = process.argv.indexOf('--test-match-flow');
  const channel = process.argv[argIndex + 1] || 'tester';

  // Hardcoded task/user IDs - change these for your setup
  const TASK_ID = '51dd5383-4851-4049-8d90-bf0e455ede51';
  const USER_ID = 'f155eca6-5792-45e1-bc33-17bd23a9c06d';

  console.log('🧪 Testing FULL match flow: Insert → Notify → Update');
  console.log(`   Channel: ${channel}`);
  console.log(`   Task ID: ${TASK_ID}`);
  console.log('');

  (async () => {
    const itemId = 'TEST' + Date.now();
    const matchData = {
      task_id: TASK_ID,
      user_id: USER_ID,
      ebay_listing_id: itemId,
      ebay_title: '14K Gold Ring - Full Flow Test',
      ebay_url: `https://www.ebay.com/itm/${itemId}`,
      listed_price: 99.99,
      shipping_cost: 8.99,
      currency: 'USD',
      buy_format: 'Buy It Now',
      seller_feedback: 500,
      found_at: new Date().toISOString(),
      item_creation_date: new Date().toISOString(),
      status: 'new',
      notification_sent: false,
      karat: 14,
      weight_g: 5.5,
      metal_type: 'gold',
      melt_value: 250.00,
      profit_scrap: 150.00,
      break_even: 108.98,
      suggested_offer: 92.00,
    };

    // Step 1: Insert match
    console.log('Step 1: Inserting match into database...');
    const insertStart = Date.now();
    const { data: insertedMatch, error: insertError } = await supabase
      .from('matches_jewelry')
      .insert(matchData)
      .select('id')
      .single();
    const insertTime = Date.now() - insertStart;

    if (insertError) {
      console.error(`❌ Insert FAILED: ${insertError.message}`);
      process.exit(1);
    }
    console.log(`   ✅ Inserted in ${insertTime}ms (ID: ${insertedMatch.id})`);

    // Step 2: Send notification
    console.log('Step 2: Sending Slack notification...');
    const notifyStart = Date.now();
    const slackResult = await sendJewelrySlackNotification(
      matchData,
      14,
      5.5,
      8.99,
      'fixed',
      250.00,
      channel,
      matchData.item_creation_date
    );
    const notifyTime = Date.now() - notifyStart;

    if (slackResult.sent) {
      console.log(`   ✅ Notification sent in ${notifyTime}ms (ts: ${slackResult.ts})`);
    } else {
      console.log(`   ❌ Notification FAILED in ${notifyTime}ms`);
    }

    // Step 3: Update notification_sent
    console.log('Step 3: Updating notification_sent flag...');
    const updateStart = Date.now();
    if (slackResult.sent && insertedMatch?.id) {
      const updateData: any = { notification_sent: true };
      if (slackResult.ts) updateData.slack_message_ts = slackResult.ts;
      if (slackResult.channelId) updateData.slack_channel_id = slackResult.channelId;

      const { error: updateError } = await supabase
        .from('matches_jewelry')
        .update(updateData)
        .eq('id', insertedMatch.id);
      const updateTime = Date.now() - updateStart;

      if (updateError) {
        console.log(`   ❌ Update FAILED: ${updateError.message}`);
      } else {
        console.log(`   ✅ Updated in ${updateTime}ms`);
      }
    } else {
      console.log(`   ⏭️ Skipped (notification failed)`);
    }

    // Summary
    const totalTime = Date.now() - insertStart;
    console.log('');
    console.log('📊 SUMMARY:');
    console.log(`   Insert:  ${insertTime}ms`);
    console.log(`   Notify:  ${notifyTime}ms`);
    console.log(`   Update:  ${Date.now() - updateStart}ms`);
    console.log(`   TOTAL:   ${totalTime}ms`);
    console.log('');
    console.log(slackResult.sent ? '✅ Full flow completed successfully!' : '❌ Flow completed with notification failure');

    process.exit(slackResult.sent ? 0 : 1);
  })();
} else if (process.argv.includes('--test-process-item')) {
  // Test the REAL item processing flow: extraction → calculation → insert → notify
  const argIndex = process.argv.indexOf('--test-process-item');
  const channel = process.argv[argIndex + 1] || 'tester';

  const TASK_ID = '51dd5383-4851-4049-8d90-bf0e455ede51';
  const USER_ID = 'f155eca6-5792-45e1-bc33-17bd23a9c06d';

  console.log('🧪 Testing REAL item processing flow');
  console.log(`   Channel: ${channel}`);
  console.log('');

  (async () => {
    const totalStart = Date.now();

    // Fake item that looks like it came from eBay search
    const fakeItem = {
      itemId: 'TESTPROCESS' + Date.now(),
      title: '14K Yellow Gold Chain Necklace 18" 5.5g - Test Item',
      price: 150.00,
      currency: 'USD',
      listingUrl: 'https://www.ebay.com/itm/test123',
      listingType: 'Buy It Now',
      condition: 'Pre-owned',
      shippingCost: 8.99,
      shippingType: 'fixed',
      itemCreationDate: new Date().toISOString(),
      sellerInfo: { name: 'testseller', feedbackScore: 500 },
    };

    // Fake task
    const fakeTask: any = {
      id: TASK_ID,
      user_id: USER_ID,
      name: 'Test Task',
      item_type: 'jewelry',
      slack_channel: channel,
      jewelry_filters: { metal: ['Yellow Gold'] },
    };

    console.log('Step 1: Extracting karat and weight...');
    const extractStart = Date.now();
    const karat = extractKarat(fakeItem.title, {}, '');
    const weight = extractWeight(fakeItem.title, {}, '');
    const extractTime = Date.now() - extractStart;
    console.log(`   Karat: ${karat}, Weight: ${weight}g (${extractTime}ms)`);

    console.log('Step 2: Detecting metal type...');
    const metalStart = Date.now();
    const metalInfo = detectMetalType(fakeItem.title, {});
    const metalTime = Date.now() - metalStart;
    console.log(`   Metal: ${metalInfo.type}, Purity: ${metalInfo.purity} (${metalTime}ms)`);

    console.log('Step 3: Calculating melt value...');
    const meltStart = Date.now();
    const metalPrices = await getMetalPrices();
    let meltValue: number | null = null;
    if (karat && weight && metalPrices?.Gold) {
      meltValue = calculateGoldMeltValue(karat, weight, metalPrices.Gold);
    }
    const breakEven = meltValue ? meltValue * 0.97 : null;
    const meltTime = Date.now() - meltStart;
    console.log(`   Melt: $${meltValue?.toFixed(2) || 'N/A'}, Break-even: $${breakEven?.toFixed(2) || 'N/A'} (${meltTime}ms)`);

    console.log('Step 4: Creating match record...');
    const recordStart = Date.now();
    const matchData = createMatchRecord(fakeTask, {
      ...fakeItem,
      karat,
      weight_g: weight,
      metalType: metalInfo.type,
      meltValue,
      profitScrap: meltValue ? meltValue - (fakeItem.price + fakeItem.shippingCost) : null,
      breakEven,
      suggestedOffer: breakEven ? Math.floor(breakEven * 0.85) : null,
    });
    const recordTime = Date.now() - recordStart;
    console.log(`   ✅ Record created (${recordTime}ms)`);

    console.log('Step 5: Inserting into database...');
    const insertStart = Date.now();
    const { data: insertedMatch, error: insertError } = await supabase
      .from('matches_jewelry')
      .insert(matchData)
      .select('id')
      .single();
    const insertTime = Date.now() - insertStart;

    if (insertError) {
      console.error(`   ❌ Insert FAILED: ${insertError.message}`);
      process.exit(1);
    }
    console.log(`   ✅ Inserted (${insertTime}ms) ID: ${insertedMatch.id}`);

    console.log('Step 6: Sending Slack notification...');
    const notifyStart = Date.now();
    const slackResult = await sendJewelrySlackNotification(
      matchData, karat, weight, fakeItem.shippingCost, fakeItem.shippingType,
      meltValue, channel, fakeItem.itemCreationDate
    );
    const notifyTime = Date.now() - notifyStart;

    if (slackResult.sent) {
      console.log(`   ✅ Notification sent (${notifyTime}ms) ts: ${slackResult.ts}`);
    } else {
      console.log(`   ❌ Notification FAILED (${notifyTime}ms)`);
    }

    console.log('Step 7: Updating notification_sent flag...');
    const updateStart = Date.now();
    if (slackResult.sent) {
      await supabase
        .from('matches_jewelry')
        .update({ notification_sent: true, slack_message_ts: slackResult.ts })
        .eq('id', insertedMatch.id);
    }
    const updateTime = Date.now() - updateStart;
    console.log(`   ✅ Updated (${updateTime}ms)`);

    const totalTime = Date.now() - totalStart;
    console.log('');
    console.log('📊 TIMING BREAKDOWN:');
    console.log(`   1. Extract karat/weight:  ${extractTime}ms`);
    console.log(`   2. Detect metal:          ${metalTime}ms`);
    console.log(`   3. Calculate melt:        ${meltTime}ms`);
    console.log(`   4. Create record:         ${recordTime}ms`);
    console.log(`   5. DB insert:             ${insertTime}ms`);
    console.log(`   6. Slack notification:    ${notifyTime}ms`);
    console.log(`   7. DB update:             ${updateTime}ms`);
    console.log(`   ─────────────────────────────`);
    console.log(`   TOTAL:                    ${totalTime}ms`);

    process.exit(0);
  })();
} else if (process.argv.includes('--test-edge-function')) {
  // Test calling the eBay search edge function
  console.log('🧪 Testing edge function (eBay search)...');
  console.log('');

  (async () => {
    const searchParams = {
      keywords: '14K gold ring',
      maxPrice: 500,
      minPrice: 10,
      listingType: ['Auction', 'Fixed Price (BIN)'],
      minFeedback: 0,
      itemType: 'jewelry',
    };

    console.log('Step 1: Calling edge function...');
    const start = Date.now();
    const response = await supabase.functions.invoke('ebay-search', {
      body: searchParams
    });
    const elapsed = Date.now() - start;

    if (response.error) {
      console.log(`   ❌ Error: ${response.error.message} (${elapsed}ms)`);
      process.exit(1);
    }

    const items = response.data?.items || [];
    console.log(`   ✅ Found ${items.length} items (${elapsed}ms)`);

    if (items.length > 0) {
      console.log('');
      console.log('Sample items:');
      for (let i = 0; i < Math.min(3, items.length); i++) {
        console.log(`   ${i + 1}. ${items[i].title?.substring(0, 50)}... - $${items[i].price}`);
      }
    }

    console.log('');
    console.log('📊 RESULT:');
    console.log(`   Edge function latency: ${elapsed}ms`);
    console.log(`   Items returned: ${items.length}`);

    process.exit(0);
  })();
} else if (process.argv.includes('--test-fetch-details')) {
  // Test fetching item details from eBay API
  const argIndex = process.argv.indexOf('--test-fetch-details');
  const itemId = process.argv[argIndex + 1];

  if (!itemId) {
    console.log('Usage: --test-fetch-details <ebay_item_id>');
    console.log('Example: --test-fetch-details v1|123456789|0');
    process.exit(1);
  }

  console.log('🧪 Testing fetchItemDetails (eBay API)...');
  console.log(`   Item ID: ${itemId}`);
  console.log('');

  (async () => {
    console.log('Step 1: Getting eBay token...');
    const tokenStart = Date.now();
    const token = await getEbayToken();
    const tokenTime = Date.now() - tokenStart;

    if (!token) {
      console.log(`   ❌ Failed to get token (${tokenTime}ms)`);
      process.exit(1);
    }
    console.log(`   ✅ Token obtained (${tokenTime}ms)`);

    console.log('Step 2: Fetching item details...');
    const fetchStart = Date.now();
    const details = await fetchItemDetails(itemId, token);
    const fetchTime = Date.now() - fetchStart;

    if (!details) {
      console.log(`   ❌ Failed to fetch details (${fetchTime}ms)`);
      process.exit(1);
    }
    console.log(`   ✅ Details fetched (${fetchTime}ms)`);

    console.log('Step 3: Extracting specs...');
    const specsStart = Date.now();
    const specs = extractItemSpecifics(details);
    const specsTime = Date.now() - specsStart;
    console.log(`   ✅ Specs extracted: ${Object.keys(specs).length} fields (${specsTime}ms)`);

    console.log('');
    console.log('📊 TIMING:');
    console.log(`   Get token:      ${tokenTime}ms`);
    console.log(`   Fetch details:  ${fetchTime}ms`);
    console.log(`   Extract specs:  ${specsTime}ms`);
    console.log(`   TOTAL:          ${tokenTime + fetchTime + specsTime}ms`);

    if (Object.keys(specs).length > 0) {
      console.log('');
      console.log('📋 Item specs:');
      for (const [key, value] of Object.entries(specs).slice(0, 10)) {
        console.log(`   ${key}: ${value}`);
      }
    }

    process.exit(0);
  })();
} else if (process.argv.includes('--test-retry')) {
  // Test the retry mechanism timing
  console.log('🧪 Testing retry mechanism...');
  console.log('');
  console.log('This test inserts a match with notification_sent=false');
  console.log('and measures how long until retry picks it up.');
  console.log('');

  const TASK_ID = '51dd5383-4851-4049-8d90-bf0e455ede51';
  const USER_ID = 'f155eca6-5792-45e1-bc33-17bd23a9c06d';

  (async () => {
    // Insert match with notification_sent = false
    const matchData = {
      task_id: TASK_ID,
      user_id: USER_ID,
      ebay_listing_id: 'RETRY_TEST_' + Date.now(),
      ebay_title: '14K Gold Retry Test - Waiting for retry',
      ebay_url: 'https://www.ebay.com/itm/test',
      listed_price: 99.99,
      shipping_cost: 8.99,
      currency: 'USD',
      buy_format: 'Buy It Now',
      seller_feedback: 500,
      found_at: new Date().toISOString(),
      status: 'new',
      notification_sent: false,  // This triggers retry
      karat: 14,
      weight_g: 5.5,
      metal_type: 'gold',
    };

    console.log('Step 1: Inserting match with notification_sent=false...');
    const { data: inserted, error } = await supabase
      .from('matches_jewelry')
      .insert(matchData)
      .select('id')
      .single();

    if (error) {
      console.log(`   ❌ Insert failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`   ✅ Inserted match ID: ${inserted.id}`);
    console.log('');
    console.log('Now watch the worker logs for retry:');
    console.log('   pm2 logs worker --lines 0');
    console.log('');
    console.log('The retry runs ~10% of poll cycles (every ~10 mins on average).');
    console.log('When it runs, you\'ll see:');
    console.log('   🔄 Checking for failed notifications to retry...');
    console.log('   📋 Found 1 jewelry matches to retry');

    process.exit(0);
  })();
} else {
  // Start the worker
  main().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  });
}
