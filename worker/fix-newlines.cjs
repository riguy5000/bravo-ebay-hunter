const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

// Replace the broken section with fixed version
const broken = `{ type: "section", fields: [
          { type: "mrkdwn", text: "*Status:*
" + statusText },
          { type: "mrkdwn", text: "*Detected At:*
" + detectedAt },
          { type: "mrkdwn", text: "*Price:*
$" + price },
          { type: "mrkdwn", text: "*Melt Value:*
" + (meltValue ? "$" + meltValue.toFixed(0) : "N/A") },
          { type: "mrkdwn", text: "*Karat:*
" + (karat ? karat + "K" : "Unknown") },
          { type: "mrkdwn", text: "*Weight:*
" + (weightG ? weightG.toFixed(1) + "g" : "Unknown") }
        ]}`;

const fixed = `{ type: "section", fields: [
          { type: "mrkdwn", text: "*Status:* " + statusText },
          { type: "mrkdwn", text: "*Detected At:* " + detectedAt },
          { type: "mrkdwn", text: "*Price:* $" + price },
          { type: "mrkdwn", text: "*Melt Value:* " + (meltValue ? "$" + meltValue.toFixed(0) : "N/A") },
          { type: "mrkdwn", text: "*Karat:* " + (karat ? karat + "K" : "Unknown") },
          { type: "mrkdwn", text: "*Weight:* " + (weightG ? weightG.toFixed(1) + "g" : "Unknown") }
        ]}`;

if (content.includes(broken)) {
  content = content.replace(broken, fixed);
  fs.writeFileSync('index.js', content);
  console.log('Fixed!');
} else {
  console.log('Pattern not found, trying alternative...');
  // Try line by line replacement
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{ type: "mrkdwn", text: "*Status:*')) {
      lines[i] = '          { type: "mrkdwn", text: "*Status:* " + statusText },';
      lines.splice(i+1, 1); // remove next line
    }
    if (lines[i].includes('{ type: "mrkdwn", text: "*Detected At:*')) {
      lines[i] = '          { type: "mrkdwn", text: "*Detected At:* " + detectedAt },';
      lines.splice(i+1, 1);
    }
    if (lines[i].includes('{ type: "mrkdwn", text: "*Price:*')) {
      lines[i] = '          { type: "mrkdwn", text: "*Price:* $" + price },';
      lines.splice(i+1, 1);
    }
    if (lines[i].includes('{ type: "mrkdwn", text: "*Melt Value:*')) {
      lines[i] = '          { type: "mrkdwn", text: "*Melt Value:* " + (meltValue ? "$" + meltValue.toFixed(0) : "N/A") },';
      lines.splice(i+1, 1);
    }
    if (lines[i].includes('{ type: "mrkdwn", text: "*Karat:*')) {
      lines[i] = '          { type: "mrkdwn", text: "*Karat:* " + (karat ? karat + "K" : "Unknown") },';
      lines.splice(i+1, 1);
    }
    if (lines[i].includes('{ type: "mrkdwn", text: "*Weight:*')) {
      lines[i] = '          { type: "mrkdwn", text: "*Weight:* " + (weightG ? weightG.toFixed(1) + "g" : "Unknown") }';
      lines.splice(i+1, 1);
    }
  }
  fs.writeFileSync('index.js', lines.join('\n'));
  console.log('Fixed with line-by-line approach!');
}
