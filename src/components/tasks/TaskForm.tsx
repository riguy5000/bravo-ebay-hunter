
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useTasks, type Task } from '@/hooks/useTasks';
import { WatchFilters } from './WatchFilters';
import { JewelryFilters } from './JewelryFilters';
import { GemstoneFliters } from './GemstoneFliters';
import { SubcategorySelector } from './SubcategorySelector';
import { EnhancedWatchFilters } from './EnhancedWatchFilters';
import { EnhancedJewelryFilters } from './EnhancedJewelryFilters';
import { EnhancedGemstoneFilters } from './EnhancedGemstoneFilters';
import type { TaskTemplate } from './TaskTemplates';

interface TaskFormProps {
  template?: TaskTemplate | null;
  editingTask?: Task | null;
  onSuccess: () => void;
  onCancel: () => void;
  onBackToTemplates?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  template,
  editingTask,
  onSuccess,
  onCancel,
  onBackToTemplates
}) => {
  const { createTask, updateTask } = useTasks();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<'watch' | 'jewelry' | 'gemstone'>('jewelry');
  const [maxPrice, setMaxPrice] = useState('1000');
  const [pollInterval, setPollInterval] = useState('300');
  const [minSellerFeedback, setMinSellerFeedback] = useState('0');
  const [excludeKeywords, setExcludeKeywords] = useState('');
  
  // Expanded listing format options
  const [listingFormats, setListingFormats] = useState<string[]>(['Fixed Price (BIN)', 'Auction']);
  
  // Subcategory selection
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  
  // Type-specific filters
  const [watchFilters, setWatchFilters] = useState({});
  const [jewelryFilters, setJewelryFilters] = useState({});
  const [gemstoneFilters, setGemstoneFilters] = useState({});

  // Initialize form with template or editing task data
  useEffect(() => {
    console.log('🔧 TaskForm initialization:', { template, editingTask });
    
    if (template) {
      console.log('📝 Loading template:', template);
      setName(template.name);
      setItemType(template.itemType);
      setMaxPrice(template.maxPrice?.toString() || '1000');
      setWatchFilters(template.watchFilters || {});
      setJewelryFilters(template.jewelryFilters || {});
      setGemstoneFilters(template.gemstoneFilters || {});
      
      if (template.listingFormats) {
        setListingFormats(template.listingFormats);
      }
    } else if (editingTask) {
      console.log('✏️ Loading editing task:', editingTask);
      setName(editingTask.name);
      setItemType(editingTask.item_type);
      setMaxPrice(editingTask.max_price?.toString() || '1000');
      setPollInterval(editingTask.poll_interval?.toString() || '300');
      setMinSellerFeedback(editingTask.min_seller_feedback?.toString() || '0');
      setExcludeKeywords(editingTask.exclude_keywords?.join(', ') || '');
      setListingFormats(editingTask.listing_format || ['Fixed Price (BIN)', 'Auction']);
      
      // Load type-specific filters with proper fallbacks
      setWatchFilters(editingTask.watch_filters || {});
      setJewelryFilters(editingTask.jewelry_filters || {});
      setGemstoneFilters(editingTask.gemstone_filters || {});
      
      console.log('📊 Loaded filters:', {
        watch: editingTask.watch_filters,
        jewelry: editingTask.jewelry_filters,
        gemstone: editingTask.gemstone_filters
      });
    } else {
      // Reset to defaults for new task
      console.log('🆕 New task - using defaults');
      setName('');
      setItemType('jewelry');
      setMaxPrice('1000');
      setPollInterval('300');
      setMinSellerFeedback('0');
      setExcludeKeywords('');
      setListingFormats(['Fixed Price (BIN)', 'Auction']);
      setWatchFilters({});
      setJewelryFilters({});
      setGemstoneFilters({});
    }
  }, [template, editingTask]);

  const listingFormatOptions = [
    { id: 'Fixed Price (BIN)', label: 'Fixed Price (BIN)' },
    { id: 'Best Offer', label: 'Best Offer' },
    { id: 'Auction', label: 'Auction' },
    { id: 'Classified Ad', label: 'Classified Ad' },
    { id: 'Accepts Offers', label: 'Accepts Offers' }
  ];

  const handleListingFormatChange = (formatId: string, checked: boolean) => {
    if (checked) {
      setListingFormats(prev => [...prev, formatId]);
    } else {
      setListingFormats(prev => prev.filter(f => f !== formatId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter a task name');
      return;
    }

    if (listingFormats.length === 0) {
      toast.error('Please select at least one listing format');
      return;
    }

    const intervalNum = parseInt(pollInterval);
    if (intervalNum < 5 || intervalNum > 3600) {
      toast.error('eBay Poll Interval must be between 5 and 3600 seconds');
      return;
    }

    setLoading(true);
    try {
      const taskData = {
        name: name.trim(),
        item_type: itemType,
        status: editingTask?.status || 'active',
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        poll_interval: intervalNum,
        listing_format: listingFormats,
        min_seller_feedback: minSellerFeedback ? parseInt(minSellerFeedback) : 0,
        exclude_keywords: excludeKeywords ? excludeKeywords.split(',').map(k => k.trim()).filter(k => k) : [],
        watch_filters: itemType === 'watch' ? watchFilters : undefined,
        jewelry_filters: itemType === 'jewelry' ? jewelryFilters : undefined,
        gemstone_filters: itemType === 'gemstone' ? gemstoneFilters : undefined,
      };

      console.log('💾 Saving task data:', taskData);

      if (editingTask) {
        await updateTask(editingTask.id, taskData);
        toast.success(`Task "${name}" updated successfully!`);
      } else {
        await createTask(taskData);
        toast.success(`Task "${name}" created successfully!`);
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Error saving task:', error);
      toast.error('Failed to save task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTypeSpecificFilters = () => {
    // Use enhanced filters if subcategories are selected, otherwise use basic filters
    const useEnhancedFilters = selectedSubcategories.length > 0;

    console.log('🎛️ Rendering filters for:', { itemType, useEnhancedFilters, selectedSubcategories });

    switch (itemType) {
      case 'watch':
        return useEnhancedFilters ? (
          <EnhancedWatchFilters
            filters={watchFilters}
            onChange={setWatchFilters}
            selectedSubcategories={selectedSubcategories}
          />
        ) : (
          <WatchFilters
            filters={watchFilters}
            onChange={setWatchFilters}
          />
        );
      case 'jewelry':
        return useEnhancedFilters ? (
          <EnhancedJewelryFilters
            filters={jewelryFilters}
            onChange={setJewelryFilters}
            selectedSubcategories={selectedSubcategories}
          />
        ) : (
          <JewelryFilters
            filters={jewelryFilters}
            onChange={setJewelryFilters}
          />
        );
      case 'gemstone':
        return useEnhancedFilters ? (
          <EnhancedGemstoneFilters
            filters={gemstoneFilters}
            onChange={setGemstoneFilters}
            selectedSubcategories={selectedSubcategories}
          />
        ) : (
          <GemstoneFliters
            filters={gemstoneFilters}
            onChange={setGemstoneFilters}
          />
        );
      default:
        return null;
    }
  };

  const isEditing = !!editingTask;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          {onBackToTemplates && (
            <Button variant="ghost" size="sm" onClick={onBackToTemplates}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <CardTitle>
              {isEditing 
                ? `Edit Task: ${editingTask.name}`
                : template 
                ? `Create ${template.name}` 
                : 'Create Custom Task'
              }
            </CardTitle>
            <CardDescription>
              {isEditing 
                ? 'Update your automated eBay search configuration'
                : 'Configure your automated eBay search with AI analysis'
              }
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Task Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Gold Jewelry Scanner"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemType">Item Type *</Label>
              <Select value={itemType} onValueChange={(value: 'watch' | 'jewelry' | 'gemstone') => setItemType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jewelry">Jewelry</SelectItem>
                  <SelectItem value="watch">Watch</SelectItem>
                  <SelectItem value="gemstone">Gemstone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPrice">Max Price ($)</Label>
              <Input
                id="maxPrice"
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="1000"
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pollInterval">eBay Poll Interval (seconds) *</Label>
              <Input
                id="pollInterval"
                type="number"
                value={pollInterval}
                onChange={(e) => setPollInterval(e.target.value)}
                placeholder="300"
                min="5"
                max="3600"
                required
              />
              <p className="text-xs text-gray-500">
                How often to search eBay (5 seconds to 1 hour). Note: Metal prices update separately on a daily schedule.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minFeedback">Min Seller Feedback</Label>
              <Input
                id="minFeedback"
                type="number"
                value={minSellerFeedback}
                onChange={(e) => setMinSellerFeedback(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excludeKeywords">Exclude Keywords</Label>
              <Input
                id="excludeKeywords"
                value={excludeKeywords}
                onChange={(e) => setExcludeKeywords(e.target.value)}
                placeholder="broken, damaged, repair"
              />
              <p className="text-xs text-gray-500">
                Comma-separated keywords to exclude from results
              </p>
            </div>
          </div>

          {/* Listing Format Options */}
          <div className="space-y-3">
            <Label>Listing Formats *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {listingFormatOptions.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.id}
                    checked={listingFormats.includes(option.id)}
                    onCheckedChange={(checked) => 
                      handleListingFormatChange(option.id, checked as boolean)
                    }
                  />
                  <Label 
                    htmlFor={option.id}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Select the types of listings you want to monitor
            </p>
          </div>

          {/* Subcategory Selection */}
          <SubcategorySelector
            itemType={itemType}
            selectedSubcategories={selectedSubcategories}
            onChange={setSelectedSubcategories}
          />

          {/* Type-specific Filters */}
          {renderTypeSpecificFilters()}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Task' : 'Create Task'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
