# Bravo eBay Hunter - System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BRAVO EBAY HUNTER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐              │
│  │   FRONTEND   │ ←──→ │   SUPABASE   │ ←──→ │    WORKER    │              │
│  │  (React App) │      │  (Database)  │      │  (Node.js)   │              │
│  └──────────────┘      └──────────────┘      └──────────────┘              │
│         ↑                     ↑                     ↓                       │
│         │                     │              ┌──────────────┐              │
│      Browser              Real-time          │   EBAY API   │              │
│                           Updates            └──────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Frontend (React + Vite)

**Location:** `src/`

### Directory Structure

```
src/
├── pages/
│   ├── Dashboard.tsx      # Overview, stats, market prices
│   ├── Matches.tsx        # View found items, manage status
│   ├── Tasks.tsx          # Create/edit scanning tasks
│   └── Settings.tsx       # API keys, notifications
├── components/
│   ├── tasks/TaskForm.tsx # Task creation form
│   ├── matches/           # Match display components
│   └── layout/            # Navigation, sidebar
├── hooks/
│   ├── useMatches.ts      # Fetch & subscribe to matches
│   ├── useTasks.ts        # Fetch & manage tasks
│   └── usePriceHistory.ts # Metal price charts
└── contexts/
    └── AuthContext.tsx    # User authentication
```

### Data Flow

```
User opens app
      ↓
AuthContext checks Supabase session
      ↓
Pages load data via hooks (useMatches, useTasks)
      ↓
Real-time subscriptions listen for new matches
      ↓
UI updates automatically when worker finds items
```

---

## 2. Supabase (Backend)

**Location:** `supabase/`

### Database Tables

#### `tasks` - Scanning task configurations
| Column | Description |
|--------|-------------|
| id | UUID primary key |
| name | Task name (e.g., "Gold Scrap Scanner") |
| item_type | watch / jewelry / gemstone |
| jewelry_filters | JSONB: {metal, subcategories, metal_purity, ...} |
| exclude_keywords | Array of strings to filter out |
| poll_interval | How often to scan (seconds) |
| status | active / paused / stopped |

#### `matches_jewelry` - Found jewelry items
| Column | Description |
|--------|-------------|
| id | UUID primary key |
| task_id | Foreign key to tasks |
| ebay_listing_id | eBay item ID |
| ebay_title | Item title |
| ebay_url | Link to listing |
| listed_price | Item price |
| shipping_cost | Shipping cost |
| karat | Gold purity (10, 14, 18, 24) |
| weight_g | Weight in grams |
| melt_value | Calculated scrap value |
| profit_scrap | Potential profit |
| status | new / reviewed / offered / purchased / passed |

#### `metal_prices` - Current metal prices
| Column | Description |
|--------|-------------|
| metal | Gold / Silver / Platinum / Palladium |
| price_gram_24k | Price per gram (pure) |
| price_gram_18k | Price per gram (18k) |
| price_gram_14k | Price per gram (14k) |
| price_gram_10k | Price per gram (10k) |
| updated_at | Last update timestamp |

#### `rejected_items` - Cache of rejected items (48hr TTL)
| Column | Description |
|--------|-------------|
| task_id | Foreign key to tasks |
| ebay_listing_id | eBay item ID |
| rejection_reason | Why it was rejected |
| expires_at | When to remove from cache |

#### `settings` - eBay API keys
| Column | Description |
|--------|-------------|
| app_id | eBay App ID |
| cert_id | eBay Cert ID |
| dev_id | eBay Dev ID |
| status | active / rate_limited / error |

### Edge Functions

```
supabase/functions/
└── get-gold-prices/     # Fetches live metal prices from Swissquote API
```

---

## 3. Worker (Node.js Scanner)

**Location:** `worker/index.js`

### Main Poll Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      WORKER POLL CYCLE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  START (every poll_interval seconds)                            │
│      ↓                                                          │
│  1. Fetch active tasks from Supabase                            │
│      ↓                                                          │
│  2. For each task:                                              │
│      ├── Build eBay search query                                │
│      │   • Keywords: "Yellow Gold jewelry"                      │
│      │   • Categories: [164331, 164330, ...]                    │
│      │   • Price range: min/max                                 │
│      │   • Aspect filters: metal purity, etc.                   │
│      ↓                                                          │
│  3. Call eBay Browse API (search)                               │
│      • Round-robin API key rotation                             │
│      • Returns up to 200 items                                  │
│      ↓                                                          │
│  4. For each item returned:                                     │
│      ├── Skip if already in matches table                       │
│      ├── Skip if in rejected_items cache                        │
│      ├── Check exclude_keywords → Skip if matched               │
│      ↓                                                          │
│  5. Fetch item details (API call)                               │
│      • Get item specifics (weight, karat, etc.)                 │
│      • Cache response in ebay_item_cache                        │
│      ↓                                                          │
│  6. Validate item specifics                                     │
│      ├── Check metal purity matches filter                      │
│      ├── Check condition matches filter                         │
│      └── Reject if doesn't match → Add to rejected_items        │
│      ↓                                                          │
│  7. Calculate melt value                                        │
│      ├── Detect metal type (gold/silver/platinum)               │
│      ├── Extract karat/purity                                   │
│      ├── Extract weight in grams                                │
│      ├── Get current metal price                                │
│      └── melt_value = weight × price_per_gram × purity          │
│      ↓                                                          │
│  8. Calculate profit                                            │
│      ├── break_even = melt_value × 0.97 (refiner payout)        │
│      ├── total_cost = price + shipping                          │
│      └── profit = break_even - total_cost                       │
│      ↓                                                          │
│  9. Check profit margin                                         │
│      ├── If break_even < 50% of cost → Reject                   │
│      └── Otherwise → Save to matches_jewelry                    │
│      ↓                                                          │
│  10. Send Slack notification (if configured)                    │
│      ↓                                                          │
│  END → Wait for next poll_interval                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `poll()` | Main loop, processes all tasks |
| `searchEbay()` | Builds query, calls eBay API |
| `searchEbayAllMetals()` | Searches for multiple metals separately |
| `fetchItemDetails()` | Gets item specifics from eBay |
| `detectMetalType()` | Determines gold/silver/platinum from title/specs |
| `extractKarat()` | Parses "14K" from title/specs |
| `extractSilverPurity()` | Parses "925" for sterling silver |
| `extractPlatinumPurity()` | Parses "950" for platinum |
| `extractWeight()` | Parses "5.2g" from title/specs/description |
| `calculateGoldMeltValue()` | weight × price_per_gram_Xk |
| `calculateSilverMeltValue()` | weight × pure_price × (purity/1000) |
| `calculatePlatinumMeltValue()` | weight × pure_price × (purity/1000) |
| `getMetalPrices()` | Fetches all metal prices from database |
| `getEbayCredentials()` | Round-robin API key selection |
| `checkItemSpecifics()` | Validates item against task filters |

### Melt Value Calculation

#### Gold
```
melt_value = weight_grams × price_per_gram_Xk

Example (14K gold, 5g):
  melt_value = 5g × $45.50/g = $227.50
```

#### Silver
```
melt_value = weight_grams × pure_price × (purity / 1000)

Example (Sterling 925, 10g):
  melt_value = 10g × $1.05/g × 0.925 = $9.71
```

#### Platinum
```
melt_value = weight_grams × pure_price × (purity / 1000)

Example (950 Platinum, 5g):
  melt_value = 5g × $32.00/g × 0.95 = $152.00
```

### Profit Calculation

```
total_cost = listed_price + shipping_cost
break_even = melt_value × 0.97  (refiner pays 97%)
profit = break_even - total_cost
profit_margin = (profit / total_cost) × 100

Rejection rule: If break_even < (total_cost × 0.5), reject item
```

### API Key Rotation

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROUND-ROBIN KEY ROTATION                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  API Keys: [Key1, Key2, Key3, Key4, Key5]                       │
│  Index: 0                                                        │
│                                                                  │
│  Call 1: Use Key1, Index → 1                                    │
│  Call 2: Use Key2, Index → 2                                    │
│  Call 3: Use Key3, Index → 3                                    │
│  Call 4: Use Key4, Index → 4                                    │
│  Call 5: Use Key5, Index → 0 (wrap around)                      │
│  Call 6: Use Key1, Index → 1                                    │
│  ...                                                             │
│                                                                  │
│  Benefits:                                                       │
│  • Distributes load across all keys                             │
│  • Avoids hitting rate limits on single key                     │
│  • Each key: 5,000 calls/day limit                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow Example

```
User creates task "Gold Scrap Scanner"
         ↓
Task saved to Supabase: tasks table
         ↓
Worker picks up task on next poll
         ↓
Worker searches eBay: "Yellow Gold jewelry" in categories
         ↓
eBay returns 150 items
         ↓
Worker filters:
  - 80 already seen (skip)
  - 30 excluded by keywords (skip)
  - 25 rejected by item specs (cache rejection)
  - 15 pass all filters
         ↓
Worker calculates melt value for 15 items
         ↓
10 items have good profit margin → Save to matches_jewelry
5 items have low margin → Cache rejection
         ↓
Supabase real-time pushes new matches to frontend
         ↓
User sees new items appear in Matches page instantly
```

---

## 5. Complete File Structure

```
bravo-ebay-hunter/
├── src/                          # React frontend
│   ├── pages/
│   │   ├── Dashboard.tsx         # Overview, stats, market prices
│   │   ├── Matches.tsx           # View found items
│   │   ├── Tasks.tsx             # Create/edit tasks
│   │   └── Settings.tsx          # API keys, notifications
│   ├── components/
│   │   ├── tasks/
│   │   │   ├── TaskForm.tsx      # Task creation form
│   │   │   └── TaskTemplates.tsx # Pre-built task templates
│   │   ├── matches/
│   │   │   ├── MatchActions.tsx  # Status update buttons
│   │   │   └── MatchDetailsPanel.tsx
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx    # App shell
│   │   │   └── Sidebar.tsx       # Navigation
│   │   └── ui/                   # Reusable UI components
│   ├── hooks/
│   │   ├── useMatches.ts         # Fetch & subscribe to matches
│   │   ├── useTasks.ts           # Fetch & manage tasks
│   │   └── usePriceHistory.ts    # Metal price charts
│   ├── contexts/
│   │   └── AuthContext.tsx       # User authentication
│   └── integrations/
│       └── supabase/
│           ├── client.ts         # Supabase client
│           └── types.ts          # Generated types
├── worker/                       # Node.js scanner
│   ├── index.js                  # Main worker code (~2100 lines)
│   ├── logs/                     # Log files
│   ├── .env                      # API credentials
│   └── package.json              # Worker dependencies
├── supabase/
│   ├── migrations/               # Database schema
│   │   ├── 20250629_initial.sql  # Tables, RLS, indexes
│   │   ├── 20251216_*.sql        # Feature additions
│   │   └── 20251217_*.sql        # Recent changes
│   └── functions/
│       └── get-gold-prices/      # Edge function for metal prices
│           └── index.ts
├── docs/                         # Documentation
│   └── system-architecture.md    # This file
├── package.json                  # Frontend dependencies
├── vite.config.ts                # Vite configuration
└── tailwind.config.ts            # Tailwind CSS configuration
```

---

## 6. API Rate Limits & Usage

### eBay Browse API
- **Daily limit:** 5,000 calls per API key
- **Per-second limit:** ~5 calls/second (undocumented, causes 429 errors)

### API Calls Per Poll Cycle

| Action | Calls |
|--------|-------|
| Search (per metal type) | 1 |
| Item details (per new item) | 1 |

### Example Usage (1 task, 5 metals, 60-second polling)

```
Per poll:
  - 5 search calls (one per metal)
  - ~10 item detail calls (new items only, cached skip)
  = ~15 calls per poll

Per hour: 15 × 60 = 900 calls
Per day: 900 × 24 = 21,600 calls

Keys needed: 21,600 / 5,000 = 5 keys (with buffer)
```

---

## 7. Environment Variables

### Worker (`worker/.env`)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SLACK_WEBHOOK_URL=https://hooks.slack.com/... (optional)
```

### Frontend (via Supabase integration)
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 8. Running the System

### Start Frontend
```bash
cd bravo-ebay-hunter
npm install
npm run dev
# Opens at http://localhost:8080
```

### Start Worker
```bash
cd bravo-ebay-hunter/worker
npm install
node index.js
# Polls eBay at configured interval
```

### Deploy Edge Functions
```bash
npx supabase functions deploy get-gold-prices
```
