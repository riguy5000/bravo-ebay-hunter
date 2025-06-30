
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
            { value: 'White Gold', meaning: 'White Gold' },
            { value: 'Yellow Gold', meaning: 'Yellow Gold' },
            { value: 'Rose Gold', meaning: 'Rose Gold' },
            { value: 'Silver', meaning: 'Silver' },
            { value: 'Sterling Silver', meaning: 'Sterling Silver' },
            { value: 'Platinum', meaning: 'Platinum' },
            { value: 'Palladium', meaning: 'Palladium' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Metal Purity',
          values_json: [
            { value: '10k', meaning: '10 Karat' },
            { value: '14k', meaning: '14 Karat' },
            { value: '18k', meaning: '18 Karat' },
            { value: '22k', meaning: '22 Karat' },
            { value: '24k', meaning: '24 Karat' },
            { value: '925', meaning: 'Sterling Silver (925)' },
            { value: '950', meaning: '950 Platinum' },
            { value: '999', meaning: 'Fine Silver (999)' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Main Stone',
          values_json: [
            { value: 'Diamond', meaning: 'Diamond' },
            { value: 'Ruby', meaning: 'Ruby' },
            { value: 'Sapphire', meaning: 'Sapphire' },
            { value: 'Emerald', meaning: 'Emerald' },
            { value: 'Pearl', meaning: 'Pearl' },
            { value: 'Opal', meaning: 'Opal' },
            { value: 'Amethyst', meaning: 'Amethyst' },
            { value: 'Garnet', meaning: 'Garnet' },
            { value: 'Topaz', meaning: 'Topaz' },
            { value: 'Turquoise', meaning: 'Turquoise' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Main Stone Shape',
          values_json: [
            { value: 'Round', meaning: 'Round' },
            { value: 'Princess', meaning: 'Princess' },
            { value: 'Emerald', meaning: 'Emerald Cut' },
            { value: 'Oval', meaning: 'Oval' },
            { value: 'Pear', meaning: 'Pear' },
            { value: 'Marquise', meaning: 'Marquise' },
            { value: 'Asscher', meaning: 'Asscher' },
            { value: 'Cushion', meaning: 'Cushion' },
            { value: 'Heart', meaning: 'Heart' },
            { value: 'Radiant', meaning: 'Radiant' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Main Stone Colour',
          values_json: [
            { value: 'Colorless', meaning: 'Colorless' },
            { value: 'Yellow', meaning: 'Yellow' },
            { value: 'Blue', meaning: 'Blue' },
            { value: 'Pink', meaning: 'Pink' },
            { value: 'Green', meaning: 'Green' },
            { value: 'Red', meaning: 'Red' },
            { value: 'Purple', meaning: 'Purple' },
            { value: 'Orange', meaning: 'Orange' },
            { value: 'Brown', meaning: 'Brown' },
            { value: 'Black', meaning: 'Black' },
            { value: 'White', meaning: 'White' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Main Stone Creation',
          values_json: [
            { value: 'Natural', meaning: 'Natural' },
            { value: 'Lab-Created', meaning: 'Lab-Created' },
            { value: 'Synthetic', meaning: 'Synthetic' },
            { value: 'Treated', meaning: 'Treated' },
            { value: 'Enhanced', meaning: 'Enhanced' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Jewelry Type',
          values_json: [
            { value: 'Ring', meaning: 'Ring' },
            { value: 'Necklace', meaning: 'Necklace' },
            { value: 'Earrings', meaning: 'Earrings' },
            { value: 'Bracelet', meaning: 'Bracelet' },
            { value: 'Pendant', meaning: 'Pendant' },
            { value: 'Brooch', meaning: 'Brooch' },
            { value: 'Anklet', meaning: 'Anklet' },
            { value: 'Chain', meaning: 'Chain' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Setting Style',
          values_json: [
            { value: 'Solitaire', meaning: 'Solitaire' },
            { value: 'Halo', meaning: 'Halo' },
            { value: 'Three Stone', meaning: 'Three Stone' },
            { value: 'Vintage', meaning: 'Vintage' },
            { value: 'Modern', meaning: 'Modern' },
            { value: 'Art Deco', meaning: 'Art Deco' },
            { value: 'Cathedral', meaning: 'Cathedral' },
            { value: 'Tension', meaning: 'Tension' }
          ]
        },
        {
          category_id: categoryId,
          aspect_name: 'Style',
          values_json: [
            { value: 'Classic', meaning: 'Classic' },
            { value: 'Modern', meaning: 'Modern' },
            { value: 'Vintage', meaning: 'Vintage' },
            { value: 'Art Deco', meaning: 'Art Deco' },
            { value: 'Victorian', meaning: 'Victorian' },
            { value: 'Edwardian', meaning: 'Edwardian' },
            { value: 'Contemporary', meaning: 'Contemporary' },
            { value: 'Antique', meaning: 'Antique' }
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
