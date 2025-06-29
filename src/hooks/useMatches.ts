
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface Match {
  id: string;
  task_id: string;
  user_id: string;
  ebay_item_id: string;
  title: string;
  price: number;
  seller_name?: string;
  seller_feedback?: number;
  listing_url?: string;
  image_url?: string;
  end_time?: string;
  status: 'new' | 'reviewed' | 'offered' | 'purchased' | 'passed';
  offer_amount?: number;
  notes?: string;
  ai_score?: number;
  ai_reasoning?: string;
  created_at: string;
  updated_at: string;
}

export const useMatches = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [user]);

  const fetchMatches = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching matches:', error);
        return;
      }

      setMatches(data || []);
    } catch (error) {
      console.error('Error in fetchMatches:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMatchStatus = async (id: string, status: Match['status'], notes?: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('matches')
      .update({ status, notes })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating match:', error);
      throw error;
    }

    setMatches(prev => prev.map(match => match.id === id ? data : match));
    return data;
  };

  return {
    matches,
    loading,
    updateMatchStatus,
    refetch: fetchMatches,
  };
};
