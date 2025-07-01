
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2, Zap, Clock, Settings, Bug, Search } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';

export const TaskSchedulerTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isTestingEbay, setIsTestingEbay] = useState(false);
  const { tasks, refetch } = useTasks();

  const testEbayAPI = async () => {
    setIsTestingEbay(true);
    try {
      console.log('Testing eBay API directly...');
      
      const { data, error } = await supabase.functions.invoke('ebay-search', {
        body: {
          keywords: 'jewelry gold',
          maxPrice: 500,
          listingType: ['Auction', 'FixedPrice'],
          minFeedback: 0
        }
      });

      if (error) {
        console.error('eBay API test error:', error);
        toast.error('eBay API test failed: ' + error.message);
        return;
      }

      console.log('eBay API test response:', data);
      
      if (data.success && data.items) {
        toast.success(`eBay API test successful! Found ${data.items.length} items`);
      } else {
        toast.error('eBay API test failed: ' + (data.error || 'Unknown error'));
      }
      
    } catch (error: any) {
      console.error('Error testing eBay API:', error);
      toast.error('Error testing eBay API: ' + error.message);
    } finally {
      setIsTestingEbay(false);
    }
  };

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
      toast.success(`Task scheduler completed: ${data.message}`);
      
      // Refresh tasks to see updated last_run
      await refetch();
      
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
      
      // Refresh tasks to see updated last_run
      await refetch();
      
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
  const goldScrapTask = activeTasks.find(task => task.name.toLowerCase().includes('gold') && task.name.toLowerCase().includes('scrap'));

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Task Scheduler Debug
        </CardTitle>
        <CardDescription>
          Test and debug task scheduling functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* eBay API Test */}
        <div className="space-y-2">
          <Button 
            onClick={testEbayAPI} 
            disabled={isTestingEbay}
            variant="outline"
            className="w-full"
          >
            {isTestingEbay ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing eBay API...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Test eBay API Connection
              </>
            )}
          </Button>
        </div>

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

          {goldScrapTask && (
            <Button 
              onClick={() => testSpecificTask(goldScrapTask.id, goldScrapTask.name)} 
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
                  Test Gold Scrap Scanner
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
            {goldScrapTask && (
              <li>• Gold Scrap Scanner: {goldScrapTask.cron_job_id ? 'Scheduled ✓' : 'Not Scheduled ✗'}</li>
            )}
            {goldScrapTask && goldScrapTask.last_run && (
              <li>• Last run: {new Date(goldScrapTask.last_run).toLocaleString()}</li>
            )}
          </ul>
        </div>

        {/* Debug Info */}
        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 text-sm text-yellow-800 mb-2">
            <Bug className="h-4 w-4" />
            <span className="font-medium">Debug Steps</span>
          </div>
          <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
            <li>First test eBay API connection</li>
            <li>Then test your specific task</li>
            <li>Check browser console for detailed logs</li>
            <li>Verify last_run timestamp updates</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
