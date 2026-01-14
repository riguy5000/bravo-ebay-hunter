
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface Task {
  id: string;
  user_id: string;
  name: string;
  item_type: 'watch' | 'jewelry' | 'gemstone';
  status: 'active' | 'paused' | 'stopped';
  max_price?: number;
  min_price?: number;
  price_percentage?: number;
  listing_format?: string[];
  min_seller_feedback?: number;
  poll_interval?: number;
  watch_filters?: any;
  jewelry_filters?: any;
  gemstone_filters?: any;
  // New V2 fields
  exclude_keywords?: string[];
  max_detail_fetches?: number;
  min_profit_margin?: number;
  price_delta_type?: string;
  price_delta_value?: number;
  auction_alert?: boolean;
  date_from?: string;
  date_to?: string;
  item_location?: string;
  // Automatic scheduling fields
  last_run?: string;
  cron_job_id?: number;
  // Slack notification settings
  slack_channel?: string;
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
      // Fetch all tasks (shared across all users)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
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

  const manageCronJob = async (taskId: string, action: 'schedule' | 'unschedule', pollInterval?: number) => {
    try {
      console.log(`Managing cron job: ${action} for task ${taskId}`);
      
      const { data, error } = await supabase.functions.invoke('cron-manager', {
        body: {
          action,
          taskId,
          pollInterval
        }
      });

      if (error) {
        console.error('Error managing cron job:', error);
        throw error;
      }

      console.log('Cron job managed successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to manage cron job:', error);
      throw error;
    }
  };

  const createTask = async (taskData: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    const mappedData = {
      ...taskData,
      user_id: user.id,
      poll_interval: taskData.poll_interval || 30,
      price_delta_type: taskData.price_delta_type || 'absolute',
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(mappedData)
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    // If the task is active, schedule its cron job
    if (data.status === 'active') {
      try {
        await manageCronJob(data.id, 'schedule', data.poll_interval || 300);
      } catch (cronError) {
        console.error('Failed to schedule cron job for new task:', cronError);
        // Don't throw here - the task was created successfully, just log the cron error
      }
    }

    setTasks(prev => [data, ...prev]);
    return data;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;

    // Get the current task to compare status changes
    const currentTask = tasks.find(t => t.id === id);
    if (!currentTask) {
      throw new Error('Task not found');
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }

    // Handle cron job scheduling based on status changes
    const oldStatus = currentTask.status;
    const newStatus = data.status;
    const pollInterval = data.poll_interval || 300;

    try {
      if (oldStatus !== 'active' && newStatus === 'active') {
        // Task became active - schedule cron job
        await manageCronJob(data.id, 'schedule', pollInterval);
      } else if (oldStatus === 'active' && newStatus !== 'active') {
        // Task became inactive - unschedule cron job
        await manageCronJob(data.id, 'unschedule');
      } else if (newStatus === 'active' && updates.poll_interval && updates.poll_interval !== currentTask.poll_interval) {
        // Poll interval changed for active task - reschedule
        await manageCronJob(data.id, 'unschedule');
        await manageCronJob(data.id, 'schedule', pollInterval);
      }
    } catch (cronError) {
      console.error('Failed to manage cron job during task update:', cronError);
      // Don't throw here - the task was updated successfully, just log the cron error
    }

    setTasks(prev => prev.map(task => task.id === id ? data : task));
    return data;
  };

  const deleteTask = async (id: string) => {
    if (!user) return;

    // Always try to unschedule the cron job before deletion (regardless of status)
    // This prevents orphaned cron jobs if the task was active or had a lingering cron job
    try {
      console.log(`Unscheduling cron job for task ${id} before deletion...`);
      await manageCronJob(id, 'unschedule');
      console.log(`Cron job unscheduled successfully for task ${id}`);
    } catch (cronError) {
      console.error('Failed to unschedule cron job before deletion:', cronError);
      // Continue with deletion even if cron cleanup fails - the cron job might not exist
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }

    setTasks(prev => prev.filter(task => task.id !== id));
  };

  // Clean up orphaned cron jobs (cron jobs that reference deleted tasks)
  const cleanupOrphanedCronJobs = async () => {
    try {
      console.log('Cleaning up orphaned cron jobs...');

      const { data, error } = await supabase.functions.invoke('cron-cleanup', {
        body: { action: 'cleanup-orphaned' }
      });

      if (error) {
        console.error('Error cleaning up orphaned cron jobs:', error);
        throw error;
      }

      console.log('Orphaned cron jobs cleanup result:', data);
      return data;
    } catch (error) {
      console.error('Failed to cleanup orphaned cron jobs:', error);
      throw error;
    }
  };

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
    cleanupOrphanedCronJobs,
  };
};
