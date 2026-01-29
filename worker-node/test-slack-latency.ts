// Test script to measure Slack notification latency
import * as dotenv from 'dotenv';
dotenv.config();

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DEFAULT_SLACK_CHANNEL = process.env.DEFAULT_SLACK_CHANNEL;

async function measureSlackLatency() {
  if (!SLACK_BOT_TOKEN) {
    console.log('❌ SLACK_BOT_TOKEN not set in .env');
    return;
  }

  if (!DEFAULT_SLACK_CHANNEL) {
    console.log('❌ DEFAULT_SLACK_CHANNEL not set in .env');
    return;
  }

  const testMessage = {
    channel: DEFAULT_SLACK_CHANNEL,
    text: `🧪 *Latency Test* - Sent at ${new Date().toISOString()}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🧪 *Slack Latency Test*\nSent at: \`${new Date().toISOString()}\``
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "⏱️ Measuring round-trip time to Slack API"
          }
        ]
      }
    ]
  };

  console.log('📤 Sending test notification to Slack...');
  console.log(`   Channel: ${DEFAULT_SLACK_CHANNEL}`);
  console.log('');

  // Measure time
  const startTime = Date.now();

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
      },
      body: JSON.stringify(testMessage)
    });

    const endTime = Date.now();
    const latencyMs = endTime - startTime;

    const result = await response.json() as any;

    if (result.ok) {
      console.log('✅ Notification sent successfully!');
      console.log('');
      console.log('📊 RESULTS:');
      console.log(`   API Response Time: ${latencyMs}ms`);
      console.log(`   Message Timestamp: ${result.ts}`);
      console.log(`   Channel: ${result.channel}`);
      console.log('');
      console.log('💡 This measures the time for Slack API to ACCEPT the message.');
      console.log('   The actual delivery to your device may take additional time');
      console.log('   depending on Slack\'s push notification queue.');
    } else {
      console.log(`❌ Slack API error: ${result.error}`);
      console.log(`   Response time: ${latencyMs}ms`);
    }
  } catch (error: any) {
    const endTime = Date.now();
    console.log(`❌ Request failed: ${error.message}`);
    console.log(`   Failed after: ${endTime - startTime}ms`);
  }
}

// Run multiple times to get average
async function runMultipleTests(count: number = 3) {
  console.log(`🔄 Running ${count} latency tests...\n`);

  const results: number[] = [];

  for (let i = 1; i <= count; i++) {
    console.log(`--- Test ${i}/${count} ---`);

    const startTime = Date.now();

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
        },
        body: JSON.stringify({
          channel: DEFAULT_SLACK_CHANNEL,
          text: `🧪 Test ${i}/${count} - ${new Date().toISOString()}`
        })
      });

      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      const result = await response.json() as any;

      if (result.ok) {
        console.log(`✅ Test ${i}: ${latencyMs}ms`);
        results.push(latencyMs);
      } else {
        console.log(`❌ Test ${i}: Failed - ${result.error}`);
      }
    } catch (error: any) {
      console.log(`❌ Test ${i}: Error - ${error.message}`);
    }

    // Wait 1 second between tests
    if (i < count) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (results.length > 0) {
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);

    console.log('\n📊 SUMMARY:');
    console.log(`   Tests run: ${results.length}`);
    console.log(`   Average:   ${avg.toFixed(0)}ms`);
    console.log(`   Min:       ${min}ms`);
    console.log(`   Max:       ${max}ms`);
    console.log('\n💡 If average is < 500ms, Slack API is fast.');
    console.log('   Any perceived delay is likely in push notification delivery,');
    console.log('   not the API call itself.');
  }
}

// Check command line args
const args = process.argv.slice(2);
if (args.includes('--multi') || args.includes('-m')) {
  const countArg = args.find(a => /^\d+$/.test(a));
  const count = countArg ? parseInt(countArg) : 3;
  runMultipleTests(count);
} else {
  measureSlackLatency();
}
