
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Tasks = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600">Manage your search tasks</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Tasks Yet</CardTitle>
          <CardDescription>
            Create your first search task to start finding profitable deals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Task
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Tasks;
