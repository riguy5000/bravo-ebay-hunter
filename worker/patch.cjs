const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

if (content.includes('TEST_SELLER_ID')) {
  console.log('Already patched');
  process.exit(0);
}

const fn = `
// Test seller notification
const TEST_SELLER_ID = 'pe952597';
async function sendTestSellerNotification(item, status, reason, karat, weightG, price, shippingCost, meltValue) {
  if (!SLACK_WEBHOOK_URL) return;
  const sellerName = item.seller?.username || 'unknown';
  if (sellerName.toLowerCase() !== TEST_SELLER_ID.toLowerCase()) return;
  try {
    const detectedAt = new Date().toISOString();
    const statusEmoji = status === 'SAVED' ? '✅' : '🧪';
    const statusText = status === 'SAVED' ? 'SAVED AS MATCH' : 'REJECTED: ' + reason;
    const message = {
      blocks: [
        { type: "header", text: { type: "plain_text", text: statusEmoji + " Test Listing Detected!", emoji: true } },
        { type: "section", text: { type: "mrkdwn", text: "*" + item.title.substring(0, 100) + "*" } },
        { type: "section", fields: [
          { type: "mrkdwn", text: "*Status:*\n" + statusText },
          { type: "mrkdwn", text: "*Detected At:*\n" + detectedAt },
          { type: "mrkdwn", text: "*Price:*\n$" + price },
          { type: "mrkdwn", text: "*Melt Value:*\n" + (meltValue ? "$" + meltValue.toFixed(0) : "N/A") },
          { type: "mrkdwn", text: "*Karat:*\n" + (karat ? karat + "K" : "Unknown") },
          { type: "mrkdwn", text: "*Weight:*\n" + (weightG ? weightG.toFixed(1) + "g" : "Unknown") }
        ]},
        { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "View on eBay", emoji: true }, url: item.itemWebUrl, style: "primary" }]}
      ]
    };
    await fetch(SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
  } catch (e) { console.log('Test notification error:', e.message); }
}

`;

// Insert before Rate Limiting
content = content.replace('// Rate Limiting (eBay allows 5,000 calls/day)', fn + '// Rate Limiting (eBay allows 5,000 calls/day)');

// Add call on rejection
content = content.replace(
  /console\.log\(`  ❌ REJECTED \(\$\{reason\}\): \$\{item\.title\.substring\(0, 40\)\}\.\.\.\`\);/g,
  `console.log(\`  ❌ REJECTED (\${reason}): \${item.title.substring(0, 40)}...\`);
                await sendTestSellerNotification(item, 'REJECTED', reason, karat, weightG, price, shippingCost, meltValue);`
);

// Add call after save
content = content.replace(
  'await sendSlackNotification(match, item, karat, weightG, shippingCost, meltValue);',
  `await sendSlackNotification(match, item, karat, weightG, shippingCost, meltValue);
          await sendTestSellerNotification(item, 'SAVED', null, karat, weightG, price, shippingCost, meltValue);`
);

fs.writeFileSync(indexPath, content);
console.log('Patched successfully!');
