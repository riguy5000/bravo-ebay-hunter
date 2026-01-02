import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMatches, type Match } from '@/hooks/useMatches';
import { Eye, ShoppingCart, RotateCcw, Package, RefreshCw, Watch, Gem, CircleDot, Radio, AlertTriangle, AlertCircle, CheckCircle, XCircle, Trash2, Pencil, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from 'sonner';
import { MatchActions, type MatchStatus } from '@/components/matches/MatchActions';
import { MatchDetailsPanel } from '@/components/matches/MatchDetailsPanel';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useTasks, type Task } from '@/hooks/useTasks';

const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100, 200];

const Matches = () => {
  const { taskGroups, loading, isFetching, totalCount, updateMatch, refetch } = useMatches();
  const { deleteTask } = useTasks();
  const [activeTaskId, setActiveTaskId] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (confirm(`Are you sure you want to delete "${taskName}"? This will also delete all matches and remove its automatic schedule.`)) {
      try {
        await deleteTask(taskId);
        toast.success('Task deleted successfully');
        // Switch to another task if the deleted one was active
        if (activeTaskId === taskId) {
          const remaining = taskGroups.filter(g => g.task.id !== taskId);
          setActiveTaskId(remaining[0]?.task.id || '');
        }
        refetch();
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete task');
      }
    }
  };

  // Set default active task to first task with matches, or first task
  React.useEffect(() => {
    if (taskGroups.length > 0 && !activeTaskId) {
      const taskWithMatches = taskGroups.find(g => g.matchCount > 0);
      setActiveTaskId(taskWithMatches?.task.id || taskGroups[0].task.id);
    }
  }, [taskGroups, activeTaskId]);

  // Reset to page 1 when switching tasks
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTaskId]);

  // Get active group and paginate matches
  const activeGroup = useMemo(() => {
    return taskGroups.find(g => g.task.id === activeTaskId);
  }, [taskGroups, activeTaskId]);

  const paginatedMatches = useMemo(() => {
    if (!activeGroup) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return activeGroup.matches.slice(startIndex, endIndex);
  }, [activeGroup, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (!activeGroup) return 1;
    return Math.ceil(activeGroup.matches.length / itemsPerPage);
  }, [activeGroup, itemsPerPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Eye className="h-4 w-4" />;
      case 'purchased': return <ShoppingCart className="h-4 w-4" />;
      case 'reviewed': return <RotateCcw className="h-4 w-4" />;
      case 'offered': return <Package className="h-4 w-4" />;
      case 'passed': return <XCircle className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'purchased': return 'bg-green-100 text-green-800';
      case 'reviewed': return 'bg-yellow-100 text-yellow-800';
      case 'offered': return 'bg-purple-100 text-purple-800';
      case 'passed': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleRowExpansion = (matchId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
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
  const getPriority = (totalCost: number, meltValue: number | undefined) => {
    if (!meltValue || !totalCost || totalCost === 0) return null;
    const profitMargin = ((meltValue - totalCost) / totalCost) * 100;

    if (profitMargin > 50) {
      return { level: 'High', color: 'bg-green-100 text-green-800 border-green-300', icon: <CheckCircle className="h-3 w-3" />, margin: profitMargin };
    } else if (profitMargin >= 25) {
      return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <AlertCircle className="h-3 w-3" />, margin: profitMargin };
    } else {
      return { level: 'Low', color: 'bg-red-100 text-red-800 border-red-300', icon: <AlertTriangle className="h-3 w-3" />, margin: profitMargin };
    }
  };

  const handleStatusUpdate = async (
    match: Match,
    newStatus: MatchStatus,
    itemType: string,
    offerAmount?: number
  ) => {
    try {
      const updates: any = { status: newStatus };

      // If offer amount provided, store it in the next available offer field
      if (offerAmount && (newStatus === 'offered' || newStatus === 'purchased')) {
        if (!match.offer1) updates.offer1 = offerAmount;
        else if (!match.offer2) updates.offer2 = offerAmount;
        else if (!match.offer3) updates.offer3 = offerAmount;
        else if (!match.offer4) updates.offer4 = offerAmount;
        else updates.offer5 = offerAmount;
      }

      await updateMatch(match.id, itemType, updates);

      const statusMessages: Record<MatchStatus, string> = {
        new: 'Reverted to new',
        reviewed: 'Marked as reviewed',
        offered: offerAmount ? `Offer of $${offerAmount.toFixed(2)} recorded` : 'Marked as offered',
        purchased: offerAmount ? `Purchased for $${offerAmount.toFixed(2)}` : 'Marked as purchased',
        passed: 'Marked as passed',
      };

      toast.success(statusMessages[newStatus]);
    } catch (error) {
      console.error('Failed to update match status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleToggleChange = async (match: Match, itemType: string, field: string, value: boolean) => {
    try {
      await updateMatch(match.id, itemType, { [field]: value } as any);
      toast.success(`${field.replace('_toggle', '').replace('_', ' ')} ${value ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update toggle:', error);
      toast.error('Failed to update');
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
            <TableHead className="w-[120px]">Total Cost</TableHead>
            <TableHead className="w-[100px]">Break Even (97%)</TableHead>
            <TableHead className="w-[100px]">Offer (87%)</TableHead>
            <TableHead className="w-[100px]">Profit</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => {
            const meltValue = 'melt_value' in match ? match.melt_value : undefined;
            const shippingCost = match.shipping_cost ?? null; // Keep null to distinguish from 0
            const totalCost = match.listed_price + (shippingCost || 0);
            const breakEven = meltValue ? meltValue * 0.97 : null; // 97% of melt value (refiner payout)
            const suggestedOffer = meltValue ? meltValue * 0.87 : null; // 87% of melt value (your offer)
            const profit = breakEven ? breakEven - totalCost : null;
            const priority = getPriority(totalCost, breakEven ?? undefined);
            const karat = 'karat' in match ? match.karat : undefined;
            const weightG = 'weight_g' in match ? match.weight_g : undefined;

            const isExpanded = expandedRows.has(match.id);

            return (
              <React.Fragment key={match.id}>
                <TableRow className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}>
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
                        Scanned: {new Date(match.found_at).toLocaleString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{karat ? `${karat}K` : '-'}</TableCell>
                  <TableCell>{weightG ? `${weightG.toFixed(2)}g` : '-'}</TableCell>
                  <TableCell className="font-semibold">${totalCost.toLocaleString()}</TableCell>
                  <TableCell className="text-green-700 font-semibold">
                    {breakEven ? `$${breakEven.toFixed(0)}` : '-'}
                  </TableCell>
                  <TableCell className="text-blue-700 font-semibold">
                    {suggestedOffer ? `$${suggestedOffer.toFixed(0)}` : '-'}
                  </TableCell>
                  <TableCell className={`font-semibold ${profit && profit > 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {profit ? (
                      <div>
                        <div>${profit.toFixed(0)}</div>
                        <div className="text-xs opacity-75">
                          {totalCost > 0 ? `${((profit / totalCost) * 100).toFixed(0)}%` : '-'}
                        </div>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${getStatusColor(match.status)} text-xs`}>
                      {match.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <MatchActions
                      matchId={match.id}
                      currentStatus={match.status}
                      itemType={itemType}
                      suggestedOffer={suggestedOffer ?? undefined}
                      currentOffers={{
                        offer1: match.offer1,
                        offer2: match.offer2,
                        offer3: match.offer3,
                        offer4: match.offer4,
                        offer5: match.offer5,
                      }}
                      onStatusChange={(newStatus, offerAmount) =>
                        handleStatusUpdate(match, newStatus, itemType, offerAmount)
                      }
                      onExpandDetails={() => toggleRowExpansion(match.id)}
                    />
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <MatchDetailsPanel
                    matchId={match.id}
                    offers={{
                      offer1: match.offer1,
                      offer2: match.offer2,
                      offer3: match.offer3,
                      offer4: match.offer4,
                      offer5: match.offer5,
                    }}
                    toggles={{
                      purchased_toggle: match.purchased_toggle,
                      arrived_toggle: match.arrived_toggle,
                      return_toggle: match.return_toggle,
                      shipped_back_toggle: match.shipped_back_toggle,
                      refunded_toggle: match.refunded_toggle,
                    }}
                    onToggleChange={(field, value) =>
                      handleToggleChange(match, itemType, field, value)
                    }
                    colSpan={11}
                  />
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderGemstoneTable = (matches: Match[], itemType: string) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[80px]">Deal</TableHead>
            <TableHead className="w-[80px]">Risk</TableHead>
            <TableHead className="w-[120px]">Item ID</TableHead>
            <TableHead className="min-w-[250px]">Title</TableHead>
            <TableHead className="w-[100px]">Stone</TableHead>
            <TableHead className="w-[70px]">Carat</TableHead>
            <TableHead className="w-[100px]">Price</TableHead>
            <TableHead className="w-[80px]">Cert</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => {
            const isExpanded = expandedRows.has(match.id);
            const stoneType = 'stone_type' in match ? match.stone_type : undefined;
            const carat = 'carat' in match ? match.carat : undefined;
            const dealScore = 'deal_score' in match ? match.deal_score : undefined;
            const riskScore = 'risk_score' in match ? match.risk_score : undefined;
            const certLab = 'cert_lab' in match ? match.cert_lab : undefined;
            const shippingCost = match.shipping_cost ?? null; // Keep null to distinguish from 0
            const totalCost = match.listed_price + (shippingCost || 0);

            const getDealScoreColor = (score?: number) => {
              if (!score) return 'bg-gray-100 text-gray-600';
              if (score >= 70) return 'bg-green-100 text-green-800';
              if (score >= 50) return 'bg-yellow-100 text-yellow-800';
              return 'bg-red-100 text-red-800';
            };

            const getRiskScoreColor = (score?: number) => {
              if (!score) return 'bg-gray-100 text-gray-600';
              if (score <= 30) return 'bg-green-100 text-green-800';
              if (score <= 60) return 'bg-yellow-100 text-yellow-800';
              return 'bg-red-100 text-red-800';
            };

            return (
              <React.Fragment key={match.id}>
                <TableRow className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}>
                  <TableCell>
                    <Badge variant="outline" className={`${getDealScoreColor(dealScore)} text-xs`}>
                      {dealScore ?? '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getRiskScoreColor(riskScore)} text-xs`}>
                      {riskScore ?? '-'}
                    </Badge>
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
                        Scanned: {new Date(match.found_at).toLocaleString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{stoneType || '-'}</TableCell>
                  <TableCell className="font-semibold">{carat ? `${carat}ct` : '-'}</TableCell>
                  <TableCell className="font-semibold">${totalCost.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {certLab || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${getStatusColor(match.status)} text-xs`}>
                      {match.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <MatchActions
                      matchId={match.id}
                      currentStatus={match.status}
                      itemType={itemType}
                      currentOffers={{
                        offer1: match.offer1,
                        offer2: match.offer2,
                        offer3: match.offer3,
                        offer4: match.offer4,
                        offer5: match.offer5,
                      }}
                      onStatusChange={(newStatus, offerAmount) =>
                        handleStatusUpdate(match, newStatus, itemType, offerAmount)
                      }
                      onExpandDetails={() => toggleRowExpansion(match.id)}
                    />
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <MatchDetailsPanel
                    matchId={match.id}
                    offers={{
                      offer1: match.offer1,
                      offer2: match.offer2,
                      offer3: match.offer3,
                      offer4: match.offer4,
                      offer5: match.offer5,
                    }}
                    toggles={{
                      purchased_toggle: match.purchased_toggle,
                      arrived_toggle: match.arrived_toggle,
                      return_toggle: match.return_toggle,
                      shipped_back_toggle: match.shipped_back_toggle,
                      refunded_toggle: match.refunded_toggle,
                    }}
                    onToggleChange={(field, value) =>
                      handleToggleChange(match, itemType, field, value)
                    }
                    colSpan={10}
                  />
                )}
              </React.Fragment>
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
          {matches.map((match) => {
            const isExpanded = expandedRows.has(match.id);
            const shippingCost = match.shipping_cost ?? null;
            const totalCost = match.listed_price + (shippingCost || 0);

            return (
              <React.Fragment key={match.id}>
                <TableRow className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}>
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
                        Scanned: {new Date(match.found_at).toLocaleString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">${totalCost.toLocaleString()}</TableCell>
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
                    <MatchActions
                      matchId={match.id}
                      currentStatus={match.status}
                      itemType={itemType}
                      currentOffers={{
                        offer1: match.offer1,
                        offer2: match.offer2,
                        offer3: match.offer3,
                        offer4: match.offer4,
                        offer5: match.offer5,
                      }}
                      onStatusChange={(newStatus, offerAmount) =>
                        handleStatusUpdate(match, newStatus, itemType, offerAmount)
                      }
                      onExpandDetails={() => toggleRowExpansion(match.id)}
                    />
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <MatchDetailsPanel
                    matchId={match.id}
                    offers={{
                      offer1: match.offer1,
                      offer2: match.offer2,
                      offer3: match.offer3,
                      offer4: match.offer4,
                      offer5: match.offer5,
                    }}
                    toggles={{
                      purchased_toggle: match.purchased_toggle,
                      arrived_toggle: match.arrived_toggle,
                      return_toggle: match.return_toggle,
                      shipped_back_toggle: match.shipped_back_toggle,
                      refunded_toggle: match.refunded_toggle,
                    }}
                    onToggleChange={(field, value) =>
                      handleToggleChange(match, itemType, field, value)
                    }
                    colSpan={7}
                  />
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return <div className="p-6">Loading matches...</div>;
  }

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
          <Button onClick={refetch} variant="outline" size="sm" disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
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
                        {group.matchCount > itemsPerPage && ` • Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, group.matchCount)}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTask(group.task as Task)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Task
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteTask(group.task.id, group.task.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Task
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {group.matches.length > 0 ? (
                    <>
                      {group.task.item_type === 'jewelry'
                        ? renderJewelryTable(group.task.id === activeTaskId ? paginatedMatches : group.matches.slice(0, itemsPerPage), group.task.item_type)
                        : group.task.item_type === 'gemstone'
                        ? renderGemstoneTable(group.task.id === activeTaskId ? paginatedMatches : group.matches.slice(0, itemsPerPage), group.task.item_type)
                        : renderGenericTable(group.task.id === activeTaskId ? paginatedMatches : group.matches.slice(0, itemsPerPage), group.task.item_type)
                      }

                      {/* Pagination Controls */}
                      {group.matchCount > 25 && group.task.id === activeTaskId && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Items per page:</span>
                            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                              <SelectTrigger className="w-20 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                                  <SelectItem key={opt} value={opt.toString()}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePageChange(1)}
                              disabled={currentPage === 1}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <span className="px-3 text-sm text-gray-600">
                              Page {currentPage} of {totalPages}
                            </span>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePageChange(totalPages)}
                              disabled={currentPage === totalPages}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronsRight className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="text-sm text-gray-600">
                            {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, group.matchCount)} of {group.matchCount}
                          </div>
                        </div>
                      )}
                    </>
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

      {/* Edit Task Dialog */}
      <Dialog open={editingTask !== null} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task: {editingTask?.name}</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              editingTask={editingTask}
              onSuccess={() => {
                setEditingTask(null);
                refetch();
                toast.success('Task updated successfully');
              }}
              onCancel={() => setEditingTask(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Matches;
