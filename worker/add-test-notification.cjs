// Script to add test seller notification to index.js
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

const testSellerFunction = `
// Test seller notification - sends for ALL items from test seller (even rejected)
const TEST_SELLER_ID = 'pe952597';

async function sendTestSellerNotification(item, status, reason, karat, weightG, price, shippingCost, meltValue) {
  if (!SLACK_WEBHOOK_URL) return;
  const sellerName = item.seller?.username || 'unknown';
  if (sellerName.toLowerCase() !== TEST_SELLER_ID.toLowerCase()) return;

  try {
    const detectedAt = new Date().toISOString();
    const statusEmoji = status === 'SAVED' ? '✅' : '🧪';
    const statusText = status === 'SAVED' ? 'SAVED AS MATCH' : \`REJECTED: \${reason}\`;

    const message = {
      blocks: [
        { type: "header", text: { type: "plain_text", text: \`\${statusEmoji} Test Listing Detected!\`, emoji: true } },
        { type: "section", text: { type: "mrkdwn", text: \`*\${item.title.substring(0, 100)}\${item.title.length > 100 ? '...' : ''}*\` } },
        { type: "section", fields: [
            { type: "mrkdwn", text: \`*Status:*\\n\${statusText}\` },
            { type: "mrkdwn", text: \`*Detected At:*\\n\${detectedAt}\` },
            { type: "mrkdwn", text: \`*💰 Price:*\\n$\${price}\${shippingCost > 0 ? \` + $\${shippingCost} ship\` : ''}\` },
            { type: "mrkdwn", text: \`*📊 Melt Value:*\\n\${meltValue ? \`$\${meltValue.toFixed(0)}\` : 'N/A'}\` },
            { type: "mrkdwn", text: \`*✨ Karat:*\\n\${karat ? \`\${karat}K\` : 'Unknown'}\` },
            { type: "mrkdwn", text: \`*⚖️ Weight:*\\n\${weightG ? \`\${weightG.toFixed(1)}g\` : 'Unknown'}\` }
        ]},
        { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "🔗 View on eBay", emoji: true }, url: item.itemWebUrl, style: "primary" }]}
      ]
    };

    await fetch(SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
  } catch (error) {
    console.log(\`  ⚠️ Test seller notification error: \${error.message}\`);
  }
}

`;

// Check if already added
if (content.includes('TEST_SELLER_ID')) {
  console.log('Test seller notification already exists in index.js');
  process.exit(0);
}

// Add function before Rate Limiting section
const marker = '// ============================================\n// Rate Limiting (eBay allows 5,000 calls/day)';
if (!content.includes(marker)) {
  console.log('Could not find Rate Limiting section marker');
  process.exit(1);
}

content = content.replace(marker, testSellerFunction + marker);

// Add call before rejection continue
const rejectionMarker = `                console.log(\`  ❌ REJECTED (\${reason}): \${item.title.substring(0, 40)}...\`);`;
const rejectionReplacement = `                console.log(\`  ❌ REJECTED (\${reason}): \${item.title.substring(0, 40)}...\`);

                // Send test seller notification for rejected items
                await sendTestSellerNotification(item, 'REJECTED', reason, karat, weightG, price, shippingCost, meltValue);`;

content = content.replace(rejectionMarker, rejectionReplacement);

// Add call after successful save (for test seller items that pass margin check)
const saveMarker = `        // Send Slack notification for jewelry matches
        if (task.item_type === 'jewelry') {
          await sendSlackNotification(match, item, karat, weightG, shippingCost, meltValue);
        }`;
const saveReplacement = `        // Send Slack notification for jewelry matches
        if (task.item_type === 'jewelry') {
          await sendSlackNotification(match, item, karat, weightG, shippingCost, meltValue);
          await sendTestSellerNotification(item, 'SAVED', null, karat, weightG, price, shippingCost, meltValue);
        }`;

content = content.replace(saveMarker, saveReplacement);

fs.writeFileSync(indexPath, content);
console.log('Successfully added test seller notification!');
