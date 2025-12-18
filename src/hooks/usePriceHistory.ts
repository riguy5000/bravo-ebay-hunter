import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PriceHistoryPoint {
  date: string;
  price: number;
  priceGram24k: number;
  priceGram14k: number;
}

export interface MetalPriceHistory {
  metal: string;
  symbol: string;
  data: PriceHistoryPoint[];
}

export const usePriceHistory = (days: number = 30) => {
  const [history, setHistory] = useState<MetalPriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error: fetchError } = await supabase
        .from('metal_price_history')
        .select('*')
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', endDate.toISOString())
        .order('recorded_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Group by metal
      const grouped = new Map<string, PriceHistoryPoint[]>();
      const metalInfo = new Map<string, string>();

      (data || []).forEach((record: any) => {
        const symbol = record.symbol;
        if (!grouped.has(symbol)) {
          grouped.set(symbol, []);
          metalInfo.set(symbol, record.metal);
        }

        grouped.get(symbol)!.push({
          date: new Date(record.recorded_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          }),
          price: parseFloat(record.price),
          priceGram24k: parseFloat(record.price_gram_24k || 0),
          priceGram14k: parseFloat(record.price_gram_14k || 0),
        });
      });

      // Convert to array format
      const historyArray: MetalPriceHistory[] = [];
      grouped.forEach((data, symbol) => {
        historyArray.push({
          metal: metalInfo.get(symbol) || symbol,
          symbol,
          data
        });
      });

      setHistory(historyArray);
    } catch (err: any) {
      console.error('Error fetching price history:', err);
      setError(err.message || 'Failed to fetch price history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [days]);

  return {
    history,
    loading,
    error,
    refetch: fetchHistory,
  };
};
