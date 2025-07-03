
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
  const [apiStatus, setApiStatus] = useState<string>('unknown');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

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
      setApiStatus(data.apiStatus || 'unknown');
      setLastUpdate(data.lastUpdate || new Date().toISOString());
    } catch (err: any) {
      console.error('Error fetching gold prices:', err);
      setError(err.message || 'Failed to fetch gold prices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    
    // Set up real-time subscription to metal_prices table
    const channel = supabase
      .channel('metal-prices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'metal_prices'
        },
        (payload) => {
          console.log('Metal prices updated in database:', payload);
          fetchPrices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    prices,
    loading,
    error,
    apiStatus,
    lastUpdate,
    refetch: fetchPrices,
  };
};
