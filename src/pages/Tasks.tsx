
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TaskForm } from '@/components/tasks/TaskForm';
import { TaskTemplates, TaskTemplate } from '@/components/tasks/TaskTemplates';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskSchedulerTest } from '@/components/TaskSchedulerTest';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Tasks = () => {
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const handleCreateSuccess = () => {
    setShowCreateFlow(false);
    setSelectedTemplate(null);
    setShowCustomForm(false);
  };

  const handleSelectTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setShowCustomForm(true);
  };

  const handleCustomTask = () => {
    setSelectedTemplate(null);
    setShowCustomForm(true);
  };

  const handleBackToTemplates = () => {
    setSelectedTemplate(null);
    setShowCustomForm(false);
  };

  const handleEditTask = (taskId: string) => {
    setEditingTaskId(taskId);
    // In a real implementation, you'd load the task data for editing
  };

  const renderCreateFlow = () => {
    if (showCustomForm) {
      return (
        <TaskForm 
          template={selectedTemplate}
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateFlow(false)}
          onBackToTemplates={selectedTemplate ? handleBackToTemplates : undefined}
        />
      );
    }

    return (
      <TaskTemplates
        onSelectTemplate={handleSelectTemplate}
        onCustomTask={handleCustomTask}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Search Tasks</h1>
          <p className="text-gray-600">Create and manage your automated eBay searches</p>
        </div>
        <Button onClick={() => setShowCreateFlow(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TaskList onEditTask={handleEditTask} />
        </div>
        <div>
          <TaskSchedulerTest />
        </div>
      </div>

      <Dialog open={showCreateFlow} onOpenChange={setShowCreateFlow}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showCustomForm 
                ? (selectedTemplate ? `Create ${selectedTemplate.name}` : 'Create Custom Task')
                : 'Create New Search Task'
              }
            </DialogTitle>
          </DialogHeader>
          {renderCreateFlow()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
