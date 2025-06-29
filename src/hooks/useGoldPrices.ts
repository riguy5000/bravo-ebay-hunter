
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GoldPrice {
  metal: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  priceGram24k?: number;
  priceGram18k?: number;
  priceGram14k?: number;
  priceGram10k?: number;
  currency: string;
  lastUpdated: string;
}

export const useGoldPrices = () => {
  const [prices, setPrices] = useState<GoldPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke('get-gold-prices');

      if (functionError) {
        throw functionError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setPrices(data.prices || []);
    } catch (err: any) {
      console.error('Error fetching gold prices:', err);
      setError(err.message || 'Failed to fetch gold prices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    
    // Refresh prices every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    prices,
    loading,
    error,
    refetch: fetchPrices,
  };
};
