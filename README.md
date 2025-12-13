# Bravo eBay Hunter

A CRM tool for finding deals on eBay for watches, jewelry, and gemstones. Create search tasks with specific criteria, run the worker to scan eBay listings, and manage your matches.

## Prerequisites

- Node.js 18+ and npm
- Supabase account (for database and edge functions)
- eBay Developer API credentials

## Setup

1. **Clone and install dependencies:**
   ```sh
   git clone https://github.com/riguy5000/bravo-ebay-hunter.git
   cd bravo-ebay-hunter
   npm install
   ```

2. **Set up environment variables:**

   Create a `.env` file in the `worker/` directory:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Configure eBay API credentials:**

   Add your eBay API credentials in the app's Settings page (Client ID, Client Secret, etc.)

## Running the Application

### Web App (Dashboard)

Start the development server:
```sh
npm run dev
```

The app will be available at `http://localhost:5173`

### Worker (eBay Scanner)

The worker scans eBay for listings matching your active tasks:

```sh
cd worker
node index.js
```

The worker will:
- Poll every 10 seconds for active tasks
- Search eBay for matching listings
- Save new matches to the database
- Skip duplicates and excluded keywords

**Note:** Keep the worker running in a separate terminal while using the app.

## Usage

1. **Create a Task** - Go to Tasks page and create a new search task with:
   - Search keywords (e.g., "Rose Gold jewelry")
   - Item type (watch, jewelry, or gemstone)
   - Price range
   - Subcategories to search
   - Exclusion keywords (e.g., "plated", "filled")

2. **Activate the Task** - Set the task status to "Active"

3. **Run the Worker** - Start the worker to begin scanning eBay

4. **View Matches** - Check the Matches page to see found listings

5. **Manage Matches** - Mark items as purchased, hidden, or delete them

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Edge Functions)
- **API:** eBay Browse API v1
