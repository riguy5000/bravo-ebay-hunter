import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2, Zap, Clock, Settings, Bug, Search, Trash2, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
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
    setCleanupDone(false);
    try {
      console.log('Starting AGGRESSIVE cron cleanup...');
      
      const { data, error } = await supabase.functions.invoke('cron-cleanup');

      if (error) {
        console.error('Cron cleanup error:', error);
        toast.error('Failed to cleanup cron jobs: ' + error.message);
        return;
      }

      console.log('Aggressive cleanup result:', data);
      
      if (data.success) {
        toast.success(`🚫 ALL CRON JOBS STOPPED! Cleaned ${data.cronJobsCleaned} jobs, reset ${data.tasksReset} tasks`);
        setCleanupDone(true);
        setEbayTestDone(false); // Reset eBay test status
        
        // Show important waiting message
        setTimeout(() => {
          toast.info('⏳ WAIT 2-3 minutes before testing eBay API for rate limits to reset');
        }, 2000);
      } else {
        toast.error('Cleanup failed: ' + data.error);
      }
      
      await refetch();
      
    } catch (error: any) {
      console.error('Error in aggressive cleanup:', error);
      toast.error('Error during cleanup: ' + error.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const testEbayAPI = async () => {
    setIsTestingEbay(true);
    setEbayTestDone(false);
    try {
      console.log('Testing eBay API after cleanup...');
      
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
      
      if (data.success && data.items && data.items.length > 0) {
        toast.success(`🎉 eBay API WORKING! Found ${data.items.length} items - Rate limits cleared!`);
        setEbayTestDone(true);
      } else if (data.rateLimited) {
        toast.warning('⏰ Still rate limited. Wait a bit longer and try again.');
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
          Emergency System Repair
        </CardTitle>
        <CardDescription>
          STOP ALL cron jobs → Wait → Test APIs → Create new task
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: CRITICAL - Stop All Cron Jobs */}
        <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-800 mb-2">
            {cleanupDone ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="font-medium">🚨 STEP 1: STOP ALL CRON JOBS</span>
          </div>
          <Button 
            onClick={cleanupOrphanedCronJobs} 
            disabled={isCleaning}
            variant={cleanupDone ? "secondary" : "destructive"}
            className="w-full"
          >
            {isCleaning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                STOPPING ALL JOBS...
              </>
            ) : cleanupDone ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                ALL JOBS STOPPED ✅
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                STOP ALL CRON JOBS NOW
              </>
            )}
          </Button>
          <p className="text-xs text-red-700 font-medium">
            {cleanupDone ? 
              '✅ ALL cron jobs stopped! Wait 2-3 minutes then test eBay API.' : 
              '⚠️ CRITICAL: Your Gold Scrap Scanner is running every 10 seconds and overwhelming the eBay API!'
            }
          </p>
        </div>

        {/* Step 2: Wait Message */}
        {cleanupDone && !ebayTestDone && (
          <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 text-sm text-orange-800 mb-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">⏳ STEP 2: WAIT 2-3 MINUTES</span>
            </div>
            <p className="text-sm text-orange-700">
              eBay API rate limits are resetting. Wait 2-3 minutes before testing.
            </p>
            <p className="text-xs text-orange-600">
              The cron job was calling eBay every 10 seconds - now it's stopped!
            </p>
          </div>
        )}

        {/* Step 3: Test eBay API */}
        <div className="space-y-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 text-sm text-yellow-800 mb-2">
            {ebayTestDone ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Search className="h-4 w-4" />}
            <span className="font-medium">STEP 3: Test eBay API</span>
          </div>
          <Button 
            onClick={testEbayAPI} 
            disabled={isTestingEbay || !cleanupDone || ebayTestDone}
            variant={ebayTestDone ? "secondary" : "default"}
            className="w-full"
          >
            {isTestingEbay ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing eBay API...
              </>
            ) : ebayTestDone ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                eBay API Working! ✅
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Test eBay API Now
              </>
            )}
          </Button>
          <p className="text-xs text-yellow-700">
            {ebayTestDone ? 
              '🎉 eBay API is working! Rate limits cleared.' :
              cleanupDone ? 
                'Test if eBay API is working after cleanup' :
                'Complete Step 1 first'
            }
          </p>
        </div>

        {/* Step 4: Create New Task (if no tasks) */}
        {hasNoTasks && ebayTestDone && (
          <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-sm text-green-800 mb-2">
              <Plus className="h-4 w-4" />
              <span className="font-medium">STEP 4: Create New Task</span>
            </div>
            <p className="text-sm text-green-700 mb-2">
              Click "Create Task" button to make a new Gold Scrap Scanner.
            </p>
            <p className="text-xs text-green-600 font-medium">
              ⚠️ Set Poll Interval to 300 seconds (5 minutes) - NOT 10 seconds!
            </p>
          </div>
        )}

        {/* System Status */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800 mb-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">System Status</span>
          </div>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Cron cleanup: {cleanupDone ? '✅ ALL STOPPED' : '❌ REQUIRED'}</li>
            <li>• eBay API: {ebayTestDone ? '✅ Working' : cleanupDone ? '⏳ Wait 2-3 min' : '❌ Rate limited'}</li>
            <li>• {tasks.length} total task(s) | {activeTasks.length} active</li>
            {goldScrapTask && (
              <li>• Gold Scanner: {cleanupDone ? '🚫 Cron stopped' : '🔥 Spamming APIs!'}</li>
            )}
          </ul>
        </div>

        {/* Emergency Actions - Keep existing code */}
        <div className="border-t pt-4 space-y-2">
          <p className="text-xs text-gray-500 text-center">Emergency Actions</p>
          
          {/* Manual run all tasks */}
          {activeTasks.length > 0 && (
            <Button 
              onClick={runTaskScheduler} 
              disabled={isRunning}
              variant="outline"
              className="w-full"
              size="sm"
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
          )}

          {/* Fix Scheduling Button */}
          <Button 
            onClick={fixCronScheduling} 
            disabled={isScheduling || activeTasks.length === 0}
            variant="secondary"
            className="w-full"
            size="sm"
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
        </div>
      </CardContent>
    </Card>
  );
};
