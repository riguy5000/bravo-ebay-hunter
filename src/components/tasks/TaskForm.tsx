
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { WatchFilters } from './WatchFilters';
import { JewelryFilters } from './JewelryFilters';
import { GemstoneFliters } from './GemstoneFliters';
import { useTasks } from '@/hooks/useTasks';
import { toast } from 'sonner';

const taskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  item_type: z.enum(['watch', 'jewelry', 'gemstone']),
  status: z.enum(['active', 'paused', 'stopped']).default('active'),
  max_price: z.number().min(0).optional(),
  price_percentage: z.number().min(0).max(100).optional(),
  listing_format: z.array(z.string()).optional(),
  min_seller_feedback: z.number().min(0).optional(),
  poll_interval: z.number().min(60).default(300),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ onSuccess, onCancel }) => {
  const { createTask } = useTasks();
  const [loading, setLoading] = useState(false);
  const [watchFilters, setWatchFilters] = useState({});
  const [jewelryFilters, setJewelryFilters] = useState({});
  const [gemstoneFilters, setGemstoneFilters] = useState({});

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: 'active',
      poll_interval: 300,
      listing_format: [],
      min_seller_feedback: 0,
    },
  });

  const itemType = form.watch('item_type');

  const handleSubmit = async (data: TaskFormData) => {
    setLoading(true);
    try {
      // Ensure required fields are present
      if (!data.name || !data.item_type) {
        throw new Error('Name and item type are required');
      }

      const taskData = {
        name: data.name,
        item_type: data.item_type,
        status: data.status || 'active',
        max_price: data.max_price,
        price_percentage: data.price_percentage,
        listing_format: data.listing_format,
        min_seller_feedback: data.min_seller_feedback,
        poll_interval: data.poll_interval || 300,
        watch_filters: itemType === 'watch' ? watchFilters : null,
        jewelry_filters: itemType === 'jewelry' ? jewelryFilters : null,
        gemstone_filters: itemType === 'gemstone' ? gemstoneFilters : null,
      };

      await createTask(taskData);
      toast.success('Task created successfully!');
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const listingFormats = [
    { id: 'auction', label: 'Auction' },
    { id: 'buy_it_now', label: 'Buy It Now' },
    { id: 'best_offer', label: 'Best Offer' },
    { id: 'classified', label: 'Classified Ad' },
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Search Task</CardTitle>
        <CardDescription>
          Set up automated searches for profitable deals on eBay
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Vintage Rolex Watches" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="item_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="watch">Watches</SelectItem>
                        <SelectItem value="jewelry">Jewelry</SelectItem>
                        <SelectItem value="gemstone">Gemstones</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Price Criteria */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="max_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Price ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 1000"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price % of Market Value</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 70"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_seller_feedback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Seller Feedback</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 100"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Listing Format */}
            <FormField
              control={form.control}
              name="listing_format"
              render={() => (
                <FormItem>
                  <FormLabel>Listing Formats</FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {listingFormats.map((format) => (
                      <FormField
                        key={format.id}
                        control={form.control}
                        name="listing_format"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(format.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), format.id])
                                    : field.onChange(field.value?.filter((value) => value !== format.id));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {format.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="poll_interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poll Interval (seconds)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="300"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Item-specific filters */}
            {itemType === 'watch' && (
              <WatchFilters 
                filters={watchFilters} 
                onChange={setWatchFilters} 
              />
            )}

            {itemType === 'jewelry' && (
              <JewelryFilters 
                filters={jewelryFilters} 
                onChange={setJewelryFilters} 
              />
            )}

            {itemType === 'gemstone' && (
              <GemstoneFliters 
                filters={gemstoneFilters} 
                onChange={setGemstoneFilters} 
              />
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
