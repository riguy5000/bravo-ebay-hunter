
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2, Zap, Clock, Settings } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';

export const TaskSchedulerTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const { tasks, refetch } = useTasks();

  const runTaskScheduler = async () => {
    setIsRunning(true);
    try {
      console.log('Triggering manual task scheduler...');
      
      const { data, error } = await supabase.functions.invoke('task-scheduler', {
        body: {}
      });

      if (error) {
        console.error('Task scheduler error:', error);
        toast.error('Failed to run task scheduler: ' + error.message);
        return;
      }

      console.log('Task scheduler response:', data);
      toast.success(`Manual task scheduler completed: ${data.message}`);
      
    } catch (error: any) {
      console.error('Error invoking task scheduler:', error);
      toast.error('Error running task scheduler: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const testSpecificTask = async (taskId: string, taskName: string) => {
    setIsRunning(true);
    try {
      console.log(`Testing specific task: ${taskName} (${taskId})`);
      
      const { data, error } = await supabase.functions.invoke('task-scheduler', {
        body: { taskId }
      });

      if (error) {
        console.error('Task scheduler error:', error);
        toast.error(`Failed to test task "${taskName}": ${error.message}`);
        return;
      }

      console.log('Task scheduler response:', data);
      toast.success(`Task "${taskName}" test completed: ${data.message}`);
      
    } catch (error: any) {
      console.error('Error testing specific task:', error);
      toast.error(`Error testing task "${taskName}": ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const fixCronScheduling = async () => {
    setIsScheduling(true);
    try {
      console.log('Fixing cron scheduling for active tasks...');
      
      // Get all active tasks
      const activeTasks = tasks.filter(task => task.status === 'active');
      
      if (activeTasks.length === 0) {
        toast.info('No active tasks found to schedule');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Schedule each active task
      for (const task of activeTasks) {
        try {
          console.log(`Scheduling task: ${task.name}`);
          
          const { data, error } = await supabase.functions.invoke('cron-manager', {
            body: {
              action: 'schedule',
              taskId: task.id,
              pollInterval: task.poll_interval || 300
            }
          });

          if (error) {
            console.error(`Failed to schedule task ${task.name}:`, error);
            errorCount++;
          } else {
            console.log(`Successfully scheduled task ${task.name}:`, data);
            successCount++;
          }
        } catch (error: any) {
          console.error(`Error scheduling task ${task.name}:`, error);
          errorCount++;
        }
      }

      // Refresh tasks to see updated cron_job_id values
      await refetch();

      if (successCount > 0) {
        toast.success(`Successfully scheduled ${successCount} task(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      } else {
        toast.error(`Failed to schedule any tasks (${errorCount} errors)`);
      }
      
    } catch (error: any) {
      console.error('Error fixing cron scheduling:', error);
      toast.error('Error fixing cron scheduling: ' + error.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const activeTasks = tasks.filter(task => task.status === 'active');
  const newNewNewTask = tasks.find(task => task.name.toLowerCase().includes('new new new'));

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Task Scheduler Test
        </CardTitle>
        <CardDescription>
          Test and fix task scheduling functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manual Test Buttons */}
        <div className="space-y-2">
          <Button 
            onClick={runTaskScheduler} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run All Active Tasks
              </>
            )}
          </Button>

          {newNewNewTask && (
            <Button 
              onClick={() => testSpecificTask(newNewNewTask.id, newNewNewTask.name)} 
              disabled={isRunning}
              variant="outline"
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Test "new new new" Task
                </>
              )}
            </Button>
          )}
        </div>

        {/* Fix Scheduling Button */}
        <div className="border-t pt-4">
          <Button 
            onClick={fixCronScheduling} 
            disabled={isScheduling || activeTasks.length === 0}
            variant="secondary"
            className="w-full"
          >
            {isScheduling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Fix Automatic Scheduling
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 mt-1">
            {activeTasks.length === 0 
              ? 'No active tasks to schedule' 
              : `Will schedule ${activeTasks.length} active task(s)`
            }
          </p>
        </div>
        
        {/* Status Info */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800 mb-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Current Status</span>
          </div>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• {activeTasks.length} active task(s) found</li>
            <li>• {activeTasks.filter(t => t.cron_job_id).length} task(s) scheduled</li>
            <li>• {activeTasks.filter(t => !t.cron_job_id).length} task(s) need scheduling</li>
            {newNewNewTask && (
              <li>• "new new new" task: {newNewNewTask.cron_job_id ? 'Scheduled ✓' : 'Not Scheduled ✗'}</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
