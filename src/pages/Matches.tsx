
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMatches } from '@/hooks/useMatches';
import { Eye, ShoppingCart, RotateCcw, Package } from 'lucide-react';

const Matches = () => {
  const { matches, loading, updateMatchStatus } = useMatches();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Eye className="h-4 w-4" />;
      case 'purchased': return <ShoppingCart className="h-4 w-4" />;
      case 'returned': return <RotateCcw className="h-4 w-4" />;
      case 'sold': return <Package className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'purchased': return 'bg-green-100 text-green-800';
      case 'returned': return 'bg-yellow-100 text-yellow-800';
      case 'sold': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusUpdate = async (id: string, type: 'watch' | 'jewelry' | 'gemstone', newStatus: string) => {
    try {
      await updateMatchStatus(id, type, { status: newStatus as any });
    } catch (error) {
      console.error('Failed to update match status:', error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading matches...</div>;
  }

  const renderMatchCard = (match: any, type: 'watch' | 'jewelry' | 'gemstone') => (
    <div key={match.id} className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-sm">{match.ebay_title}</h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="font-semibold">${match.listed_price?.toLocaleString()}</span>
            <span>{match.currency || 'USD'}</span>
            {match.seller_feedback && <span>Feedback: {match.seller_feedback}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {match.buy_format} • Found: {new Date(match.found_at).toLocaleDateString()}
          </div>
        </div>
        <Badge variant="secondary" className={`${getStatusColor(match.status)} flex items-center gap-1`}>
          {getStatusIcon(match.status)}
          {match.status}
        </Badge>
      </div>

      {/* Type-specific data */}
      {type === 'watch' && (
        <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
          {match.case_material && <div>Case: {match.case_material}</div>}
          {match.movement && <div>Movement: {match.movement}</div>}
          {match.case_size_mm && <div>Size: {match.case_size_mm}mm</div>}
          {match.chrono24_avg && <div>C24 Avg: ${match.chrono24_avg}</div>}
        </div>
      )}

      {type === 'jewelry' && (
        <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
          {match.weight_g && <div>Weight: {match.weight_g}g</div>}
          {match.karat && <div>Karat: {match.karat}k</div>}
          {match.metal_type && <div>Metal: {match.metal_type}</div>}
          {match.melt_value && <div>Melt: ${match.melt_value}</div>}
        </div>
      )}

      {type === 'gemstone' && (
        <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
          {match.carat && <div>Carat: {match.carat}ct</div>}
          {match.shape && <div>Shape: {match.shape}</div>}
          {match.clarity && <div>Clarity: {match.clarity}</div>}
          {match.cert_lab && <div>Cert: {match.cert_lab}</div>}
        </div>
      )}

      {/* Action buttons */}
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
            onClick={() => handleStatusUpdate(match.id, type, 'purchased')}
          >
            Mark Purchased
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
        <p className="text-gray-600">Review your search results and AI-identified opportunities</p>
      </div>

      <Tabs defaultValue="watches" className="w-full">
        <TabsList>
          <TabsTrigger value="watches">
            Watches ({matches.watches.length})
          </TabsTrigger>
          <TabsTrigger value="jewelry">
            Jewelry ({matches.jewelry.length})
          </TabsTrigger>
          <TabsTrigger value="gemstones">
            Gemstones ({matches.gemstones.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="watches">
          <Card>
            <CardHeader>
              <CardTitle>Watch Matches</CardTitle>
              <CardDescription>Found watch listings matching your criteria</CardDescription>
            </CardHeader>
            <CardContent>
              {matches.watches.length > 0 ? (
                <div className="space-y-4">
                  {matches.watches.map(match => renderMatchCard(match, 'watch'))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No watch matches found yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="jewelry">
          <Card>
            <CardHeader>
              <CardTitle>Jewelry Matches</CardTitle>
              <CardDescription>Found jewelry listings matching your criteria</CardDescription>
            </CardHeader>
            <CardContent>
              {matches.jewelry.length > 0 ? (
                <div className="space-y-4">
                  {matches.jewelry.map(match => renderMatchCard(match, 'jewelry'))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No jewelry matches found yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="gemstones">
          <Card>
            <CardHeader>
              <CardTitle>Gemstone Matches</CardTitle>
              <CardDescription>Found gemstone listings matching your criteria</CardDescription>
            </CardHeader>
            <CardContent>
              {matches.gemstones.length > 0 ? (
                <div className="space-y-4">
                  {matches.gemstones.map(match => renderMatchCard(match, 'gemstone'))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No gemstone matches found yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Matches;
