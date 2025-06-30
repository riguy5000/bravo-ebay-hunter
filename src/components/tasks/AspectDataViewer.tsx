import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Database, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AspectValue {
  value: string;
  meaning: string;
}

interface AspectData {
  [aspectName: string]: AspectValue[];
}

export const AspectDataViewer: React.FC = () => {
  const [aspectData, setAspectData] = useState<AspectData>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalCategories: number;
    totalAspects: number;
    uniqueAspects: number;
  }>({ totalCategories: 0, totalAspects: 0, uniqueAspects: 0 });

  const fetchAspectData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching all aspect data from database...');
      
      const { data, error } = await supabase
        .from('ebay_aspects')
        .select('aspect_name, values_json')
        .order('aspect_name');

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log(`Found ${data?.length || 0} aspect records`);

      // Organize data by aspect name and collect all unique values
      const organized: AspectData = {};
      
      data?.forEach(row => {
        const aspectName = row.aspect_name;
        // Properly handle the JSON type conversion
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
        
        if (!organized[aspectName]) {
          organized[aspectName] = [];
        }
        
        // Add values, avoiding duplicates
        values.forEach(value => {
          const exists = organized[aspectName].some(existing => 
            existing.value === value.value
          );
          if (!exists) {
            organized[aspectName].push(value);
          }
        });
      });

      // Sort values within each aspect
      Object.keys(organized).forEach(aspectName => {
        organized[aspectName].sort((a, b) => a.value.localeCompare(b.value));
      });

      setAspectData(organized);
      console.log('Organized aspect data:', organized);
      
    } catch (err: any) {
      console.error('Error fetching aspect data:', err);
      setError(err.message || 'Failed to fetch aspect data');
    } finally {
      setLoading(false);
    }
  };

  const refreshCache = async () => {
    setRefreshing(true);
    setError(null);

    try {
      console.log('Calling enhanced eBay aspects cache refresh...');
      const { data, error } = await supabase.functions.invoke('ebay-aspects-cache');
      
      if (error) {
        console.error('Cache refresh error:', error);
        throw error;
      }
      
      console.log('Enhanced cache refresh response:', data);
      
      if (data && !data.success) {
        throw new Error(data.message || 'Cache refresh failed');
      }
      
      // Show success message with stats
      if (data) {
        console.log(`✓ Cache refresh completed: ${data.total_aspects_inserted} aspects from ${data.categories_attempted} categories`);
      }
      
      // Refetch data after refresh
      await fetchAspectData();
      
    } catch (err: any) {
      console.error('Error refreshing cache:', err);
      setError(err.message || 'Failed to refresh cache');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAspectData();
  }, []);

  useEffect(() => {
    // Calculate stats when aspect data changes
    const totalCategories = new Set(Object.keys(aspectData).map(key => 
      Object.values(aspectData).find(aspects => aspects.length > 0)
    )).size;
    
    const totalAspects = Object.values(aspectData).reduce((sum, aspects) => sum + aspects.length, 0);
    const uniqueAspects = Object.keys(aspectData).length;
    
    setStats({ totalCategories, totalAspects, uniqueAspects });
  }, [aspectData]);

  const requiredAspects = [
    'Metal', 'Color', 'Brand', 'Metal Purity', 'Base Metal', 'Type',
    'Main Stone', 'Style', 'Department', 'Main Stone Color',
    'Material', 'Condition', 'Item Location', 'Movement', 'Case Material',
    'Band Material', 'Stone Type', 'Shape / Cut', 'Creation', 'Clarity (Diamonds)',
    'Colour (Diamonds)', 'Carat Weight', 'Case Size'
  ];

  const getAspectValues = (aspectName: string): AspectValue[] => {
    // Try exact match first
    if (aspectData[aspectName]) {
      return aspectData[aspectName];
    }
    
    // Try case-insensitive match
    const lowerAspectName = aspectName.toLowerCase();
    for (const [key, values] of Object.entries(aspectData)) {
      if (key.toLowerCase() === lowerAspectName) {
        return values;
      }
    }
    
    // Try partial match
    for (const [key, values] of Object.entries(aspectData)) {
      if (key.toLowerCase().includes(lowerAspectName) || 
          lowerAspectName.includes(key.toLowerCase())) {
        return values;
      }
    }
    
    return [];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Enhanced Aspect Data...</CardTitle>
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
          <CardTitle>Enhanced eBay Aspect Data (Multi-Category + Subcategories)</CardTitle>
          <div className="flex gap-2">
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
              onClick={fetchAspectData}
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

          {/* Enhanced Stats Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.uniqueAspects}</div>
              <div className="text-sm text-blue-600">Unique Aspects</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.totalAspects}</div>
              <div className="text-sm text-green-600">Total Aspect Values</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.totalCategories}</div>
              <div className="text-sm text-purple-600">Categories Processed</div>
            </div>
          </div>

          {/* Required Aspects Status */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Required Aspect Coverage Status:</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requiredAspects.map(aspectName => {
                const values = getAspectValues(aspectName);
                const hasValues = values.length > 0;
                return (
                  <div key={aspectName} className={`border rounded-lg p-4 ${hasValues ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {hasValues ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <h4 className={`font-medium text-sm ${hasValues ? 'text-green-700' : 'text-red-700'}`}>
                        {aspectName}
                      </h4>
                    </div>
                    <div className={`text-xs ${hasValues ? 'text-green-600' : 'text-red-600'}`}>
                      {hasValues ? `${values.length} values available` : 'Not found - need more categories'}
                    </div>
                    {hasValues && values.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        Examples: {values.slice(0, 3).map(v => v.meaning || v.value).join(', ')}
                        {values.length > 3 && ` + ${values.length - 3} more`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Available Aspects */}
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold">All Available Aspects from Enhanced eBay Data:</h3>
            <div className="text-sm text-gray-600 mb-4">
              This data now includes main categories AND their subcategories for comprehensive coverage.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(aspectData)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([aspectName, values]) => (
                <div key={aspectName} className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2 text-gray-700">
                    {aspectName} ({values.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="text-xs text-gray-600 space-y-1">
                      {values.slice(0, 8).map((value, index) => (
                        <div key={`${value.value}-${index}`} className="bg-gray-50 px-2 py-1 rounded text-xs">
                          {value.meaning || value.value}
                        </div>
                      ))}
                      {values.length > 8 && (
                        <div className="text-gray-400 italic text-xs">
                          ... and {values.length - 8} more options
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
