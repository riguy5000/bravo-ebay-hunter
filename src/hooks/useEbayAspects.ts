
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

// Test data for different category types
const getTestDataForCategory = (categoryId: string): EbayAspect[] => {
  const baseAspects = [
    {
      aspect_name: 'Condition',
      values_json: [
        { value: 'New with tags', meaning: 'New with tags' },
        { value: 'New without tags', meaning: 'New without tags' },
        { value: 'Pre-owned', meaning: 'Pre-owned' },
        { value: 'For parts or not working', meaning: 'For parts or not working' }
      ],
      refreshed_at: new Date().toISOString()
    }
  ];

  // Gemstone-specific test data
  if (categoryId === '10207' || categoryId === '51089' || categoryId === 'gemstone_general') {
    return [
      ...baseAspects,
      {
        aspect_name: 'Stone Type',
        values_json: [
          { value: 'Diamond', meaning: 'Diamond' },
          { value: 'Ruby', meaning: 'Ruby' },
          { value: 'Sapphire', meaning: 'Sapphire' },
          { value: 'Emerald', meaning: 'Emerald' },
          { value: 'Amethyst', meaning: 'Amethyst' },
          { value: 'Citrine', meaning: 'Citrine' },
          { value: 'Garnet', meaning: 'Garnet' },
          { value: 'Topaz', meaning: 'Topaz' },
          { value: 'Aquamarine', meaning: 'Aquamarine' },
          { value: 'Peridot', meaning: 'Peridot' },
          { value: 'Tanzanite', meaning: 'Tanzanite' },
          { value: 'Opal', meaning: 'Opal' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Cut',
        values_json: [
          { value: 'Round', meaning: 'Round' },
          { value: 'Princess', meaning: 'Princess' },
          { value: 'Emerald', meaning: 'Emerald Cut' },
          { value: 'Cushion', meaning: 'Cushion' },
          { value: 'Oval', meaning: 'Oval' },
          { value: 'Pear', meaning: 'Pear' },
          { value: 'Marquise', meaning: 'Marquise' },
          { value: 'Asscher', meaning: 'Asscher' },
          { value: 'Heart', meaning: 'Heart' },
          { value: 'Radiant', meaning: 'Radiant' }
        ],
        refreshed_at: new Date().toISOString()
      }
    ];
  }

  // Watch-specific test data
  if (categoryId === '31387' || categoryId === '31388' || categoryId === '31389' || categoryId === 'watch_general') {
    return [
      ...baseAspects,
      {
        aspect_name: 'Brand',
        values_json: [
          { value: 'Rolex', meaning: 'Rolex' },
          { value: 'Omega', meaning: 'Omega' },
          { value: 'TAG Heuer', meaning: 'TAG Heuer' },
          { value: 'Breitling', meaning: 'Breitling' },
          { value: 'Cartier', meaning: 'Cartier' },
          { value: 'Seiko', meaning: 'Seiko' },
          { value: 'Tudor', meaning: 'Tudor' },
          { value: 'Patek Philippe', meaning: 'Patek Philippe' },
          { value: 'Audemars Piguet', meaning: 'Audemars Piguet' },
          { value: 'Jaeger-LeCoultre', meaning: 'Jaeger-LeCoultre' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Movement',
        values_json: [
          { value: 'Automatic', meaning: 'Automatic' },
          { value: 'Manual', meaning: 'Manual Wind' },
          { value: 'Quartz', meaning: 'Quartz' },
          { value: 'Kinetic', meaning: 'Kinetic' },
          { value: 'Solar', meaning: 'Solar Powered' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Case Material',
        values_json: [
          { value: 'Stainless Steel', meaning: 'Stainless Steel' },
          { value: 'Gold', meaning: 'Gold' },
          { value: 'Rose Gold', meaning: 'Rose Gold' },
          { value: 'White Gold', meaning: 'White Gold' },
          { value: 'Titanium', meaning: 'Titanium' },
          { value: 'Ceramic', meaning: 'Ceramic' },
          { value: 'Platinum', meaning: 'Platinum' },
          { value: 'Carbon Fiber', meaning: 'Carbon Fiber' }
        ],
        refreshed_at: new Date().toISOString()
      }
    ];
  }

  // Jewelry-specific test data (default and all jewelry subcategories)
  return [
    ...baseAspects,
    {
      aspect_name: 'Metal',
      values_json: [
        { value: 'Gold', meaning: 'Gold' },
        { value: 'White Gold', meaning: 'White Gold' },
        { value: 'Yellow Gold', meaning: 'Yellow Gold' },
        { value: 'Rose Gold', meaning: 'Rose Gold' },
        { value: 'Silver', meaning: 'Silver' },
        { value: 'Sterling Silver', meaning: 'Sterling Silver' },
        { value: 'Platinum', meaning: 'Platinum' },
        { value: 'Stainless Steel', meaning: 'Stainless Steel' },
        { value: 'Titanium', meaning: 'Titanium' }
      ],
      refreshed_at: new Date().toISOString()
    },
    {
      aspect_name: 'Color',
      values_json: [
        { value: 'Yellow', meaning: 'Yellow' },
        { value: 'White', meaning: 'White' },
        { value: 'Rose', meaning: 'Rose' },
        { value: 'Silver', meaning: 'Silver' },
        { value: 'Gold', meaning: 'Gold' },
        { value: 'Black', meaning: 'Black' },
        { value: 'Blue', meaning: 'Blue' },
        { value: 'Green', meaning: 'Green' },
        { value: 'Red', meaning: 'Red' }
      ],
      refreshed_at: new Date().toISOString()
    },
    {
      aspect_name: 'Type',
      values_json: [
        { value: 'Ring', meaning: 'Ring' },
        { value: 'Necklace', meaning: 'Necklace' },
        { value: 'Bracelet', meaning: 'Bracelet' },
        { value: 'Earrings', meaning: 'Earrings' },
        { value: 'Pendant', meaning: 'Pendant' },
        { value: 'Brooch', meaning: 'Brooch' },
        { value: 'Charm', meaning: 'Charm' },
        { value: 'Anklet', meaning: 'Anklet' }
      ],
      refreshed_at: new Date().toISOString()
    },
    {
      aspect_name: 'Brand',
      values_json: [
        { value: 'Tiffany & Co.', meaning: 'Tiffany & Co.' },
        { value: 'Cartier', meaning: 'Cartier' },
        { value: 'Pandora', meaning: 'Pandora' },
        { value: 'David Yurman', meaning: 'David Yurman' },
        { value: 'Kay Jewelers', meaning: 'Kay Jewelers' },
        { value: 'Zales', meaning: 'Zales' },
        { value: 'Jared', meaning: 'Jared' },
        { value: 'Blue Nile', meaning: 'Blue Nile' }
      ],
      refreshed_at: new Date().toISOString()
    },
    {
      aspect_name: 'Main Stone',
      values_json: [
        { value: 'Diamond', meaning: 'Diamond' },
        { value: 'Ruby', meaning: 'Ruby' },
        { value: 'Sapphire', meaning: 'Sapphire' },
        { value: 'Emerald', meaning: 'Emerald' },
        { value: 'Pearl', meaning: 'Pearl' },
        { value: 'Amethyst', meaning: 'Amethyst' },
        { value: 'Citrine', meaning: 'Citrine' },
        { value: 'Garnet', meaning: 'Garnet' },
        { value: 'Topaz', meaning: 'Topaz' },
        { value: 'Opal', meaning: 'Opal' }
      ],
      refreshed_at: new Date().toISOString()
    },
    {
      aspect_name: 'Metal Purity',
      values_json: [
        { value: '10K', meaning: '10 Karat' },
        { value: '14K', meaning: '14 Karat' },
        { value: '18K', meaning: '18 Karat' },
        { value: '22K', meaning: '22 Karat' },
        { value: '24K', meaning: '24 Karat' },
        { value: '925', meaning: '925 Sterling Silver' },
        { value: '950', meaning: '950 Platinum' },
        { value: '999', meaning: '999 Fine Silver' }
      ],
      refreshed_at: new Date().toISOString()
    }
  ];
};

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

        if (transformedData.length === 0) {
          console.log('No aspects found in database, using test data for category', categoryId);
          // Use test data as fallback
          const testData = getTestDataForCategory(categoryId);
          setAspects(testData);
        } else {
          setAspects(transformedData);
        }
      } catch (err: any) {
        console.error('Error fetching eBay aspects:', err);
        setError(err.message || 'Failed to fetch aspects');
        
        // Use test data as fallback when there's an error
        console.log('Using test data as fallback for category', categoryId);
        const testData = getTestDataForCategory(categoryId);
        setAspects(testData);
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
    if (!categoryId) return;
    
    try {
      setError(null);
      console.log('Calling eBay aspects cache refresh...');
      const { data, error } = await supabase.functions.invoke('ebay-aspects-cache');
      
      if (error) {
        console.error('Cache refresh error:', error);
        throw error;
      }
      
      console.log('Cache refresh response:', data);
      
      // Check if the refresh was successful
      if (data && !data.success) {
        throw new Error(data.message || 'Cache refresh failed');
      }
      
      // Refetch aspects after cache refresh
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
      
      if (transformedData.length === 0) {
        setError('No aspects were loaded from eBay. Try adding test data instead.');
      }
    } catch (err: any) {
      console.error('Error refreshing cache:', err);
      setError(err.message || 'Failed to refresh cache');
    }
  };

  const populateTestData = async () => {
    if (!categoryId) return;
    
    try {
      setError(null);
      console.log('Populating test data for category:', categoryId);
      
      const testAspects = getTestDataForCategory(categoryId).map(aspect => ({
        category_id: categoryId,
        aspect_name: aspect.aspect_name,
        values_json: aspect.values_json as any // Cast to any to satisfy TypeScript
      }));
      
      // Clear existing test data first
      await supabase
        .from('ebay_aspects')
        .delete()
        .eq('category_id', categoryId);
      
      // Insert test data
      const { error } = await supabase
        .from('ebay_aspects')
        .insert(testAspects);
        
      if (error) {
        console.error('Error inserting test aspect:', error);
        throw error;
      }
      
      // Refetch after inserting test data
      const { data, error: fetchError } = await supabase
        .from('ebay_aspects')
        .select('*')
        .eq('category_id', categoryId)
        .order('aspect_name');
      
      if (fetchError) {
        console.error('Error fetching test data:', fetchError);
        throw fetchError;
      }
      
      if (data) {
        const transformedData = data.map(item => ({
          aspect_name: item.aspect_name,
          values_json: Array.isArray(item.values_json) ? 
            (item.values_json as unknown as EbayAspectValue[]) : [],
          refreshed_at: item.refreshed_at
        }));
        
        setAspects(transformedData);
        console.log('Test data populated successfully:', transformedData.length, 'aspects');
      }
    } catch (err: any) {
      console.error('Error populating test data:', err);
      setError(err.message || 'Failed to populate test data');
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
