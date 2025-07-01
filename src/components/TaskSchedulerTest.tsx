
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Loader2, Zap, Clock } from 'lucide-react';

export const TaskSchedulerTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);

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

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Manual Task Scheduler
        </CardTitle>
        <CardDescription>
          Test the task scheduler manually (active tasks run automatically)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              Run All Tasks Now
            </>
          )}
        </Button>
        
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800 mb-2">
            <Zap className="h-4 w-4" />
            <span className="font-medium">Automatic Scheduling Enabled</span>
          </div>
          <p className="text-xs text-blue-700">
            Active tasks now run automatically based on their poll intervals. This manual trigger processes all active tasks immediately for testing.
          </p>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-800 mb-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">How It Works</span>
          </div>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Active tasks create individual cron jobs</li>
            <li>• Each runs on its own schedule (poll_interval)</li>
            <li>• AI analysis filters quality matches automatically</li>
            <li>• New matches appear in the Matches tab</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
