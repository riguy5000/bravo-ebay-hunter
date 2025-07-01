
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2, Zap, Clock, Settings, Bug, Search, Trash2, AlertTriangle, CheckCircle, Plus, DollarSign } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';

export const TaskSchedulerTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isTestingEbay, setIsTestingEbay] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isUpdatingMetalPrices, setIsUpdatingMetalPrices] = useState(false);
  const [cleanupDone, setCleanupDone] = useState(false);
  const [ebayTestDone, setEbayTestDone] = useState(false);
  const [metalPricesUpdated, setMetalPricesUpdated] = useState(false);
  const { tasks, refetch } = useTasks();

  const updateMetalPrices = async () => {
    setIsUpdatingMetalPrices(true);
    setMetalPricesUpdated(false);
    try {
      console.log('Updating metal prices...');
      
      const { data, error } = await supabase.functions.invoke('metal-price-scheduler');

      if (error) {
        console.error('Metal price update error:', error);
        toast.error('Failed to update metal prices: ' + error.message);
        return;
      }

      console.log('Metal price update result:', data);
      
      if (data.success) {
        const message = data.message || 'Metal prices updated successfully';
        toast.success(`💰 ${message}`);
        setMetalPricesUpdated(true);
      } else {
        toast.error('Metal price update failed: ' + (data.error || 'Unknown error'));
      }
      
    } catch (error: any) {
      console.error('Error updating metal prices:', error);
      toast.error('Error updating metal prices: ' + error.message);
    } finally {
      setIsUpdatingMetalPrices(false);
    }
  };

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
        setMetalPricesUpdated(false); // Reset metal prices status
        
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
          listingType: ['Auction', 'Fixed Price (BIN)'],
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
          console.log(`Scheduling eBay task: ${task.name}`);
          
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

      // Also schedule metal price updates
      try {
        console.log('Scheduling metal price updates...');
        const { data, error } = await supabase.functions.invoke('cron-manager', {
          body: {
            action: 'schedule-metal-prices',
            metalInterval: 86400 // Daily
          }
        });

        if (!error) {
          console.log('Metal price scheduler setup successfully:', data);
          toast.info('🥇 Metal price scheduler also configured for daily updates');
        }
      } catch (error: any) {
        console.error('Error scheduling metal prices:', error);
      }

      await refetch();

      if (successCount > 0) {
        toast.success(`✅ Successfully scheduled ${successCount} eBay task(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
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
  const hasNoTasks = tasks.length === 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Dual Scheduler Control
        </CardTitle>
        <CardDescription>
          eBay polling & Metal prices run independently
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metal Price Update Section */}
        <div className="space-y-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 text-sm text-yellow-800 mb-2">
            {metalPricesUpdated ? <CheckCircle className="h-4 w-4 text-green-600" /> : <DollarSign className="h-4 w-4" />}
            <span className="font-medium">💰 Metal Price Updates</span>
          </div>
          <Button 
            onClick={updateMetalPrices} 
            disabled={isUpdatingMetalPrices}
            variant={metalPricesUpdated ? "secondary" : "default"}
            className="w-full"
            size="sm"
          >
            {isUpdatingMetalPrices ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating Prices...
              </>
            ) : metalPricesUpdated ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Prices Updated ✅
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                Update Metal Prices
              </>
            )}
          </Button>
          <p className="text-xs text-yellow-700">
            {metalPricesUpdated ? 
              '✅ Metal prices updated! Runs daily automatically.' :
              'Updates gold/silver spot prices (separate from eBay polling)'
            }
          </p>
        </div>

        {/* Step 1: CRITICAL - Stop All Cron Jobs */}
        <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 text-sm text-red-800 mb-2">
            {cleanupDone ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="font-medium">🚨 EMERGENCY: Stop All Jobs</span>
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
                STOP ALL CRON JOBS
              </>
            )}
          </Button>
          <p className="text-xs text-red-700 font-medium">
            {cleanupDone ? 
              '✅ Both eBay & metal price jobs stopped! Wait 2-3 min.' : 
              '⚠️ CRITICAL: Stop runaway cron jobs now!'
            }
          </p>
        </div>

        {/* Step 2: Test eBay API */}
        <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800 mb-2">
            {ebayTestDone ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Search className="h-4 w-4" />}
            <span className="font-medium">Test eBay API</span>
          </div>
          <Button 
            onClick={testEbayAPI} 
            disabled={isTestingEbay || !cleanupDone || ebayTestDone}
            variant={ebayTestDone ? "secondary" : "default"}
            className="w-full"
            size="sm"
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
                Test eBay API
              </>
            )}
          </Button>
        </div>

        {/* System Status */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-800 mb-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Dual Scheduler Status</span>
          </div>
          <ul className="text-xs text-gray-700 space-y-1">
            <li>• eBay Polling: {ebayTestDone ? '✅ Ready' : cleanupDone ? '⏳ Testing' : '❌ Blocked'}</li>
            <li>• Metal Prices: {metalPricesUpdated ? '✅ Updated' : '📊 Independent schedule'}</li>
            <li>• Total tasks: {tasks.length} ({activeTasks.length} active)</li>
            <li>• Separation: ✅ Independent queues</li>
          </ul>
        </div>

        {/* Emergency Actions */}
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
                  Run All eBay Tasks
                </>
              )}
            </Button>
          )}

          {/* Fix Scheduling Button */}
          <Button 
            onClick={fixCronScheduling} 
            disabled={isScheduling}
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
                Fix Dual Scheduling
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
