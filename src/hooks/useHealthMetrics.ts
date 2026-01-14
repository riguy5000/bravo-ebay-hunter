import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface HealthMetric {
  id: string;
  worker_id: string;
  cycle_timestamp: string;
  cycle_duration_ms: number;
  tasks_processed: number;
  tasks_failed: number;
  total_items_found: number;
  total_matches: number;
  total_excluded: number;
  memory_usage_mb: number;
  api_key_used: string | null;
  created_at: string;
}

export interface ApiKeyStatus {
  label: string;
  app_id: string;
  status: 'active' | 'rate_limited' | 'error' | 'unknown';
  calls_today?: number;
}

export interface HealthSummary {
  lastPollTime: Date | null;
  isHealthy: boolean;
  workerStatus: 'running' | 'stopped' | 'unknown';
  totalMatches24h: number;
  totalExcluded24h: number;
  totalItemsFound24h: number;
  avgCycleDuration: number;
  avgMemoryUsage: number;
  errorRate: number;
  apiKeysActive: number;
  apiKeysRateLimited: number;
  apiKeysTotal: number;
}

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

export const useHealthMetrics = () => {
  const { user } = useAuth();
  const [recentMetrics, setRecentMetrics] = useState<HealthMetric[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyStatus[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchMetrics = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch recent health metrics (last 100 cycles)
      const { data: metricsData, error: metricsError } = await supabase
        .from('worker_health_metrics')
        .select('*')
        .order('cycle_timestamp', { ascending: false })
        .limit(100);

      if (metricsError) {
        console.error('Error fetching health metrics:', metricsError);
      } else {
        setRecentMetrics((metricsData as HealthMetric[]) || []);
      }

      // Fetch API keys from settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value_json')
        .eq('key', 'ebay_keys')
        .single();

      if (settingsError) {
        console.error('Error fetching API keys:', settingsError);
      } else if (settingsData?.value_json) {
        const keysConfig = settingsData.value_json as unknown as { keys: ApiKeyStatus[] };
        setApiKeys(keysConfig.keys || []);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error in fetchMetrics:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calculate summary from metrics
  useEffect(() => {
    if (recentMetrics.length === 0) {
      setSummary(null);
      return;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    // Filter metrics from last 24 hours
    const metrics24h = recentMetrics.filter(
      m => new Date(m.cycle_timestamp) > oneDayAgo
    );

    // Get the latest metric
    const latestMetric = recentMetrics[0];
    const lastPollTime = latestMetric ? new Date(latestMetric.cycle_timestamp) : null;

    // Determine worker status
    let workerStatus: 'running' | 'stopped' | 'unknown' = 'unknown';
    if (lastPollTime) {
      if (lastPollTime > twoMinutesAgo) {
        workerStatus = 'running';
      } else if (lastPollTime > fiveMinutesAgo) {
        workerStatus = 'running'; // Still considered running if within 5 min
      } else {
        workerStatus = 'stopped';
      }
    }

    // Calculate aggregates
    const totalMatches24h = metrics24h.reduce((sum, m) => sum + (m.total_matches || 0), 0);
    const totalExcluded24h = metrics24h.reduce((sum, m) => sum + (m.total_excluded || 0), 0);
    const totalItemsFound24h = metrics24h.reduce((sum, m) => sum + (m.total_items_found || 0), 0);

    const avgCycleDuration = metrics24h.length > 0
      ? metrics24h.reduce((sum, m) => sum + (m.cycle_duration_ms || 0), 0) / metrics24h.length
      : 0;

    const avgMemoryUsage = metrics24h.length > 0
      ? metrics24h.reduce((sum, m) => sum + (m.memory_usage_mb || 0), 0) / metrics24h.length
      : 0;

    const totalTasks = metrics24h.reduce((sum, m) => sum + (m.tasks_processed || 0) + (m.tasks_failed || 0), 0);
    const totalFailed = metrics24h.reduce((sum, m) => sum + (m.tasks_failed || 0), 0);
    const errorRate = totalTasks > 0 ? (totalFailed / totalTasks) * 100 : 0;

    // API keys status
    const apiKeysActive = apiKeys.filter(k => k.status === 'active').length;
    const apiKeysRateLimited = apiKeys.filter(k => k.status === 'rate_limited').length;

    // Determine overall health
    const isHealthy = workerStatus === 'running' && errorRate < 10 && apiKeysActive > 0;

    setSummary({
      lastPollTime,
      isHealthy,
      workerStatus,
      totalMatches24h,
      totalExcluded24h,
      totalItemsFound24h,
      avgCycleDuration,
      avgMemoryUsage,
      errorRate,
      apiKeysActive,
      apiKeysRateLimited,
      apiKeysTotal: apiKeys.length,
    });
  }, [recentMetrics, apiKeys]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchMetrics();
    }
  }, [user, fetchMetrics]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [user, fetchMetrics]);

  return {
    recentMetrics,
    apiKeys,
    summary,
    loading,
    lastRefresh,
    refetch: fetchMetrics,
  };
};
