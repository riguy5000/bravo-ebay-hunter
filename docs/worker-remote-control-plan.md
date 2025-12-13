# Worker Remote Control - Implementation Plan

## Overview

Enable the web app to control the standalone worker running on a remote server (start, stop, restart) and view real-time logs.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Web App       │◄───────►│    Supabase     │◄───────►│   Worker        │
│   (Browser)     │         │   (Database +   │         │   (Server/VPS)  │
│                 │         │    Realtime)    │         │                 │
│ - Control Panel │         │ - worker_status │         │ - Polls eBay    │
│ - Log Viewer    │         │ - worker_logs   │         │ - Saves matches │
│ - Status Display│         │ - worker_cmds   │         │ - Listens cmds  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## Database Schema

### Table: worker_status
Tracks worker state and health.

```sql
CREATE TABLE worker_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id TEXT UNIQUE NOT NULL DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'stopped', -- 'running', 'stopped', 'error'
  last_heartbeat TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  poll_interval INTEGER DEFAULT 10,
  tasks_processed INTEGER DEFAULT 0,
  matches_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE worker_status ENABLE ROW LEVEL SECURITY;
```

### Table: worker_commands
Queue for commands sent from web app to worker.

```sql
CREATE TABLE worker_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command TEXT NOT NULL, -- 'start', 'stop', 'restart', 'update_config'
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE worker_commands ENABLE ROW LEVEL SECURITY;
```

### Table: worker_logs
Real-time log entries from worker.

```sql
CREATE TABLE worker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL, -- 'info', 'warn', 'error', 'debug'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_worker_logs_created_at ON worker_logs(created_at DESC);

-- Auto-cleanup old logs (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_worker_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM worker_logs WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE worker_logs ENABLE ROW LEVEL SECURITY;
```

## Worker Changes

### 1. Add Supabase Realtime subscription

```javascript
// worker/index.js additions

// Subscribe to commands
const commandSubscription = supabase
  .channel('worker-commands')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'worker_commands' },
    handleCommand
  )
  .subscribe();

async function handleCommand(payload) {
  const { command, id } = payload.new;

  switch (command) {
    case 'stop':
      isRunning = false;
      break;
    case 'start':
      isRunning = true;
      startPolling();
      break;
    case 'restart':
      isRunning = false;
      setTimeout(() => {
        isRunning = true;
        startPolling();
      }, 1000);
      break;
  }

  // Mark command as processed
  await supabase
    .from('worker_commands')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', id);
}
```

### 2. Add heartbeat mechanism

```javascript
// Send heartbeat every 30 seconds
setInterval(async () => {
  await supabase
    .from('worker_status')
    .upsert({
      worker_id: 'primary',
      status: isRunning ? 'running' : 'stopped',
      last_heartbeat: new Date().toISOString(),
      tasks_processed: totalTasksProcessed,
      matches_found: totalMatchesFound
    });
}, 30000);
```

### 3. Add log writing

```javascript
async function log(level, message, metadata = {}) {
  console.log(`[${level.toUpperCase()}] ${message}`);

  await supabase
    .from('worker_logs')
    .insert({
      level,
      message,
      metadata
    });
}

// Usage
await log('info', 'Processing task: Luxury Watch Hunt', { taskId: '123' });
await log('info', 'Found 200 items');
await log('info', 'Saved 5 new matches', { count: 5 });
```

## Web App Components

### 1. WorkerControlPanel component

Location: `src/components/worker/WorkerControlPanel.tsx`

```tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Square, RotateCcw } from 'lucide-react';

export function WorkerControlPanel() {
  const [status, setStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);

  // Subscribe to status changes
  useEffect(() => {
    const channel = supabase
      .channel('worker-status')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'worker_status' },
        (payload) => {
          setStatus(payload.new.status);
          setLastHeartbeat(new Date(payload.new.last_heartbeat));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendCommand = async (command: string) => {
    await supabase
      .from('worker_commands')
      .insert({ command });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className={`h-3 w-3 rounded-full ${
          status === 'running' ? 'bg-green-500' : 'bg-red-500'
        }`} />
        <span>Worker: {status}</span>

        <div className="flex gap-2 ml-auto">
          <Button onClick={() => sendCommand('start')} disabled={status === 'running'}>
            <Play className="h-4 w-4" />
          </Button>
          <Button onClick={() => sendCommand('stop')} disabled={status === 'stopped'}>
            <Square className="h-4 w-4" />
          </Button>
          <Button onClick={() => sendCommand('restart')}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

### 2. WorkerLogViewer component

Location: `src/components/worker/WorkerLogViewer.tsx`

```tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  id: string;
  level: string;
  message: string;
  created_at: string;
}

export function WorkerLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch recent logs
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('worker_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      setLogs(data?.reverse() || []);
    };
    fetchLogs();

    // Subscribe to new logs
    const channel = supabase
      .channel('worker-logs')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'worker_logs' },
        (payload) => {
          setLogs(prev => [...prev.slice(-99), payload.new as LogEntry]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">Worker Logs</h3>
      <ScrollArea className="h-64 bg-gray-900 rounded p-2 font-mono text-sm">
        {logs.map((log) => (
          <div key={log.id} className="py-0.5">
            <span className="text-gray-500">
              {new Date(log.created_at).toLocaleTimeString()}
            </span>
            {' '}
            <span className={getLevelColor(log.level)}>
              [{log.level.toUpperCase()}]
            </span>
            {' '}
            <span className="text-white">{log.message}</span>
          </div>
        ))}
        <div ref={scrollRef} />
      </ScrollArea>
    </Card>
  );
}
```

## Implementation Steps

### Phase 1: Database Setup
1. [ ] Create `worker_status` table
2. [ ] Create `worker_commands` table
3. [ ] Create `worker_logs` table
4. [ ] Set up RLS policies
5. [ ] Enable Realtime for all tables

### Phase 2: Worker Updates
1. [ ] Add Supabase Realtime subscription for commands
2. [ ] Implement command handlers (start/stop/restart)
3. [ ] Add heartbeat mechanism
4. [ ] Add log writing function
5. [ ] Replace console.log with log() function
6. [ ] Add graceful shutdown handling

### Phase 3: Web App Components
1. [ ] Create WorkerControlPanel component
2. [ ] Create WorkerLogViewer component
3. [ ] Add to Tasks page or create dedicated Worker page
4. [ ] Subscribe to Realtime updates
5. [ ] Handle connection status

### Phase 4: Testing & Polish
1. [ ] Test start/stop/restart commands
2. [ ] Test log streaming
3. [ ] Test heartbeat timeout detection
4. [ ] Add error handling
5. [ ] Add loading states
6. [ ] Style the components

## Considerations

### Heartbeat Timeout
If no heartbeat received for 60+ seconds, consider worker "dead":
```tsx
const isWorkerDead = lastHeartbeat &&
  (Date.now() - lastHeartbeat.getTime()) > 60000;
```

### Log Cleanup
Run cleanup function daily via pg_cron:
```sql
SELECT cron.schedule('cleanup-worker-logs', '0 0 * * *',
  'SELECT cleanup_old_worker_logs()');
```

### Multiple Workers
If scaling to multiple workers, add `worker_id` filtering to all queries.

### Security
- RLS policies should restrict access to authenticated users only
- Consider admin-only access for worker control

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Database | 1-2 hours |
| Phase 2: Worker | 2-3 hours |
| Phase 3: Web App | 3-4 hours |
| Phase 4: Testing | 1-2 hours |
| **Total** | **7-11 hours** |
