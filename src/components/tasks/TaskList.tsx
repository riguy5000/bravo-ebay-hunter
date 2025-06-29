
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Pause, 
  Square, 
  Edit, 
  Trash2, 
  Eye,
  Clock,
  DollarSign
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { toast } from 'sonner';

interface TaskListProps {
  onEditTask?: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onEditTask }) => {
  const { tasks, loading, updateTask, deleteTask } = useTasks();

  const handleStatusChange = async (taskId: string, newStatus: 'active' | 'paused' | 'stopped') => {
    try {
      await updateTask(taskId, { status: newStatus });
      toast.success(`Task ${newStatus === 'active' ? 'started' : newStatus}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(taskId);
        toast.success('Task deleted successfully');
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete task');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'stopped': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-3 w-3" />;
      case 'paused': return <Pause className="h-3 w-3" />;
      case 'stopped': return <Square className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">No tasks created yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {task.name}
                  <Badge variant="secondary" className={`${getStatusColor(task.status)} flex items-center gap-1`}>
                    {getStatusIcon(task.status)}
                    {task.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {task.item_type.charAt(0).toUpperCase() + task.item_type.slice(1)} search
                  {task.max_price && ` • Max: $${task.max_price.toLocaleString()}`}
                  {task.price_percentage && ` • ${task.price_percentage}% of market`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {task.status === 'active' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(task.id, 'paused')}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(task.id, 'active')}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange(task.id, 'stopped')}
                >
                  <Square className="h-4 w-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditTask?.(task.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Every {task.poll_interval || 300}s</span>
              </div>
              {task.min_seller_feedback && (
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>Min feedback: {task.min_seller_feedback}</span>
                </div>
              )}
              {task.listing_format && task.listing_format.length > 0 && (
                <div className="flex items-center gap-1">
                  <span>Formats: {task.listing_format.join(', ')}</span>
                </div>
              )}
              <div className="text-xs text-gray-500">
                Created: {new Date(task.created_at).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
