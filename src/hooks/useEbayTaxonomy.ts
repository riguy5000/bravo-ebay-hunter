
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AspectValue {
  value: string;
  meaning?: string;
}

interface EbayAspect {
  aspect_name: string;
  values_json: AspectValue[];
  refreshed_at: string;
}

export const useEbayTaxonomy = (categoryId?: string) => {
  const [aspects, setAspects] = useState<EbayAspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) return;

    const fetchTaxonomyAspects = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`Fetching taxonomy aspects for category: ${categoryId}`);
        
        // First check if we have cached data less than 24 hours old
        const { data: cachedData, error: cacheError } = await supabase
          .from('ebay_aspects')
          .select('*')
          .eq('category_id', categoryId)
          .gte('refreshed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('aspect_name');

        if (!cacheError && cachedData?.length > 0) {
          console.log(`Using cached taxonomy data for category ${categoryId}`);
          const transformedData = cachedData.map(item => ({
            aspect_name: item.aspect_name,
            values_json: Array.isArray(item.values_json) ? 
              (item.values_json as unknown as AspectValue[]) : [],
            refreshed_at: item.refreshed_at
          }));
          setAspects(transformedData);
        } else {
          // Cache is stale or missing, fetch fresh data
          console.log(`Fetching fresh taxonomy data for category ${categoryId}`);
          await refreshTaxonomyData(categoryId);
        }
      } catch (err: any) {
        console.error('Error fetching taxonomy aspects:', err);
        setError(err.message || 'Failed to fetch taxonomy data');
      } finally {
        setLoading(false);
      }
    };

    fetchTaxonomyAspects();
  }, [categoryId]);

  const refreshTaxonomyData = async (categoryId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ebay-taxonomy', {
        body: { categoryId }
      });

      if (error) {
        console.error('Taxonomy refresh error:', error);
        throw error;
      }

      if (data?.aspects) {
        setAspects(data.aspects);
        console.log(`Refreshed taxonomy data: ${data.aspects.length} aspects`);
      }
    } catch (err: any) {
      console.error('Error refreshing taxonomy data:', err);
      setError(err.message || 'Failed to refresh taxonomy data');
    }
  };

  const getAspectValues = (aspectName: string): AspectValue[] => {
    const aspect = aspects.find(a => a.aspect_name === aspectName);
    return aspect?.values_json || [];
  };

  return {
    aspects,
    loading,
    error,
    getAspectValues,
    refreshTaxonomyData: () => categoryId && refreshTaxonomyData(categoryId)
  };
};
