// Quick test script to send a sample Slack notification
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function sendTestNotification() {
  if (!SLACK_WEBHOOK_URL) {
    console.log('❌ SLACK_WEBHOOK_URL not set');
    return;
  }

  // Sample data
  const karat = 14;
  const weightG = 2.45;
  const listedPrice = 285.15;
  const shippingCost = 0;
  const meltValue = 180;
  const offerPrice = (meltValue * 0.87).toFixed(0);
  const breakEven = meltValue * 0.97;
  const totalCost = listedPrice + shippingCost;
  const profit = (breakEven - totalCost).toFixed(0);
  const profitMarginPct = ((breakEven - totalCost) / totalCost * 100).toFixed(0);
  const profitDisplay = `$${profit} (${profitMarginPct}%)`;

  // Determine sidebar color based on profit
  const sidebarColor = parseFloat(profit) > 0 ? '#36a64f' : '#dc3545';

  const message = {
    attachments: [
      {
        color: sidebarColor,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🧪 TEST: 14K Italy Gold Box Chain Necklace 24" - Solid Yellow Gold Fine Jewelry*`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `💍 *$${totalCost.toFixed(2)}* total | *${karat}K* | 🔵 *${weightG.toFixed(2)}g* | 💚 Offer: *$${offerPrice}* | 🔴 Profit: *${profitDisplay}*`
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View on eBay", emoji: true },
                url: "https://www.ebay.com/itm/123456789",
                style: "primary"
              }
            ]
          }
        ]
      }
    ]
  };

  console.log('📤 Sending test Slack notification...');

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });

  if (response.ok) {
    console.log('✅ Test notification sent!');
  } else {
    console.log(`❌ Failed: ${response.status} ${response.statusText}`);
  }
}

sendTestNotification();
