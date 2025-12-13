# eBay Hunter Worker

A long-running worker that polls eBay for deals every 10 seconds (or configurable interval).

## Setup

1. Install dependencies:
   ```bash
   cd worker
   npm install
   ```

2. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your Supabase service role key:
   ```
   SUPABASE_URL=https://hzinvalidlnlhindttbu.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   POLL_INTERVAL=10
   ```

## Running Locally

```bash
npm start
```

## Deploying to a Server

### Option 1: Railway (Recommended - Free Tier)

1. Push this folder to GitHub
2. Connect Railway to your repo
3. Set environment variables in Railway dashboard
4. Deploy

### Option 2: DigitalOcean/VPS

1. SSH into your server
2. Clone the repo
3. Install Node.js
4. Run with PM2:
   ```bash
   npm install -g pm2
   cd worker
   npm install
   pm2 start index.js --name ebay-worker
   pm2 save
   pm2 startup
   ```

### Option 3: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

## How It Works

1. Fetches all active tasks from Supabase
2. Gets eBay API credentials from the settings table
3. Searches eBay for each task
4. Saves new matches to the appropriate matches table
5. Waits 10 seconds (configurable)
6. Repeats forever

## Notes

- Runs independently of the web app
- Works 24/7 even when no one has the app open
- Uses the same eBay credentials stored in Supabase settings
- AI analysis is not included (can be added later)
