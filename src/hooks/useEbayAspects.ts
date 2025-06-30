
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
  if (categoryId === '10207' || categoryId === '51089') {
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
        aspect_name: 'Shape / Cut',
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
      },
      {
        aspect_name: 'Creation',
        values_json: [
          { value: 'Natural', meaning: 'Natural' },
          { value: 'Lab-Created', meaning: 'Lab-Created' },
          { value: 'Synthetic', meaning: 'Synthetic' },
          { value: 'Enhanced', meaning: 'Enhanced' },
          { value: 'Treated', meaning: 'Treated' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Colour (Diamonds)',
        values_json: [
          { value: 'D', meaning: 'D (Colorless)' },
          { value: 'E', meaning: 'E (Colorless)' },
          { value: 'F', meaning: 'F (Colorless)' },
          { value: 'G', meaning: 'G (Near Colorless)' },
          { value: 'H', meaning: 'H (Near Colorless)' },
          { value: 'I', meaning: 'I (Near Colorless)' },
          { value: 'J', meaning: 'J (Near Colorless)' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Clarity (Diamonds)',
        values_json: [
          { value: 'FL', meaning: 'Flawless' },
          { value: 'IF', meaning: 'Internally Flawless' },
          { value: 'VVS1', meaning: 'Very Very Slightly Included 1' },
          { value: 'VVS2', meaning: 'Very Very Slightly Included 2' },
          { value: 'VS1', meaning: 'Very Slightly Included 1' },
          { value: 'VS2', meaning: 'Very Slightly Included 2' },
          { value: 'SI1', meaning: 'Slightly Included 1' },
          { value: 'SI2', meaning: 'Slightly Included 2' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Carat Weight',
        values_json: [
          { value: '0.25', meaning: '0.25 ct' },
          { value: '0.50', meaning: '0.50 ct' },
          { value: '0.75', meaning: '0.75 ct' },
          { value: '1.00', meaning: '1.00 ct' },
          { value: '1.50', meaning: '1.50 ct' },
          { value: '2.00', meaning: '2.00 ct' },
          { value: '3.00', meaning: '3.00 ct' },
          { value: '5.00', meaning: '5.00 ct' }
        ],
        refreshed_at: new Date().toISOString()
      }
    ];
  }

  // Watch-specific test data
  if (categoryId === '31387') {
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
      },
      {
        aspect_name: 'Department',
        values_json: [
          { value: 'Men', meaning: 'Men' },
          { value: 'Women', meaning: 'Women' },
          { value: 'Unisex', meaning: 'Unisex' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Band Material',
        values_json: [
          { value: 'Leather', meaning: 'Leather' },
          { value: 'Metal', meaning: 'Metal' },
          { value: 'Rubber', meaning: 'Rubber' },
          { value: 'Fabric', meaning: 'Fabric' },
          { value: 'Ceramic', meaning: 'Ceramic' },
          { value: 'Silicone', meaning: 'Silicone' }
        ],
        refreshed_at: new Date().toISOString()
      },
      {
        aspect_name: 'Case Size',
        values_json: [
          { value: '28mm', meaning: '28mm' },
          { value: '32mm', meaning: '32mm' },
          { value: '36mm', meaning: '36mm' },
          { value: '40mm', meaning: '40mm' },
          { value: '42mm', meaning: '42mm' },
          { value: '44mm', meaning: '44mm' },
          { value: '46mm', meaning: '46mm' }
        ],
        refreshed_at: new Date().toISOString()
      }
    ];
  }

  // Jewelry-specific test data (existing categories)
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
        { value: 'Platinum', meaning: 'Platinum' }
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
        { value: 'Pearl', meaning: 'Pearl' }
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

        setAspects(transformedData);
        
        if (transformedData.length === 0) {
          console.log('No aspects found in database for category', categoryId);
        }
      } catch (err: any) {
        console.error('Error fetching eBay aspects:', err);
        setError(err.message || 'Failed to fetch aspects');
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
