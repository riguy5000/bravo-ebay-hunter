
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const TestDataPopulator: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const { toast } = useToast();

  const populateTestData = async () => {
    setLoading(true);
    try {
      console.log('Calling eBay aspects cache function...');
      const { data, error } = await supabase.functions.invoke('ebay-aspects-cache');
      
      if (error) {
        console.error('Error calling aspects cache:', error);
        throw error;
      }

      console.log('Aspects cache result:', data);
      toast({
        title: "Success",
        description: "Test aspect data populated successfully! Enhanced filters should now work.",
      });
    } catch (error: any) {
      console.error('Failed to populate test data:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to populate test data',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runTaskScheduler = async () => {
    setSchedulerLoading(true);
    try {
      console.log('Running task scheduler...');
      const { data, error } = await supabase.functions.invoke('task-scheduler');
      
      if (error) {
        console.error('Error running task scheduler:', error);
        throw error;
      }

      console.log('Task scheduler result:', data);
      toast({
        title: "Success",
        description: `Task scheduler completed! Processed ${data.tasksProcessed || 0} tasks.`,
      });
    } catch (error: any) {
      console.error('Failed to run task scheduler:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to run task scheduler',
        variant: "destructive",
      });
    } finally {
      setSchedulerLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Data & Scheduler</CardTitle>
        <p className="text-sm text-gray-600">
          Use these tools to populate test data and run the task scheduler manually.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-2">
          <Button 
            onClick={populateTestData} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Populating...' : 'Populate Test Aspect Data'}
          </Button>
          <p className="text-xs text-gray-500">
            This will create comprehensive jewelry, watch, and gemstone aspect data for testing.
          </p>
        </div>

        <div className="flex flex-col space-y-2">
          <Button 
            onClick={runTaskScheduler} 
            disabled={schedulerLoading}
          >
            {schedulerLoading ? 'Running...' : 'Run Task Scheduler'}
          </Button>
          <p className="text-xs text-gray-500">
            This will manually run the task scheduler to search for matches on active tasks.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
