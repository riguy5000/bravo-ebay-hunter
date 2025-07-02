import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface BaseMatch {
  id: string;
  task_id: string;
  user_id: string;
  ebay_listing_id: string;
  ebay_title: string;
  ebay_url?: string;
  listed_price: number;
  currency?: string;
  buy_format?: string;
  seller_feedback?: number;
  found_at: string;
  status: 'new' | 'reviewed' | 'offered' | 'purchased' | 'passed';
  offer1?: number;
  offer2?: number;
  offer3?: number;
  offer4?: number;
  offer5?: number;
  purchased_toggle?: boolean;
  arrived_toggle?: boolean;
  return_toggle?: boolean;
  shipped_back_toggle?: boolean;
  refunded_toggle?: boolean;
  ai_score?: number;
  ai_reasoning?: string;
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
  const [watchMatches, setWatchMatches] = useState<WatchMatch[]>([]);
  const [jewelryMatches, setJewelryMatches] = useState<JewelryMatch[]>([]);
  const [gemstoneMatches, setGemstoneMatches] = useState<GemstoneMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 50; // Increased from 25 to 50 for better UX

  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [user, page]);

  const fetchMatches = async (resetData = false) => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Calculate offset for pagination
      const offset = resetData ? 0 : (page - 1) * itemsPerPage;
      
      // Fetch all match types in parallel with increased pagination
      const [watchData, jewelryData, gemstoneData] = await Promise.all([
        supabase
          .from('matches_watch')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + itemsPerPage - 1),
        supabase
          .from('matches_jewelry')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + itemsPerPage - 1),
        supabase
          .from('matches_gemstone')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + itemsPerPage - 1)
      ]);

      if (watchData.error) console.error('Error fetching watch matches:', watchData.error);
      if (jewelryData.error) console.error('Error fetching jewelry matches:', jewelryData.error);
      if (gemstoneData.error) console.error('Error fetching gemstone matches:', gemstoneData.error);

      const newWatchMatches = watchData.data || [];
      const newJewelryMatches = jewelryData.data || [];
      const newGemstoneMatches = gemstoneData.data || [];

      if (resetData || page === 1) {
        setWatchMatches(newWatchMatches);
        setJewelryMatches(newJewelryMatches);
        setGemstoneMatches(newGemstoneMatches);
      } else {
        setWatchMatches(prev => [...prev, ...newWatchMatches]);
        setJewelryMatches(prev => [...prev, ...newJewelryMatches]);
        setGemstoneMatches(prev => [...prev, ...newGemstoneMatches]);
      }

      // Check if there are more items to load
      const totalNewItems = newWatchMatches.length + newJewelryMatches.length + newGemstoneMatches.length;
      setHasMore(totalNewItems === itemsPerPage * 3); // More accurate estimation
      
    } catch (error) {
      console.error('Error in fetchMatches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
    }
  };

  const refetch = () => {
    setPage(1);
    fetchMatches(true);
  };

  const updateWatchMatch = async (id: string, updates: Partial<WatchMatch>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('matches_watch')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating watch match:', error);
      throw error;
    }

    setWatchMatches(prev => prev.map(match => match.id === id ? data : match));
    return data;
  };

  const updateJewelryMatch = async (id: string, updates: Partial<JewelryMatch>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('matches_jewelry')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating jewelry match:', error);
      throw error;
    }

    setJewelryMatches(prev => prev.map(match => match.id === id ? data : match));
    return data;
  };

  const updateGemstoneMatch = async (id: string, updates: Partial<GemstoneMatch>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('matches_gemstone')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating gemstone match:', error);
      throw error;
    }

    setGemstoneMatches(prev => prev.map(match => match.id === id ? data : match));
    return data;
  };

  return {
    watchMatches,
    jewelryMatches,
    gemstoneMatches,
    loading,
    hasMore,
    loadMore,
    updateWatchMatch,
    updateJewelryMatch,
    updateGemstoneMatch,
    refetch,
  };
};
