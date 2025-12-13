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

export interface Task {
  id: string;
  user_id: string;
  name: string;
  item_type: 'watch' | 'jewelry' | 'gemstone';
  status: 'active' | 'paused' | 'stopped';
  max_price?: number;
  created_at: string;
}

export interface TaskWithMatches {
  task: Task;
  matches: Match[];
  matchCount: number;
}

export const useMatches = () => {
  const { user } = useAuth();
  const [taskGroups, setTaskGroups] = useState<TaskWithMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchMatchesByTask();
    }
  }, [user]);

  const fetchMatchesByTask = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch tasks and all matches in parallel
      const [tasksResult, watchData, jewelryData, gemstoneData] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, user_id, name, item_type, status, max_price, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('matches_watch')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('matches_jewelry')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('matches_gemstone')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      if (tasksResult.error) console.error('Error fetching tasks:', tasksResult.error);
      if (watchData.error) console.error('Error fetching watch matches:', watchData.error);
      if (jewelryData.error) console.error('Error fetching jewelry matches:', jewelryData.error);
      if (gemstoneData.error) console.error('Error fetching gemstone matches:', gemstoneData.error);

      const tasks = tasksResult.data || [];
      const allMatches: Match[] = [
        ...(watchData.data || []),
        ...(jewelryData.data || []),
        ...(gemstoneData.data || [])
      ];

      // Group matches by task_id
      const matchesByTaskId = new Map<string, Match[]>();
      for (const match of allMatches) {
        const existing = matchesByTaskId.get(match.task_id) || [];
        existing.push(match);
        matchesByTaskId.set(match.task_id, existing);
      }

      // Build task groups with matches
      const groups: TaskWithMatches[] = tasks.map(task => {
        const matches = matchesByTaskId.get(task.id) || [];
        // Sort matches by created_at descending (newest first)
        matches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
          task,
          matches,
          matchCount: matches.length
        };
      });

      setTaskGroups(groups);
      setTotalCount(allMatches.length);

    } catch (error) {
      console.error('Error in fetchMatchesByTask:', error);
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchMatchesByTask();
  };

  const updateMatch = async (id: string, itemType: string, updates: Partial<Match>) => {
    if (!user) return;

    const tableName = `matches_${itemType}`;

    const { data, error } = await supabase
      .from(tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${itemType} match:`, error);
      throw error;
    }

    // Update the match in the task groups
    setTaskGroups(prev => prev.map(group => ({
      ...group,
      matches: group.matches.map(match => match.id === id ? { ...match, ...data } : match)
    })));

    return data;
  };

  return {
    taskGroups,
    loading,
    totalCount,
    updateMatch,
    refetch,
  };
};
