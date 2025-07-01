
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2, Zap, Clock, Settings, Bug, Search, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';

export const TaskSchedulerTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isTestingEbay, setIsTestingEbay] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupDone, setCleanupDone] = useState(false);
  const [ebayTestDone, setEbayTestDone] = useState(false);
  const { tasks, refetch } = useTasks();

  const cleanupOrphanedCronJobs = async () => {
    setIsCleaning(true);
    try {
      console.log('Starting cron cleanup...');
      
      const { data, error } = await supabase.functions.invoke('cron-cleanup');

      if (error) {
        console.error('Cron cleanup error:', error);
        toast.error('Failed to cleanup orphaned cron jobs: ' + error.message);
        return;
      }

      console.log('Cron cleanup result:', data);
      toast.success(`✅ Cleanup completed! Found ${data.validTasks} valid tasks, cleaned ${data.orphanedJobsCleanedUp} orphaned cron jobs`);
      
      setCleanupDone(true);
      await refetch();
      
    } catch (error: any) {
      console.error('Error in cron cleanup:', error);
      toast.error('Error during cleanup: ' + error.message);
    } finally {
      setIsCleaning(false);
    }
  };

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
        toast.success(`✅ eBay API test successful! Found ${data.items.length} items`);
        setEbayTestDone(true);
      } else if (data.rateLimited) {
        toast.warning('⏰ eBay API rate limited. Wait a few minutes then try again.');
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
      toast.success(`✅ Task scheduler completed: ${data.message}`);
      
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
      toast.success(`✅ Task "${taskName}" test completed: ${data.message}`);
      
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
      
      const activeTasks = tasks.filter(task => task.status === 'active');
      
      if (activeTasks.length === 0) {
        toast.info('No active tasks found to schedule');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

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

      await refetch();

      if (successCount > 0) {
        toast.success(`✅ Successfully scheduled ${successCount} task(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      } else {
        toast.error(`❌ Failed to schedule any tasks (${errorCount} errors)`);
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
  const hasNoTasks = tasks.length === 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          System Diagnostic & Repair
        </CardTitle>
        <CardDescription>
          Fix all system issues step by step
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Cleanup */}
        <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800 mb-2">
            {cleanupDone ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="font-medium">Step 1: System Cleanup</span>
          </div>
          <Button 
            onClick={cleanupOrphanedCronJobs} 
            disabled={isCleaning || cleanupDone}
            variant={cleanupDone ? "secondary" : "default"}
            className="w-full"
          >
            {isCleaning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cleaning...
              </>
            ) : cleanupDone ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Cleanup Complete
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clean Up System
              </>
            )}
          </Button>
          <p className="text-xs text-blue-700">
            {cleanupDone ? 'System cleanup completed successfully!' : 'Remove orphaned processes and fix rate limiting issues'}
          </p>
        </div>

        {/* Step 2: eBay API Test */}
        <div className="space-y-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 text-sm text-yellow-800 mb-2">
            {ebayTestDone ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Search className="h-4 w-4" />}
            <span className="font-medium">Step 2: eBay API Test</span>
          </div>
          <Button 
            onClick={testEbayAPI} 
            disabled={isTestingEbay || (!cleanupDone) || ebayTestDone}
            variant={ebayTestDone ? "secondary" : "default"}
            className="w-full"
          >
            {isTestingEbay ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing API...
              </>
            ) : ebayTestDone ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                API Test Passed
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Test eBay API
              </>
            )}
          </Button>
          <p className="text-xs text-yellow-700">
            {ebayTestDone ? 'eBay API is working correctly!' : 'Verify eBay connection after cleanup'}
          </p>
        </div>

        {/* Step 3: Create Task (Manual) */}
        {hasNoTasks && (
          <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-sm text-green-800 mb-2">
              <Settings className="h-4 w-4" />
              <span className="font-medium">Step 3: Create Task</span>
            </div>
            <p className="text-sm text-green-700 mb-2">
              Click "Create Task" above to make a new Gold Scrap Scanner task.
            </p>
            <p className="text-xs text-green-600">
              ✓ Use these settings: Item Type = Jewelry, Max Price = $500, Keywords = "gold scrap"
            </p>
          </div>
        )}

        {/* Step 4: Test Task */}
        {goldScrapTask && (
          <div className="space-y-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 text-sm text-purple-800 mb-2">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Step 4: Test Gold Scanner</span>
            </div>
            <Button 
              onClick={() => testSpecificTask(goldScrapTask.id, goldScrapTask.name)} 
              disabled={isRunning || !ebayTestDone}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing Scanner...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Test Gold Scrap Scanner
                </>
              )}
            </Button>
            <p className="text-xs text-purple-700">
              Test your Gold Scrap Scanner task functionality
            </p>
          </div>
        )}

        {/* Manual run all tasks */}
        {activeTasks.length > 0 && (
          <div className="space-y-2">
            <Button 
              onClick={runTaskScheduler} 
              disabled={isRunning}
              variant="outline"
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
          </div>
        )}

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
            <span className="font-medium">System Status</span>
          </div>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• {tasks.length} total task(s) found</li>
            <li>• {activeTasks.length} active task(s)</li>
            <li>• {activeTasks.filter(t => t.cron_job_id).length} task(s) scheduled</li>
            <li>• System cleanup: {cleanupDone ? '✅ Complete' : '⏳ Pending'}</li>
            <li>• eBay API: {ebayTestDone ? '✅ Working' : '⏳ Not tested'}</li>
            {goldScrapTask ? (
              <>
                <li>• Gold Scanner: {goldScrapTask.cron_job_id ? '✅ Scheduled' : '⏳ Not scheduled'}</li>
                {goldScrapTask.last_run && (
                  <li>• Last run: {new Date(goldScrapTask.last_run).toLocaleString()}</li>
                )}
              </>
            ) : (
              <li>• Gold Scanner: {hasNoTasks ? '❌ Create new task' : '❌ Not found'}</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
