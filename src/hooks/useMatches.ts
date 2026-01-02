import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface BaseMatch {
  id: string;
  task_id: string;
  user_id: string;
  ebay_listing_id: string;
  ebay_title: string;
  ebay_url?: string;
  listed_price: number;
  shipping_cost?: number;
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
  stone_type?: string;
  treatment?: string;
  is_natural?: boolean;
  classification?: string;
  deal_score?: number;
  risk_score?: number;
  dimensions?: { length_mm?: number; width_mm?: number; depth_mm?: number };
  origin?: string;
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

// Maximum matches to load per table (for performance)
const MAX_MATCHES_PER_TABLE = 2000;

// Fetch function extracted for React Query
const fetchMatchesData = async (): Promise<{ groups: TaskWithMatches[]; totalCount: number }> => {
  const [tasksResult, watchData, jewelryData, gemstoneData, watchCount, jewelryCount, gemstoneCount] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, user_id, name, item_type, status, max_price, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('matches_watch')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_MATCHES_PER_TABLE),
    supabase
      .from('matches_jewelry')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_MATCHES_PER_TABLE),
    supabase
      .from('matches_gemstone')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_MATCHES_PER_TABLE),
    // Get counts for each table
    supabase.from('matches_watch').select('id', { count: 'exact', head: true }),
    supabase.from('matches_jewelry').select('id', { count: 'exact', head: true }),
    supabase.from('matches_gemstone').select('id', { count: 'exact', head: true })
  ]);

  if (tasksResult.error) console.error('Error fetching tasks:', tasksResult.error);
  if (watchData.error) console.error('Error fetching watch matches:', watchData.error);
  if (jewelryData.error) console.error('Error fetching jewelry matches:', jewelryData.error);
  if (gemstoneData.error) console.error('Error fetching gemstone matches:', gemstoneData.error);

  const tasks = tasksResult.data || [];
  const allMatches: Match[] = [
    ...((watchData.data as WatchMatch[]) || []),
    ...((jewelryData.data as JewelryMatch[]) || []),
    ...((gemstoneData.data as GemstoneMatch[]) || [])
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

  // Use actual database counts (not limited counts)
  const actualTotalCount = (watchCount.count || 0) + (jewelryCount.count || 0) + (gemstoneCount.count || 0);

  // Log if results were truncated
  if (actualTotalCount > allMatches.length) {
    console.log(`📊 Matches loaded: ${allMatches.length} of ${actualTotalCount} total (limited to ${MAX_MATCHES_PER_TABLE} per table)`);
  }

  return { groups, totalCount: actualTotalCount };
};

export const useMatches = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use React Query for caching - data persists when navigating away
  const { data, isLoading: loading, isFetching, refetch: queryRefetch } = useQuery({
    queryKey: ['matches', user?.id],
    queryFn: fetchMatchesData,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });

  const taskGroups = data?.groups || [];
  const totalCount = data?.totalCount || 0;

  const refetch = useCallback(() => {
    queryRefetch();
  }, [queryRefetch]);

  // Real-time subscriptions for live updates
  useEffect(() => {
    if (!user) return;

    const channels: RealtimeChannel[] = [];

    // Helper to add a new match to the React Query cache
    const handleNewMatch = (newMatch: Match) => {
      queryClient.setQueryData<{ groups: TaskWithMatches[]; totalCount: number }>(
        ['matches', user.id],
        (oldData) => {
          if (!oldData) return oldData;

          const newGroups = oldData.groups.map(group => {
            if (group.task.id === newMatch.task_id) {
              // Check if match already exists (avoid duplicates)
              if (group.matches.some(m => m.id === newMatch.id)) {
                return group;
              }
              // Add new match at the beginning (newest first)
              return {
                ...group,
                matches: [newMatch, ...group.matches],
                matchCount: group.matchCount + 1
              };
            }
            return group;
          });

          return {
            groups: newGroups,
            totalCount: oldData.totalCount + 1
          };
        }
      );
    };

    // Subscribe to each matches table
    const tables = ['matches_watch', 'matches_jewelry', 'matches_gemstone'] as const;

    for (const table of tables) {
      const channel = supabase
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: table
          },
          (payload) => {
            console.log(`🔔 New ${table} match:`, payload.new);
            handleNewMatch(payload.new as Match);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Subscribed to ${table} real-time updates`);
          }
        });

      channels.push(channel);
    }

    // Cleanup subscriptions on unmount
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [user, queryClient]);

  const updateMatch = async (id: string, itemType: string, updates: Partial<Match>) => {
    if (!user) return;

    const tableName = `matches_${itemType}` as const;

    const { data, error } = await supabase
      .from(tableName as 'matches_watch' | 'matches_jewelry' | 'matches_gemstone')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${itemType} match:`, error);
      throw error;
    }

    // Update the match in the React Query cache
    queryClient.setQueryData<{ groups: TaskWithMatches[]; totalCount: number }>(
      ['matches', user.id],
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          groups: oldData.groups.map(group => ({
            ...group,
            matches: group.matches.map(match =>
              match.id === id ? { ...match, ...(data as Match) } : match
            )
          }))
        };
      }
    );

    return data;
  };

  return {
    taskGroups,
    loading,
    isFetching,
    totalCount,
    updateMatch,
    refetch,
  };
};
