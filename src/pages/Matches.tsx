
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMatches, type WatchMatch, type JewelryMatch, type GemstoneMatch } from '@/hooks/useMatches';
import { Eye, ShoppingCart, RotateCcw, Package, Brain, TrendingUp, RefreshCw } from 'lucide-react';

const Matches = () => {
  const { 
    watchMatches, 
    jewelryMatches, 
    gemstoneMatches, 
    loading, 
    hasMore,
    loadMore,
    updateWatchMatch, 
    updateJewelryMatch, 
    updateGemstoneMatch,
    refetch
  } = useMatches();

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

  const handleWatchStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateWatchMatch(id, { status: newStatus as any });
    } catch (error) {
      console.error('Failed to update watch match status:', error);
    }
  };

  const handleJewelryStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateJewelryMatch(id, { status: newStatus as any });
    } catch (error) {
      console.error('Failed to update jewelry match status:', error);
    }
  };

  const handleGemstoneStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateGemstoneMatch(id, { status: newStatus as any });
    } catch (error) {
      console.error('Failed to update gemstone match status:', error);
    }
  };

  const renderAIAnalysis = (match: WatchMatch | JewelryMatch | GemstoneMatch) => {
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
        
        {/* Show jewelry-specific AI data */}
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

  const renderMatchCard = (match: WatchMatch | JewelryMatch | GemstoneMatch, onStatusUpdate: (id: string, status: string) => void) => (
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
            onClick={() => onStatusUpdate(match.id, 'purchased')}
          >
            Mark Purchased
          </Button>
        )}
      </div>
    </div>
  );

  if (loading && watchMatches.length === 0 && jewelryMatches.length === 0 && gemstoneMatches.length === 0) {
    return <div className="p-6">Loading matches...</div>;
  }

  const totalMatches = watchMatches.length + jewelryMatches.length + gemstoneMatches.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI-Analyzed Matches</h1>
          <p className="text-gray-600">
            Continuous monitoring - displaying {totalMatches} matches found{hasMore ? ' (loading more available)' : ' (all loaded)'}
          </p>
        </div>
        <Button onClick={refetch} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({totalMatches})</TabsTrigger>
          <TabsTrigger value="watches">Watches ({watchMatches.length})</TabsTrigger>
          <TabsTrigger value="jewelry">Jewelry ({jewelryMatches.length})</TabsTrigger>
          <TabsTrigger value="gemstones">Gemstones ({gemstoneMatches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All AI-Analyzed Matches</CardTitle>
              <CardDescription>
                Continuous monitoring results - {totalMatches} matches found and growing
                {hasMore && ' (more available)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalMatches > 0 ? (
                <div className="space-y-4">
                  {watchMatches.map((match) => renderMatchCard(match, handleWatchStatusUpdate))}
                  {jewelryMatches.map((match) => renderMatchCard(match, handleJewelryStatusUpdate))}
                  {gemstoneMatches.map((match) => renderMatchCard(match, handleGemstoneStatusUpdate))}
                  
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button 
                        onClick={loadMore} 
                        disabled={loading}
                        variant="outline"
                      >
                        {loading ? 'Loading...' : 'Load More Matches'}
                      </Button>
                    </div>
                  )}
                  
                  {!hasMore && totalMatches > 0 && (
                    <div className="text-center pt-4 text-sm text-gray-500">
                      All {totalMatches} matches displayed. Tasks continue monitoring for new items.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No matches found yet. Create a task to start continuous monitoring!</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watches">
          <Card>
            <CardHeader>
              <CardTitle>Watch Matches</CardTitle>
              <CardDescription>
                Luxury watches and timepieces - {watchMatches.length} matches from continuous monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {watchMatches.length > 0 ? (
                <div className="space-y-4">
                  {watchMatches.map((match) => renderMatchCard(match, handleWatchStatusUpdate))}
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button 
                        onClick={loadMore} 
                        disabled={loading}
                        variant="outline"
                      >
                        {loading ? 'Loading...' : 'Load More Watches'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No watch matches found yet from continuous monitoring</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jewelry">
          <Card>
            <CardHeader>
              <CardTitle>Jewelry Matches</CardTitle>
              <CardDescription>
                Gold jewelry and precious metals - {jewelryMatches.length} matches with profit analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jewelryMatches.length > 0 ? (
                <div className="space-y-4">
                  {jewelryMatches.map((match) => renderMatchCard(match, handleJewelryStatusUpdate))}
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button 
                        onClick={loadMore} 
                        disabled={loading}
                        variant="outline"
                      >
                        {loading ? 'Loading...' : 'Load More Jewelry'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No jewelry matches found yet from continuous monitoring</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gemstones">
          <Card>
            <CardHeader>
              <CardTitle>Gemstone Matches</CardTitle>
              <CardDescription>
                Loose diamonds and precious stones - {gemstoneMatches.length} matches with market analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gemstoneMatches.length > 0 ? (
                <div className="space-y-4">
                  {gemstoneMatches.map((match) => renderMatchCard(match, handleGemstoneStatusUpdate))}
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button 
                        onClick={loadMore} 
                        disabled={loading}
                        variant="outline"
                      >
                        {loading ? 'Loading...' : 'Load More Gemstones'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No gemstone matches found yet from continuous monitoring</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Matches;
