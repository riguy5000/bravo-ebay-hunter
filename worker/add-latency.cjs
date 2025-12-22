const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

// Add latency calculation
const oldCode = `const profitPct = profit && totalCost > 0 ? ((profit / totalCost) * 100).toFixed(0) : null;

    const shippingText = shippingCost > 0`;

const newCode = `const profitPct = profit && totalCost > 0 ? ((profit / totalCost) * 100).toFixed(0) : null;

    // Calculate latency (time from listing creation to detection)
    let latencyText = 'N/A';
    if (item.itemCreationDate) {
      const listingTime = new Date(item.itemCreationDate).getTime();
      const now = Date.now();
      const latencyMs = now - listingTime;
      const mins = Math.floor(latencyMs / 60000);
      const secs = Math.floor((latencyMs % 60000) / 1000);
      latencyText = mins + 'm ' + secs + 's';
    }

    const shippingText = shippingCost > 0`;

if (!content.includes('latencyText')) {
  content = content.replace(oldCode, newCode);
  
  // Replace Seller field with Latency
  content = content.replace(
    `text: \`*🏷️ Seller:*\n\${item.seller?.feedbackScore || 'N/A'} feedback\``,
    `text: \`*⏱️ Latency:*\n\${latencyText}\``
  );
  
  fs.writeFileSync('index.js', content);
  console.log('Added latency to Slack notification!');
} else {
  console.log('Latency already added');
}
