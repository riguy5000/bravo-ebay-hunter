
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface BaseMatch {
  id: string;
  task_id: string;
  ebay_listing_id: string;
  ebay_title: string;
  ebay_url?: string;
  listed_price: number;
  currency: string;
  buy_format?: string;
  seller_feedback?: number;
  found_at: string;
  status: 'new' | 'purchased' | 'returned' | 'sold';
  offer1?: number;
  offer2?: number;
  offer3?: number;
  offer4?: number;
  offer5?: number;
  purchased_toggle: boolean;
  arrived_toggle: boolean;
  return_toggle: boolean;
  shipped_back_toggle: boolean;
  refunded_toggle: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatchMatch extends BaseMatch {
  case_material?: string;
  band_material?: string;
  movement?: string;
  dial_colour?: string;
  case_size_mm?: number;
  chrono24_avg?: number;
  chrono24_low?: number;
  price_diff_percent?: number;
}

export interface JewelryMatch extends BaseMatch {
  weight_g?: number;
  karat?: number;
  metal_type?: string;
  spot_price_oz?: number;
  melt_value?: number;
  refiner_fee_pct?: number;
  profit_scrap?: number;
}

export interface GemstoneMatch extends BaseMatch {
  shape?: string;
  carat?: number;
  colour?: string;
  clarity?: string;
  cut_grade?: string;
  cert_lab?: string;
  rapnet_avg?: number;
  rapaport_list?: number;
  price_diff_percent?: number;
}

export type Match = WatchMatch | JewelryMatch | GemstoneMatch;

export const useMatches = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<{
    watches: WatchMatch[];
    jewelry: JewelryMatch[];
    gemstones: GemstoneMatch[];
  }>({
    watches: [],
    jewelry: [],
    gemstones: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [user]);

  const fetchMatches = async () => {
    if (!user) return;

    try {
      // Fetch matches from all three tables
      const [watchesResult, jewelryResult, gemstonesResult] = await Promise.all([
        supabase
          .from('matches_watch')
          .select('*, search_tasks!inner(user_id)')
          .eq('search_tasks.user_id', user.id)
          .order('found_at', { ascending: false }),
        supabase
          .from('matches_jewelry')
          .select('*, search_tasks!inner(user_id)')
          .eq('search_tasks.user_id', user.id)
          .order('found_at', { ascending: false }),
        supabase
          .from('matches_gemstone')
          .select('*, search_tasks!inner(user_id)')
          .eq('search_tasks.user_id', user.id)
          .order('found_at', { ascending: false })
      ]);

      if (watchesResult.error) console.error('Error fetching watch matches:', watchesResult.error);
      if (jewelryResult.error) console.error('Error fetching jewelry matches:', jewelryResult.error);
      if (gemstonesResult.error) console.error('Error fetching gemstone matches:', gemstonesResult.error);

      setMatches({
        watches: watchesResult.data || [],
        jewelry: jewelryResult.data || [],
        gemstones: gemstonesResult.data || []
      });
    } catch (error) {
      console.error('Error in fetchMatches:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMatchStatus = async (id: string, type: 'watch' | 'jewelry' | 'gemstone', updates: Partial<BaseMatch>) => {
    if (!user) return;

    const tableName = `matches_${type}`;
    const { data, error } = await supabase
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${type} match:`, error);
      throw error;
    }

    // Update local state
    setMatches(prev => ({
      ...prev,
      [type === 'watch' ? 'watches' : type === 'jewelry' ? 'jewelry' : 'gemstones']: 
        prev[type === 'watch' ? 'watches' : type === 'jewelry' ? 'jewelry' : 'gemstones']
          .map(match => match.id === id ? data : match)
    }));

    return data;
  };

  return {
    matches,
    loading,
    updateMatchStatus,
    refetch: fetchMatches,
  };
};
