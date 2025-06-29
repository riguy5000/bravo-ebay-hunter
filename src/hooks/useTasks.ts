
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  item_type: 'watch' | 'jewelry' | 'gemstone';
  status: 'active' | 'paused' | 'stopped';
  brand?: string;
  model?: string;
  reference_number?: string;
  filters_json?: any;
  price_min?: number;
  max_price?: number;
  price_delta_type?: 'absolute' | 'percent';
  price_delta_value?: number;
  price_percentage?: number;
  exclude_keywords?: string[];
  include_formats?: string[];
  listing_format?: string[];
  min_seller_feedback?: number;
  poll_interval?: number;
  auction_alert?: boolean;
  active?: boolean;
  watch_filters?: any;
  jewelry_filters?: any;
  gemstone_filters?: any;
  created_at: string;
  updated_at: string;
}

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('search_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        return;
      }

      setTasks(data || []);
    } catch (error) {
      console.error('Error in fetchTasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    // Map old field names to new schema
    const mappedData = {
      ...taskData,
      title: taskData.title || taskData.name, // Support both old and new field names
      user_id: user.id,
      active: taskData.active !== undefined ? taskData.active : true,
      poll_interval: taskData.poll_interval || 300,
    };

    // Remove old field name if present
    delete (mappedData as any).name;

    const { data, error } = await supabase
      .from('search_tasks')
      .insert(mappedData)
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    setTasks(prev => [data, ...prev]);
    return data;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('search_tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }

    setTasks(prev => prev.map(task => task.id === id ? data : task));
    return data;
  };

  const deleteTask = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('search_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }

    setTasks(prev => prev.filter(task => task.id !== id));
  };

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
  };
};
