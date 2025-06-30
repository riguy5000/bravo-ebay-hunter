import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { EnhancedWatchFilters } from './EnhancedWatchFilters';
import { EnhancedJewelryFilters } from './EnhancedJewelryFilters';
import { EnhancedGemstoneFilters } from './EnhancedGemstoneFilters';
import { useTasks } from '@/hooks/useTasks';
import { toast } from 'sonner';
import { TaskTemplate } from './TaskTemplates';
import { ArrowLeft, Calendar, MapPin, AlertTriangle } from 'lucide-react';

const taskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  item_type: z.enum(['watch', 'jewelry', 'gemstone']),
  status: z.enum(['active', 'paused', 'stopped']).default('active'),
  max_price: z.number().min(0).optional(),
  price_percentage: z.number().min(0).max(100).optional(),
  price_delta_type: z.enum(['absolute', 'percent']).default('absolute'),
  price_delta_value: z.number().min(0).optional(),
  listing_format: z.array(z.string()).optional(),
  min_seller_feedback: z.number().min(0).optional(),
  poll_interval: z.number().min(5).default(30),
  exclude_keywords: z.array(z.string()).optional(),
  auction_alert: z.boolean().default(false),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  item_location: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  template?: TaskTemplate | null;
  onBackToTemplates?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  onSuccess, 
  onCancel, 
  template,
  onBackToTemplates 
}) => {
  const { createTask } = useTasks();
  const [loading, setLoading] = useState(false);
  const [watchFilters, setWatchFilters] = useState(template?.config?.watch_filters || {});
  const [jewelryFilters, setJewelryFilters] = useState(template?.config?.jewelry_filters || {});
  const [gemstoneFilters, setGemstoneFilters] = useState(template?.config?.gemstone_filters || {});
  const [excludeKeywordsText, setExcludeKeywordsText] = useState(
    template?.config?.exclude_keywords?.join(', ') || ''
  );

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: template?.config || {
      status: 'active',
      poll_interval: 30,
      listing_format: [],
      min_seller_feedback: 0,
      price_delta_type: 'absolute',
      auction_alert: false,
    },
  });

  const itemType = form.watch('item_type');
  const priceRule = form.watch('price_delta_type');

  const handleSubmit = async (data: TaskFormData) => {
    setLoading(true);
    try {
      console.log('Creating task with data:', data);
      console.log('Watch filters:', watchFilters);
      console.log('Jewelry filters:', jewelryFilters);
      console.log('Gemstone filters:', gemstoneFilters);

      const excludeKeywords = excludeKeywordsText
        ? excludeKeywordsText.split(',').map(k => k.trim()).filter(k => k.length > 0)
        : [];

      const taskData = {
        name: data.name,
        item_type: data.item_type,
        status: data.status || 'active',
        max_price: data.max_price,
        price_percentage: data.price_percentage,
        price_delta_type: data.price_delta_type,
        price_delta_value: data.price_delta_value,
        listing_format: data.listing_format,
        min_seller_feedback: data.min_seller_feedback,
        poll_interval: data.poll_interval || 30,
        exclude_keywords: excludeKeywords,
        auction_alert: data.auction_alert,
        date_from: data.date_from,
        date_to: data.date_to,
        item_location: data.item_location,
        watch_filters: itemType === 'watch' ? watchFilters : null,
        jewelry_filters: itemType === 'jewelry' ? jewelryFilters : null,
        gemstone_filters: itemType === 'gemstone' ? gemstoneFilters : null,
      };

      console.log('Final task data being submitted:', taskData);

      await createTask(taskData);
      toast.success('Task created successfully with enhanced multi-select filters!');
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
        <div className="flex items-center gap-4">
          {onBackToTemplates && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onBackToTemplates}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Templates
            </Button>
          )}
          <div>
            <CardTitle>
              {template ? `Create ${template.name}` : 'Create New Search Task'}
            </CardTitle>
            <CardDescription>
              {template 
                ? `Using the ${template.name} template with enhanced multi-select filters`
                : 'Set up automated searches with comprehensive aspect filtering'
              }
            </CardDescription>
          </div>
        </div>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Price Rules</CardTitle>
                <CardDescription>
                  Set price limits and comparison rules
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price_delta_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Rule Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="absolute">Absolute Price ($)</SelectItem>
                            <SelectItem value="percent">Percentage Below Reference</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price_delta_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {priceRule === 'percent' ? 'Percentage Below (%)' : 'Maximum Price ($)'}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder={priceRule === 'percent' ? 'e.g., 15' : 'e.g., 1000'}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="max_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hard Maximum Price ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 5000"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription>
                          Never exceed this price regardless of other rules
                        </FormDescription>
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
              </CardContent>
            </Card>

            {/* Advanced Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Advanced Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                {/* Exclude Keywords */}
                <FormItem>
                  <FormLabel>Exclude Keywords</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="plated, filled, hollow, cartier, tiffany"
                      value={excludeKeywordsText}
                      onChange={(e) => setExcludeKeywordsText(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated keywords to exclude from search results
                  </FormDescription>
                </FormItem>

                {/* Date Range and Location */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="date_from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Date From
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Date To
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="item_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Item Location
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="US, UK, Worldwide" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Auction Alert and Poll Interval */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="auction_alert"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Auction Alerts
                          </FormLabel>
                          <FormDescription>
                            Get notified 2 minutes before auction ends
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
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
                            placeholder="30"
                            min="5"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum 5 seconds. Lower = more API calls.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Item-specific filters with multi-select */}
            {itemType === 'watch' && (
              <EnhancedWatchFilters 
                filters={watchFilters} 
                onChange={setWatchFilters} 
              />
            )}

            {itemType === 'jewelry' && (
              <EnhancedJewelryFilters 
                filters={jewelryFilters} 
                onChange={setJewelryFilters} 
              />
            )}

            {itemType === 'gemstone' && (
              <EnhancedGemstoneFilters 
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
