# eBay Hunter Worker

Standalone Node.js worker for continuous 1-second polling on Digital Ocean Droplet.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Build TypeScript
```bash
npm run build
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 4. Run locally (for testing)
```bash
npm start
```

### 4. Run with PM2 (for production)
```bash
# Install PM2 globally
npm install -g pm2

# Start the worker
pm2 start ecosystem.config.js

# View logs
pm2 logs ebay-hunter-worker

# Monitor
pm2 monit

# Stop
pm2 stop ebay-hunter-worker

# Restart
pm2 restart ebay-hunter-worker
```

## Digital Ocean Droplet Setup

### 1. Create Droplet
- Image: Ubuntu 22.04
- Plan: Basic $6/mo (1GB RAM)
- Region: Closest to you

### 2. SSH into Droplet
```bash
ssh root@your-droplet-ip
```

### 3. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### 4. Install PM2
```bash
npm install -g pm2
```

### 5. Clone and setup
```bash
git clone https://github.com/riguy5000/bravo-ebay-hunter.git
cd bravo-ebay-hunter/worker-node
npm install
cp .env.example .env
nano .env  # Add your credentials
```

### 6. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to auto-start on boot
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| SUPABASE_URL | Your Supabase project URL | Required |
| SUPABASE_SERVICE_ROLE_KEY | Service role key (not anon) | Required |
| SLACK_WEBHOOK_URL | Optional Slack notifications | Empty |
| POLL_INTERVAL_MS | Polling interval in ms | 1000 |
