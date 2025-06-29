
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
  title: z.string().min(1, 'Task title is required'),
  item_type: z.enum(['watch', 'jewelry', 'gemstone']),
  status: z.enum(['active', 'paused', 'stopped']).default('active'),
  brand: z.string().optional(),
  model: z.string().optional(),
  reference_number: z.string().optional(),
  price_min: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  price_delta_type: z.enum(['absolute', 'percent']).optional(),
  price_delta_value: z.number().min(0).optional(),
  price_percentage: z.number().min(0).max(100).optional(),
  exclude_keywords: z.array(z.string()).optional(),
  include_formats: z.array(z.string()).optional(),
  listing_format: z.array(z.string()).optional(),
  min_seller_feedback: z.number().min(0).optional(),
  poll_interval: z.number().min(5).default(30),
  auction_alert: z.boolean().default(false),
  active: z.boolean().default(true),
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
      poll_interval: 30,
      include_formats: [],
      exclude_keywords: [],
      min_seller_feedback: 0,
      auction_alert: false,
      active: true,
    },
  });

  const itemType = form.watch('item_type');

  const handleSubmit = async (data: TaskFormData) => {
    setLoading(true);
    try {
      // Ensure required fields are present
      if (!data.title || !data.item_type) {
        throw new Error('Title and item type are required');
      }

      const taskData = {
        title: data.title,
        item_type: data.item_type,
        status: data.status || 'active',
        brand: data.brand,
        model: data.model,
        reference_number: data.reference_number,
        price_min: data.price_min,
        max_price: data.max_price,
        price_delta_type: data.price_delta_type,
        price_delta_value: data.price_delta_value,
        price_percentage: data.price_percentage,
        exclude_keywords: data.exclude_keywords,
        include_formats: data.include_formats,
        listing_format: data.listing_format,
        min_seller_feedback: data.min_seller_feedback,
        poll_interval: data.poll_interval || 30,
        auction_alert: data.auction_alert || false,
        active: data.active !== undefined ? data.active : true,
        watch_filters: itemType === 'watch' ? watchFilters : null,
        jewelry_filters: itemType === 'jewelry' ? jewelryFilters : null,
        gemstone_filters: itemType === 'gemstone' ? gemstoneFilters : null,
      };

      await createTask(taskData);
      toast.success('Task created successfully!');
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      console.error('Task creation error:', error);
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
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
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

            {/* Brand, Model, Reference for enhanced filtering */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Rolex, Cartier" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Submariner, Love Bracelet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 116610LN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Price Criteria */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="price_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Price ($)</FormLabel>
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
              name="include_formats"
              render={() => (
                <FormItem>
                  <FormLabel>Listing Formats</FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {listingFormats.map((format) => (
                      <FormField
                        key={format.id}
                        control={form.control}
                        name="include_formats"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="poll_interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Poll Interval (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="30"
                        min="5"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="auction_alert"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Auction Alerts
                      </FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Get notified before auctions end
                      </div>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

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
