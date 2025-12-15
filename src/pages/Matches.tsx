import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMatches, type Match } from '@/hooks/useMatches';
import { Eye, ShoppingCart, RotateCcw, Package, Brain, TrendingUp, RefreshCw, Watch, Gem, CircleDot, Radio } from 'lucide-react';

const Matches = () => {
  const { taskGroups, loading, totalCount, updateMatch, refetch } = useMatches();
  const [activeTaskId, setActiveTaskId] = useState<string>('');

  // Set default active task to first task with matches, or first task
  React.useEffect(() => {
    if (taskGroups.length > 0 && !activeTaskId) {
      const taskWithMatches = taskGroups.find(g => g.matchCount > 0);
      setActiveTaskId(taskWithMatches?.task.id || taskGroups[0].task.id);
    }
  }, [taskGroups, activeTaskId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Eye className="h-4 w-4" />;
      case 'purchased': return <ShoppingCart className="h-4 w-4" />;
      case 'reviewed': return <RotateCcw className="h-4 w-4" />;
      case 'offered': return <Package className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'purchased': return 'bg-green-100 text-green-800';
      case 'reviewed': return 'bg-yellow-100 text-yellow-800';
      case 'offered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getItemTypeIcon = (itemType: string) => {
    switch (itemType) {
      case 'watch': return <Watch className="h-4 w-4" />;
      case 'jewelry': return <Gem className="h-4 w-4" />;
      case 'gemstone': return <CircleDot className="h-4 w-4" />;
      default: return null;
    }
  };

  const handleStatusUpdate = async (match: Match, newStatus: string, itemType: string) => {
    try {
      await updateMatch(match.id, itemType, { status: newStatus as any });
    } catch (error) {
      console.error('Failed to update match status:', error);
    }
  };

  const renderAIAnalysis = (match: Match) => {
    if (!match.ai_score && !match.ai_reasoning) return null;

    return (
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">AI Analysis</span>
          {match.ai_score && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Quality: {match.ai_score}/100
            </Badge>
          )}
        </div>
        {match.ai_reasoning && (
          <p className="text-xs text-blue-700">{match.ai_reasoning}</p>
        )}

        {'profit_scrap' in match && match.profit_scrap && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-green-700">
              Scrap Profit: ${match.profit_scrap.toFixed(2)}
              {match.melt_value && ` (Melt: $${match.melt_value.toFixed(2)})`}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderMatchCard = (match: Match, itemType: string) => (
    <div key={match.id} className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-sm">{match.ebay_title}</h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="font-semibold">${match.listed_price?.toLocaleString()}</span>
            {match.buy_format && (
              <Badge variant="outline" className="text-xs">
                {match.buy_format}
              </Badge>
            )}
            {match.seller_feedback && <span>Feedback: {match.seller_feedback}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Found: {new Date(match.created_at).toLocaleDateString()}
          </div>
        </div>
        <Badge variant="secondary" className={`${getStatusColor(match.status)} flex items-center gap-1`}>
          {getStatusIcon(match.status)}
          {match.status}
        </Badge>
      </div>

      {renderAIAnalysis(match)}

      <div className="flex gap-2 pt-2">
        {match.ebay_url && (
          <Button size="sm" variant="outline" asChild>
            <a href={match.ebay_url} target="_blank" rel="noopener noreferrer">
              View Listing
            </a>
          </Button>
        )}
        {match.status === 'new' && (
          <Button
            size="sm"
            onClick={() => handleStatusUpdate(match, 'purchased', itemType)}
          >
            Mark Purchased
          </Button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="p-6">Loading matches...</div>;
  }

  const activeGroup = taskGroups.find(g => g.task.id === activeTaskId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
          <p className="text-gray-600">
            {totalCount} total matches across {taskGroups.length} tasks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1.5">
            <Radio className="h-3 w-3 animate-pulse" />
            Live
          </Badge>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {taskGroups.length > 0 ? (
        <Tabs value={activeTaskId} onValueChange={setActiveTaskId} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
            {taskGroups.map(group => (
              <TabsTrigger
                key={group.task.id}
                value={group.task.id}
                className="flex items-center gap-2 px-3 py-2"
              >
                {getItemTypeIcon(group.task.item_type)}
                <span className="truncate max-w-[150px]">{group.task.name}</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {group.matchCount}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {taskGroups.map(group => (
            <TabsContent key={group.task.id} value={group.task.id} className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {group.task.name}
                        <Badge variant="outline" className="text-xs">
                          {group.task.item_type}
                        </Badge>
                        {group.task.status !== 'active' && (
                          <Badge variant="secondary" className="text-xs">
                            {group.task.status}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {group.task.max_price && `Max price: $${group.task.max_price} • `}
                        {group.matchCount} {group.matchCount === 1 ? 'match' : 'matches'} found
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {group.matches.length > 0 ? (
                    <div className="space-y-4">
                      {group.matches.map((match) => renderMatchCard(match, group.task.item_type))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 py-4 text-center">
                      No matches found yet. The worker will scan eBay for items matching this task's criteria.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              No tasks found. Create a task to start finding matches!
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Matches;
