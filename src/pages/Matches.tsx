import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMatches, type Match } from '@/hooks/useMatches';
import { Eye, ShoppingCart, RotateCcw, Package, RefreshCw, Watch, Gem, CircleDot, Radio, AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

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

  // Calculate priority based on profit margin percentage
  const getPriority = (listedPrice: number, meltValue: number | undefined) => {
    if (!meltValue || !listedPrice || listedPrice === 0) return null;
    const profitMargin = ((meltValue - listedPrice) / listedPrice) * 100;

    if (profitMargin > 50) {
      return { level: 'High', color: 'bg-green-100 text-green-800 border-green-300', icon: <CheckCircle className="h-3 w-3" />, margin: profitMargin };
    } else if (profitMargin >= 25) {
      return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <AlertCircle className="h-3 w-3" />, margin: profitMargin };
    } else {
      return { level: 'Low', color: 'bg-red-100 text-red-800 border-red-300', icon: <AlertTriangle className="h-3 w-3" />, margin: profitMargin };
    }
  };

  const handleStatusUpdate = async (match: Match, newStatus: string, itemType: string) => {
    try {
      await updateMatch(match.id, itemType, { status: newStatus as any });
    } catch (error) {
      console.error('Failed to update match status:', error);
    }
  };

  const renderJewelryTable = (matches: Match[], itemType: string) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[100px]">Priority</TableHead>
            <TableHead className="w-[120px]">Item ID</TableHead>
            <TableHead className="min-w-[250px]">Title</TableHead>
            <TableHead className="w-[60px]">Karat</TableHead>
            <TableHead className="w-[80px]">Weight</TableHead>
            <TableHead className="w-[100px]">Price</TableHead>
            <TableHead className="w-[100px]">Break Even</TableHead>
            <TableHead className="w-[100px]">Offer (50%)</TableHead>
            <TableHead className="w-[100px]">Profit</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => {
            const meltValue = 'melt_value' in match ? match.melt_value : undefined;
            const suggestedOffer = meltValue ? meltValue * 0.5 : null;
            const priority = getPriority(match.listed_price, meltValue);
            const profitScrap = 'profit_scrap' in match ? match.profit_scrap : undefined;
            const karat = 'karat' in match ? match.karat : undefined;
            const weightG = 'weight_g' in match ? match.weight_g : undefined;

            return (
              <TableRow key={match.id} className="hover:bg-gray-50">
                <TableCell>
                  {priority ? (
                    <Badge variant="outline" className={`${priority.color} flex items-center gap-1 text-xs whitespace-nowrap`}>
                      {priority.icon}
                      {priority.level}
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-xs">N/A</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{match.ebay_listing_id}</TableCell>
                <TableCell>
                  <div className="max-w-[300px]">
                    {match.ebay_url ? (
                      <a
                        href={match.ebay_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium truncate block text-blue-600 hover:text-blue-800 hover:underline"
                        title={match.ebay_title}
                      >
                        {match.ebay_title}
                      </a>
                    ) : (
                      <p className="text-sm font-medium truncate" title={match.ebay_title}>
                        {match.ebay_title}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(match.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{karat ? `${karat}K` : '-'}</TableCell>
                <TableCell>{weightG ? `${weightG.toFixed(1)}g` : '-'}</TableCell>
                <TableCell className="font-semibold">${match.listed_price?.toLocaleString()}</TableCell>
                <TableCell className="text-green-700 font-semibold">
                  {meltValue ? `$${meltValue.toFixed(0)}` : '-'}
                </TableCell>
                <TableCell className="text-blue-700 font-semibold">
                  {suggestedOffer ? `$${suggestedOffer.toFixed(0)}` : '-'}
                </TableCell>
                <TableCell className={`font-semibold ${profitScrap && profitScrap > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {profitScrap ? `$${profitScrap.toFixed(0)}` : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`${getStatusColor(match.status)} text-xs`}>
                    {match.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {match.ebay_url && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                        <a href={match.ebay_url} target="_blank" rel="noopener noreferrer" title="View Listing">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {match.status === 'new' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleStatusUpdate(match, 'purchased', itemType)}
                        title="Mark Purchased"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderGenericTable = (matches: Match[], itemType: string) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[120px]">Item ID</TableHead>
            <TableHead className="min-w-[300px]">Title</TableHead>
            <TableHead className="w-[100px]">Price</TableHead>
            <TableHead className="w-[100px]">Format</TableHead>
            <TableHead className="w-[100px]">Feedback</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => (
            <TableRow key={match.id} className="hover:bg-gray-50">
              <TableCell className="font-mono text-xs">{match.ebay_listing_id}</TableCell>
              <TableCell>
                <div>
                  {match.ebay_url ? (
                    <a
                      href={match.ebay_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate max-w-[350px] block text-blue-600 hover:text-blue-800 hover:underline"
                      title={match.ebay_title}
                    >
                      {match.ebay_title}
                    </a>
                  ) : (
                    <p className="text-sm font-medium truncate max-w-[350px]" title={match.ebay_title}>
                      {match.ebay_title}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {new Date(match.created_at).toLocaleDateString()}
                  </p>
                </div>
              </TableCell>
              <TableCell className="font-semibold">${match.listed_price?.toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {match.buy_format || 'N/A'}
                </Badge>
              </TableCell>
              <TableCell>{match.seller_feedback || '-'}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={`${getStatusColor(match.status)} text-xs`}>
                  {match.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {match.ebay_url && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                      <a href={match.ebay_url} target="_blank" rel="noopener noreferrer" title="View Listing">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {match.status === 'new' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleStatusUpdate(match, 'purchased', itemType)}
                      title="Mark Purchased"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
                <CardContent className="p-0">
                  {group.matches.length > 0 ? (
                    group.task.item_type === 'jewelry'
                      ? renderJewelryTable(group.matches, group.task.item_type)
                      : renderGenericTable(group.matches, group.task.item_type)
                  ) : (
                    <div className="text-sm text-gray-500 py-8 text-center">
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
