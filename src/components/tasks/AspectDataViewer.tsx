
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Database } from 'lucide-react';
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
        const values = row.values_json as AspectValue[] || [];
        
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
      console.log('Calling eBay aspects cache refresh...');
      const { data, error } = await supabase.functions.invoke('ebay-aspects-cache');
      
      if (error) {
        console.error('Cache refresh error:', error);
        throw error;
      }
      
      console.log('Cache refresh response:', data);
      
      if (data && !data.success) {
        throw new Error(data.message || 'Cache refresh failed');
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

  const requestedAspects = [
    'Metal', 'Color', 'Brand', 'Metal Purity', 'Base Metal', 'Type',
    'Main Stone', 'Style', 'Department', 'Main Stone Color',
    'Material', 'Condition', 'Item Location'
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
          <CardTitle>eBay Aspect Data from API</CardTitle>
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

          <div className="text-sm text-gray-600 mb-4">
            {Object.keys(aspectData).length > 0 ? (
              <span className="text-green-600">
                ✓ {Object.keys(aspectData).length} unique aspects loaded from eBay API
              </span>
            ) : (
              <span className="text-orange-600">
                ⚠ No aspect data found - try refreshing from eBay
              </span>
            )}
          </div>

          {/* Requested Aspects */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Requested Aspect Categories:</h3>
            
            {requestedAspects.map(aspectName => {
              const values = getAspectValues(aspectName);
              return (
                <div key={aspectName} className="border rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2 text-blue-600">
                    {aspectName} ({values.length} values)
                  </h4>
                  {values.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {values.map((value, index) => (
                        <div key={`${value.value}-${index}`} className="text-sm bg-gray-50 px-2 py-1 rounded">
                          {value.meaning || value.value}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      No values found for this aspect
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* All Available Aspects */}
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold">All Available Aspects from eBay:</h3>
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
                      {values.slice(0, 10).map((value, index) => (
                        <div key={`${value.value}-${index}`}>
                          {value.meaning || value.value}
                        </div>
                      ))}
                      {values.length > 10 && (
                        <div className="text-gray-400 italic">
                          ... and {values.length - 10} more
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
