
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
        console.log(`Fetching aspects for category: ${categoryId}`);
        
        const { data, error } = await supabase
          .from('ebay_aspects')
          .select('*')
          .eq('category_id', categoryId)
          .order('aspect_name');

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        console.log(`Found ${data?.length || 0} aspects for category ${categoryId}`);
        
        // Transform the data to match our EbayAspect interface
        const transformedData = (data || []).map(item => ({
          aspect_name: item.aspect_name,
          values_json: Array.isArray(item.values_json) ? 
            (item.values_json as unknown as EbayAspectValue[]) : [],
          refreshed_at: item.refreshed_at
        }));

        setAspects(transformedData);
        
        // If no aspects found, try to populate the cache
        if (transformedData.length === 0) {
          console.log('No aspects found, attempting to refresh cache...');
          await refreshCache();
        }
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
      console.log('Calling eBay aspects cache refresh...');
      const { data, error } = await supabase.functions.invoke('ebay-aspects-cache');
      
      if (error) {
        console.error('Cache refresh error:', error);
        throw error;
      }
      
      console.log('Cache refresh response:', data);
      
      // Refetch aspects after cache refresh
      if (categoryId) {
        const { data: aspectsData, error: aspectsError } = await supabase
          .from('ebay_aspects')
          .select('*')
          .eq('category_id', categoryId)
          .order('aspect_name');
        
        if (aspectsError) {
          console.error('Error refetching aspects:', aspectsError);
          throw aspectsError;
        }
        
        // Transform the data to match our EbayAspect interface
        const transformedData = (aspectsData || []).map(item => ({
          aspect_name: item.aspect_name,
          values_json: Array.isArray(item.values_json) ? 
            (item.values_json as unknown as EbayAspectValue[]) : [],
          refreshed_at: item.refreshed_at
        }));
        
        setAspects(transformedData);
        console.log(`Refreshed aspects: ${transformedData.length} found`);
      }
    } catch (err: any) {
      console.error('Error refreshing cache:', err);
      setError(err.message);
    }
  };

  const populateTestData = async () => {
    if (!categoryId) return;
    
    try {
      console.log('Populating test data for category:', categoryId);
      
      const testAspects = [
        {
          category_id: categoryId,
          aspect_name: 'Condition',
          values_json: [
            { value: 'New with tags', meaning: 'New with tags' },
            { value: 'New without tags', meaning: 'New without tags' },
            { value: 'Pre-owned', meaning: 'Pre-owned' },
            { value: 'For parts or not working', meaning: 'For parts or not working' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Metal',
          values_json: [
            { value: 'Gold', meaning: 'Gold' },
            { value: 'Silver', meaning: 'Silver' },
            { value: 'Platinum', meaning: 'Platinum' },
            { value: 'Palladium', meaning: 'Palladium' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Metal Purity',
          values_json: [
            { value: '14k', meaning: '14 Karat' },
            { value: '18k', meaning: '18 Karat' },
            { value: '925', meaning: 'Sterling Silver' },
            { value: '950', meaning: '950 Platinum' }
          ]
        }
      ];
      
      for (const aspect of testAspects) {
        const { error } = await supabase
          .from('ebay_aspects')
          .upsert(aspect, {
            onConflict: 'category_id,aspect_name',
            ignoreDuplicates: false
          });
          
        if (error) {
          console.error('Error inserting test aspect:', error);
        }
      }
      
      // Refetch after inserting test data
      const { data, error } = await supabase
        .from('ebay_aspects')
        .select('*')
        .eq('category_id', categoryId)
        .order('aspect_name');
      
      if (!error && data) {
        const transformedData = data.map(item => ({
          aspect_name: item.aspect_name,
          values_json: Array.isArray(item.values_json) ? 
            (item.values_json as unknown as EbayAspectValue[]) : [],
          refreshed_at: item.refreshed_at
        }));
        
        setAspects(transformedData);
        console.log('Test data populated successfully');
      }
    } catch (err: any) {
      console.error('Error populating test data:', err);
      setError(err.message);
    }
  };

  return {
    aspects,
    loading,
    error,
    getAspectValues,
    refreshCache,
    populateTestData
  };
};
