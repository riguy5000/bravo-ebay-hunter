import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Database, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface AspectValue {
  value: string;
  meaning: string;
}

interface AspectData {
  [aspectName: string]: AspectValue[];
}

export const AspectDataViewer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [categoryData, setCategoryData] = useState<{
    jewelry: AspectData;
    watches: AspectData; 
    gems: AspectData;
  }>({ jewelry: {}, watches: {}, gems: {} });

  const fetchCategoryAspects = async () => {
    setLoading(true);
    try {
      // Fetch jewelry merged data (most comprehensive)
      const { data: jewelryData } = await supabase
        .from('ebay_aspects')
        .select('aspect_name, values_json')
        .eq('category_id', 'jewelry_merged');

      // Fetch watches data
      const { data: watchData } = await supabase
        .from('ebay_aspects')
        .select('aspect_name, values_json')
        .eq('category_id', '31387');

      // Fetch gems data  
      const { data: gemData } = await supabase
        .from('ebay_aspects')
        .select('aspect_name, values_json')
        .eq('category_id', 'gemstone_general');

      // Process each category
      const processData = (data: any[]) => {
        const organized: AspectData = {};
        data?.forEach(row => {
          const aspectName = row.aspect_name;
          let values: AspectValue[] = [];
          
          try {
            if (row.values_json && Array.isArray(row.values_json)) {
              values = (row.values_json as unknown as AspectValue[]).filter(
                (item): item is AspectValue => 
                  typeof item === 'object' && 
                  item !== null && 
                  'value' in item && 
                  'meaning' in item
              );
            }
          } catch (e) {
            console.warn(`Failed to parse values for aspect ${aspectName}:`, e);
            values = [];
          }
          
          organized[aspectName] = values.sort((a, b) => a.value.localeCompare(b.value));
        });
        return organized;
      };

      setCategoryData({
        jewelry: processData(jewelryData || []),
        watches: processData(watchData || []),
        gems: processData(gemData || [])
      });

    } catch (error) {
      console.error('Error fetching category aspects:', error);
      setError('Failed to fetch aspect data');
    } finally {
      setLoading(false);
    }
  };

  const bulkRefreshAllJewelry = async () => {
    setBulkRefreshing(true);
    setError(null);

    try {
      console.log('Starting bulk taxonomy collection for all jewelry categories...');
      toast.info('Starting comprehensive jewelry aspect collection...', {
        description: 'This will fetch aspects from all jewelry subcategories and may take a few minutes.'
      });
      
      const { data, error } = await supabase.functions.invoke('ebay-bulk-taxonomy');
      
      if (error) {
        console.error('Bulk refresh error:', error);
        throw error;
      }
      
      if (data && !data.success) {
        throw new Error(data.message || 'Bulk refresh failed');
      }
      
      if (data) {
        const stats = data.stats || {};
        const message = `Successfully collected ${stats.uniqueAspects || 0} unique aspects from ${stats.categoriesSuccessful || 0} jewelry categories`;
        const description = `Found ${stats.metalOptionsFound || 0} metal options including comprehensive plated/filled variants`;
        
        toast.success(message, { description });
        
        if (data.metalOptions && data.metalOptions.length > 0) {
          console.log('Metal options found:', data.metalOptions.join(', '));
        }
      }
      
      await fetchCategoryAspects();
      
    } catch (err: any) {
      console.error('Error in bulk refresh:', err);
      const errorMessage = err.message || 'Failed to perform bulk refresh';
      setError(errorMessage);
      toast.error('Bulk refresh failed', { description: errorMessage });
    } finally {
      setBulkRefreshing(false);
    }
  };

  const refreshCache = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('ebay-aspects-cache');
      
      if (error) {
        throw error;
      }
      
      if (data && !data.success) {
        throw new Error(data.message || 'Cache refresh failed');
      }
      
      await fetchCategoryAspects();
      
    } catch (err: any) {
      console.error('Error refreshing cache:', err);
      setError(err.message || 'Failed to refresh cache');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategoryAspects();
  }, []);

  const renderCategorySection = (title: string, data: AspectData, color: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className={`text-${color}-600`}>{title}</CardTitle>
        <p className="text-sm text-gray-600">
          {Object.keys(data).length} aspects available • {Object.values(data).reduce((sum, values) => sum + values.length, 0)} total options
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([aspectName, values]) => (
            <div key={aspectName} className="border rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2 text-gray-700">
                {aspectName} ({values.length} options)
              </h4>
              <div className="max-h-48 overflow-y-auto">
                <div className="text-xs text-gray-600 space-y-1">
                  {values.map((value, index) => (
                    <div key={`${value.value}-${index}`} className="bg-gray-50 px-2 py-1 rounded text-xs">
                      {value.meaning || value.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (loading && Object.keys(categoryData.jewelry).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Aspect Data...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>eBay Aspect Data by Category</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={bulkRefreshAllJewelry}
              disabled={bulkRefreshing}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Zap className={`h-4 w-4 ${bulkRefreshing ? 'animate-pulse' : ''}`} />
              {bulkRefreshing ? 'Collecting All Data...' : 'Bulk Collect All Jewelry'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshCache}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh from eBay'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchCategoryAspects}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Reload Data
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Error: {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{Object.keys(categoryData.jewelry).length}</div>
              <div className="text-sm text-blue-600">Jewelry Aspects</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{Object.keys(categoryData.watches).length}</div>
              <div className="text-sm text-green-600">Watch Aspects</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{Object.keys(categoryData.gems).length}</div>
              <div className="text-sm text-purple-600">Gem Aspects</div>
            </div>
          </div>

          {/* Missing Data Alert */}
          {categoryData.jewelry.Metal && (
            <Alert className="mb-4">
              <AlertDescription>
                <strong>Metal Options Status:</strong> Found {categoryData.jewelry.Metal.length} metal types. 
                Missing from eBay data: Platinum (non-plated), Palladium (non-plated), Fine Silver, Sterling Silver, Vermeil.
                Try "Bulk Collect All Jewelry" to gather more comprehensive data.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Jewelry Category */}
      {renderCategorySection("💎 JEWELRY CATEGORY", categoryData.jewelry, "blue")}
      
      {/* Watches Category */}
      {renderCategorySection("⌚ WATCHES CATEGORY", categoryData.watches, "green")}
      
      {/* Gems Category */}
      {renderCategorySection("💍 GEMS/DIAMONDS CATEGORY", categoryData.gems, "purple")}
    </div>
  );
};