import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Server,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Database,
  TrendingUp
} from 'lucide-react';
import { useHealthMetrics, HealthMetric } from '@/hooks/useHealthMetrics';

const HealthCheck = () => {
  const { recentMetrics, apiKeys, summary, loading, lastRefresh, refetch } = useHealthMetrics();

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getWorkerStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 border-green-200';
      case 'stopped': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getWorkerStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4" />;
      case 'stopped': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getApiKeyStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'rate_limited': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLastPollColor = () => {
    if (!summary?.lastPollTime) return 'text-gray-500';
    const seconds = (new Date().getTime() - summary.lastPollTime.getTime()) / 1000;
    if (seconds < 120) return 'text-green-600';
    if (seconds < 300) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Health Check</h1>
          <p className="text-gray-600">Loading system status...</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Health Check</h1>
          <p className="text-gray-600">Monitor worker status and system health</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last refresh: {formatTimeAgo(lastRefresh)}
          </span>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Worker Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Worker Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${getWorkerStatusColor(summary?.workerStatus || 'unknown')} flex items-center gap-1`}
              >
                {getWorkerStatusIcon(summary?.workerStatus || 'unknown')}
                {summary?.workerStatus || 'Unknown'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {summary?.isHealthy ? 'All systems operational' : 'Check status below'}
            </p>
          </CardContent>
        </Card>

        {/* Last Poll */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Poll</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getLastPollColor()}`}>
              {formatTimeAgo(summary?.lastPollTime || null)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg cycle: {formatDuration(summary?.avgCycleDuration || 0)}
            </p>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.apiKeysActive || 0} / {summary?.apiKeysTotal || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.apiKeysRateLimited || 0} rate limited
            </p>
          </CardContent>
        </Card>

        {/* 24h Matches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Matches</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.totalMatches24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.totalItemsFound24h || 0} items scanned
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.avgMemoryUsage || 0).toFixed(1)} MB
            </div>
            <p className="text-xs text-muted-foreground">Average heap usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary?.errorRate || 0) > 10 ? 'text-red-600' : 'text-green-600'}`}>
              {(summary?.errorRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Task failures (24h)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Excluded</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.totalExcluded24h || 0}
            </div>
            <p className="text-xs text-muted-foreground">Filtered by criteria (24h)</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Poll Cycles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Poll Cycles
          </CardTitle>
          <CardDescription>Last 10 worker poll cycles</CardDescription>
        </CardHeader>
        <CardContent>
          {recentMetrics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No health metrics recorded yet. Worker may not be running.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-4 text-sm font-medium text-gray-500 border-b pb-2">
                <div>Time</div>
                <div>Duration</div>
                <div>Tasks</div>
                <div>Items Found</div>
                <div>Matches</div>
                <div>Excluded</div>
              </div>
              {recentMetrics.slice(0, 10).map((metric: HealthMetric) => (
                <div key={metric.id} className="grid grid-cols-6 gap-4 text-sm py-2 border-b border-gray-100">
                  <div className="text-gray-600">
                    {new Date(metric.cycle_timestamp).toLocaleTimeString()}
                  </div>
                  <div>{formatDuration(metric.cycle_duration_ms)}</div>
                  <div>
                    {metric.tasks_processed}
                    {metric.tasks_failed > 0 && (
                      <span className="text-red-500 ml-1">({metric.tasks_failed} failed)</span>
                    )}
                  </div>
                  <div>{metric.total_items_found}</div>
                  <div className="text-green-600 font-medium">{metric.total_matches}</div>
                  <div className="text-gray-500">{metric.total_excluded}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys Status
          </CardTitle>
          <CardDescription>eBay API key health and usage</CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No API keys configured.
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{key.label || `API Key ${index + 1}`}</span>
                    <span className="text-sm text-gray-500">
                      {key.app_id?.substring(0, 12)}...
                    </span>
                  </div>
                  <Badge className={getApiKeyStatusColor(key.status)}>
                    {key.status || 'unknown'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthCheck;
