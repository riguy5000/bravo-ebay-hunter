
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EbayAspectValue {
  value: string;
  meaning: string;
}

export interface EbayAspect {
  aspect_name: string;
  values_json: EbayAspectValue[];
  refreshed_at: string;
}

export const useEbayAspects = (categoryId?: string) => {
  const [aspects, setAspects] = useState<EbayAspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) return;

    const fetchAspects = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('ebay_aspects')
          .select('*')
          .eq('category_id', categoryId)
          .order('aspect_name');

        if (error) throw error;

        // Transform the data to match our EbayAspect interface
        const transformedData = (data || []).map(item => ({
          aspect_name: item.aspect_name,
          values_json: Array.isArray(item.values_json) ? 
            (item.values_json as unknown as EbayAspectValue[]) : [],
          refreshed_at: item.refreshed_at
        }));

        setAspects(transformedData);
      } catch (err: any) {
        console.error('Error fetching eBay aspects:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAspects();
  }, [categoryId]);

  const getAspectValues = (aspectName: string): EbayAspectValue[] => {
    const aspect = aspects.find(a => a.aspect_name === aspectName);
    return aspect?.values_json || [];
  };

  const refreshCache = async () => {
    try {
      const { error } = await supabase.functions.invoke('ebay-aspects-cache');
      if (error) throw error;
      
      // Refetch aspects after cache refresh
      if (categoryId) {
        const { data } = await supabase
          .from('ebay_aspects')
          .select('*')
          .eq('category_id', categoryId)
          .order('aspect_name');
        
        // Transform the data to match our EbayAspect interface
        const transformedData = (data || []).map(item => ({
          aspect_name: item.aspect_name,
          values_json: Array.isArray(item.values_json) ? 
            (item.values_json as unknown as EbayAspectValue[]) : [],
          refreshed_at: item.refreshed_at
        }));
        
        setAspects(transformedData);
      }
    } catch (err: any) {
      console.error('Error refreshing cache:', err);
      setError(err.message);
    }
  };

  return {
    aspects,
    loading,
    error,
    getAspectValues,
    refreshCache
  };
};
