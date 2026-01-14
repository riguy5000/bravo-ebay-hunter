
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Plus, X, Cloud, Cpu, MessageSquare } from 'lucide-react';

// Badge to indicate if filter is applied via API or locally
const FilterBadge = ({ type }: { type: 'api' | 'local' }) => (
  <span
    className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
      type === 'api'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
        : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    }`}
    title={type === 'api' ? 'Filtered by eBay API (faster, less API usage)' : 'Filtered locally after fetching (more flexible)'}
  >
    {type === 'api' ? <Cloud className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
    {type === 'api' ? 'API' : 'Local'}
  </span>
);
import { toast } from 'sonner';
import { useTasks, type Task } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
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
  const { settings, updateSetting } = useSettings();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<'watch' | 'jewelry' | 'gemstone'>('jewelry');
  const [maxPrice, setMaxPrice] = useState('1000');
  const [minPrice, setMinPrice] = useState('');
  const [pollInterval, setPollInterval] = useState('300');
  const [minSellerFeedback, setMinSellerFeedback] = useState('0');
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [customExcludeKeyword, setCustomExcludeKeyword] = useState('');

  // Get saved custom exclude keywords from settings
  const savedCustomKeywords: Array<{value: string, label: string}> =
    ((settings as any)?.custom_exclude_keywords || []).map((kw: string) => ({
      value: kw.toLowerCase(),
      label: kw
    }));

  // Suggested exclude keywords for filtering out non-genuine items
  const suggestedExcludeKeywords = [
    { value: 'gold filled', label: 'Gold Filled', description: 'Not solid gold' },
    { value: 'plated', label: 'Plated', description: 'Surface coating only' },
    { value: 'vermeil', label: 'Vermeil', description: 'Gold over silver' },
    { value: 'overlay', label: 'Overlay', description: 'Thin gold layer' },
    { value: 'bonded', label: 'Bonded', description: 'Gold bonded to base metal' },
    { value: 'clad', label: 'Clad', description: 'Gold cladding' },
    { value: 'costume', label: 'Costume', description: 'Fashion jewelry' },
    { value: 'fashion', label: 'Fashion', description: 'Not fine jewelry' },
    { value: 'fake', label: 'Fake', description: 'Imitation' },
    { value: 'faux', label: 'Faux', description: 'Imitation' },
    { value: 'broken', label: 'Broken', description: 'Damaged items' },
    { value: 'repair', label: 'Repair', description: 'Needs repair' },
    { value: 'david yurman', label: 'David Yurman', description: 'Designer premium' },
    { value: 'cartier', label: 'Cartier', description: 'Designer premium' },
    { value: 'toned', label: 'Toned', description: 'Artificially colored' },
  ];
  const [maxDetailFetches, setMaxDetailFetches] = useState('50');
  const [minProfitMargin, setMinProfitMargin] = useState<string>('none');
  const [slackChannel, setSlackChannel] = useState('');

  // Expanded listing format options
  const [listingFormats, setListingFormats] = useState<string[]>(['Fixed Price (BIN)', 'Auction']);
  
  // Subcategory selection
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  
  // Type-specific filters - initialize with empty objects to prevent malformed data
  const [watchFilters, setWatchFilters] = useState<any>({});
  const [jewelryFilters, setJewelryFilters] = useState<any>({});
  const [gemstoneFilters, setGemstoneFilters] = useState<any>({});

  // Initialize form with template or editing task data
  useEffect(() => {
    console.log('🔧 TaskForm initialization:', { template, editingTask });
    
    if (template) {
      console.log('📝 Loading template:', template);
      setName(template.name);
      setItemType(template.itemType);
      setMaxPrice(template.maxPrice?.toString() || '1000');
      
      // Safely initialize filters to prevent malformed data
      setWatchFilters(template.watchFilters && typeof template.watchFilters === 'object' ? template.watchFilters : {});
      setJewelryFilters(template.jewelryFilters && typeof template.jewelryFilters === 'object' ? template.jewelryFilters : {});
      setGemstoneFilters(template.gemstoneFilters && typeof template.gemstoneFilters === 'object' ? template.gemstoneFilters : {});
      
      if (template.listingFormats) {
        setListingFormats(template.listingFormats);
      }
    } else if (editingTask) {
      console.log('✏️ Loading editing task:', editingTask);
      setName(editingTask.name);
      setItemType(editingTask.item_type);
      setMaxPrice(editingTask.max_price?.toString() || '1000');
      setMinPrice(editingTask.min_price?.toString() || '');
      setPollInterval(editingTask.poll_interval?.toString() || '300');
      setMinSellerFeedback(editingTask.min_seller_feedback?.toString() || '0');
      setExcludeKeywords(editingTask.exclude_keywords || []);
      setListingFormats(editingTask.listing_format || ['Fixed Price (BIN)', 'Auction']);
      setMaxDetailFetches(editingTask.max_detail_fetches?.toString() || '50');
      const profitMarginValue = editingTask.min_profit_margin != null ? editingTask.min_profit_margin.toString() : 'none';
      console.log('💰 Setting minProfitMargin:', {
        raw: editingTask.min_profit_margin,
        converted: profitMarginValue,
        type: typeof editingTask.min_profit_margin
      });
      setMinProfitMargin(profitMarginValue);
      setSlackChannel(editingTask.slack_channel || '');
      
      // Safely load type-specific filters with proper fallbacks and validation
      const safeWatchFilters = editingTask.watch_filters && typeof editingTask.watch_filters === 'object' && !Array.isArray(editingTask.watch_filters) ? editingTask.watch_filters : {};
      const safeJewelryFilters = editingTask.jewelry_filters && typeof editingTask.jewelry_filters === 'object' && !Array.isArray(editingTask.jewelry_filters) ? editingTask.jewelry_filters : {};
      const safeGemstoneFilters = editingTask.gemstone_filters && typeof editingTask.gemstone_filters === 'object' && !Array.isArray(editingTask.gemstone_filters) ? editingTask.gemstone_filters : {};
      
      setWatchFilters(safeWatchFilters);
      setJewelryFilters(safeJewelryFilters);
      setGemstoneFilters(safeGemstoneFilters);
      
      // Load subcategories from the relevant filter object
      let taskSubcategories: string[] = [];
      if (editingTask.item_type === 'jewelry' && safeJewelryFilters.subcategories) {
        taskSubcategories = safeJewelryFilters.subcategories;
      } else if (editingTask.item_type === 'watch' && safeWatchFilters.subcategories) {
        taskSubcategories = safeWatchFilters.subcategories;
      } else if (editingTask.item_type === 'gemstone' && safeGemstoneFilters.subcategories) {
        taskSubcategories = safeGemstoneFilters.subcategories;
      }
      setSelectedSubcategories(taskSubcategories);
      
      console.log('📊 Loaded filters:', {
        watch: safeWatchFilters,
        jewelry: safeJewelryFilters,
        gemstone: safeGemstoneFilters,
        subcategories: taskSubcategories
      });
    } else {
      // Reset to defaults for new task
      console.log('🆕 New task - using defaults');
      setName('');
      setItemType('jewelry');
      setMaxPrice('1000');
      setMinPrice('');
      setPollInterval('300');
      setMinSellerFeedback('0');
      setExcludeKeywords([]);
      setListingFormats(['Fixed Price (BIN)', 'Auction']);
      setWatchFilters({});
      setJewelryFilters({});
      setGemstoneFilters({});
      setSlackChannel('');
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
    if (intervalNum < 1 || intervalNum > 3600) {
      toast.error('eBay Poll Interval must be between 1 and 3600 seconds');
      return;
    }

    setLoading(true);
    try {
      // Clean and validate filter data before saving
      const cleanWatchFilters = watchFilters && typeof watchFilters === 'object' && !Array.isArray(watchFilters) ? watchFilters : {};
      const cleanJewelryFilters = jewelryFilters && typeof jewelryFilters === 'object' && !Array.isArray(jewelryFilters) ? jewelryFilters : {};
      const cleanGemstoneFilters = gemstoneFilters && typeof gemstoneFilters === 'object' && !Array.isArray(gemstoneFilters) ? gemstoneFilters : {};

      // Add subcategories to the relevant filter object
      if (selectedSubcategories.length > 0) {
        if (itemType === 'jewelry') {
          cleanJewelryFilters.subcategories = selectedSubcategories;
        } else if (itemType === 'watch') {
          cleanWatchFilters.subcategories = selectedSubcategories;
        } else if (itemType === 'gemstone') {
          cleanGemstoneFilters.subcategories = selectedSubcategories;
        }
      }

      const taskData = {
        name: name.trim(),
        item_type: itemType,
        status: editingTask?.status || 'active',
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        poll_interval: intervalNum,
        listing_format: listingFormats,
        min_seller_feedback: minSellerFeedback ? parseInt(minSellerFeedback) : 0,
        exclude_keywords: excludeKeywords,
        max_detail_fetches: maxDetailFetches ? parseInt(maxDetailFetches) : 50,
        min_profit_margin: minProfitMargin !== 'none' ? parseInt(minProfitMargin) : null,
        watch_filters: itemType === 'watch' ? cleanWatchFilters : undefined,
        jewelry_filters: itemType === 'jewelry' ? cleanJewelryFilters : undefined,
        gemstone_filters: itemType === 'gemstone' ? cleanGemstoneFilters : undefined,
        slack_channel: slackChannel.trim() || null,
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
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Cloud className="w-3 h-3 text-blue-600" />
                <span className="text-blue-600 font-medium">API</span> = Filtered by eBay (faster)
              </span>
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-orange-600" />
                <span className="text-orange-600 font-medium">Local</span> = Filtered after fetching
              </span>
            </div>
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
              <Label htmlFor="itemType">Item Type * <FilterBadge type="api" /></Label>
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
              <Label htmlFor="maxPrice">Max Price ($) <FilterBadge type="api" /></Label>
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
              <Label htmlFor="minPrice">Min Price ($) <FilterBadge type="api" /></Label>
              <Input
                id="minPrice"
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pollInterval">eBay Poll Interval (seconds) *</Label>
              <Input
                id="pollInterval"
                type="number"
                value={pollInterval}
                onChange={(e) => setPollInterval(e.target.value)}
                placeholder="60"
                min="1"
                max="3600"
                required
              />
              <p className="text-xs text-gray-500">
                How often to search eBay (1 second to 1 hour). Warning: 1s polling uses API quota quickly!
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxDetailFetches">Max Items Per Poll</Label>
              <Input
                id="maxDetailFetches"
                type="number"
                value={maxDetailFetches}
                onChange={(e) => setMaxDetailFetches(e.target.value)}
                placeholder="50"
                min="1"
                max="500"
              />
              <p className="text-xs text-gray-500">
                Maximum item details to fetch per poll cycle. Lower = fewer API calls. Set to 0 for unlimited.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minProfitMargin">Minimum Profit Margin <FilterBadge type="local" /></Label>
              <Select
                value={minProfitMargin}
                onValueChange={setMinProfitMargin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No minimum..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No minimum</SelectItem>
                  <SelectItem value="-50">-50%</SelectItem>
                  <SelectItem value="-45">-45%</SelectItem>
                  <SelectItem value="-40">-40%</SelectItem>
                  <SelectItem value="-35">-35%</SelectItem>
                  <SelectItem value="-30">-30%</SelectItem>
                  <SelectItem value="-25">-25%</SelectItem>
                  <SelectItem value="-20">-20%</SelectItem>
                  <SelectItem value="-15">-15%</SelectItem>
                  <SelectItem value="-10">-10%</SelectItem>
                  <SelectItem value="-5">-5%</SelectItem>
                  <SelectItem value="0">0% (break even)</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="15">15%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="30">30%</SelectItem>
                  <SelectItem value="35">35%</SelectItem>
                  <SelectItem value="40">40%</SelectItem>
                  <SelectItem value="45">45%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Filter out items below this profit margin (based on melt value for jewelry)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minFeedback">Min Seller Feedback <FilterBadge type="local" /></Label>
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
              <Label htmlFor="slackChannel" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Slack Channel
              </Label>
              <Input
                id="slackChannel"
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
                placeholder="#channel-name"
              />
              <p className="text-xs text-gray-500">
                Optional. Send notifications to a specific channel (e.g., #gold-jewelry)
              </p>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Exclude Keywords <FilterBadge type="api" /> <FilterBadge type="local" /></Label>
              <p className="text-xs text-gray-500 mb-2">
                Excluded in search query (API) and double-checked locally
              </p>

              {/* Default suggested keywords */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {suggestedExcludeKeywords.map((keyword) => (
                  <div key={keyword.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`exclude-${keyword.value}`}
                      checked={excludeKeywords.includes(keyword.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setExcludeKeywords([...excludeKeywords, keyword.value]);
                        } else {
                          setExcludeKeywords(excludeKeywords.filter(k => k !== keyword.value));
                        }
                      }}
                    />
                    <label
                      htmlFor={`exclude-${keyword.value}`}
                      className="text-sm cursor-pointer"
                      title={keyword.description}
                    >
                      {keyword.label}
                    </label>
                  </div>
                ))}
              </div>

              {/* Saved custom keywords (from settings) */}
              {savedCustomKeywords.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">Your saved keywords:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {savedCustomKeywords
                      .filter(kw => !suggestedExcludeKeywords.some(s => s.value === kw.value))
                      .map((keyword) => (
                        <div key={keyword.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exclude-saved-${keyword.value}`}
                            checked={excludeKeywords.includes(keyword.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setExcludeKeywords([...excludeKeywords, keyword.value]);
                              } else {
                                setExcludeKeywords(excludeKeywords.filter(k => k !== keyword.value));
                              }
                            }}
                          />
                          <label
                            htmlFor={`exclude-saved-${keyword.value}`}
                            className="text-sm cursor-pointer flex items-center gap-1"
                          >
                            {keyword.label}
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                const currentSaved = (settings as any)?.custom_exclude_keywords || [];
                                const updated = currentSaved.filter((k: string) => k.toLowerCase() !== keyword.value);
                                await updateSetting('custom_exclude_keywords' as any, updated);
                                toast.success(`Removed "${keyword.label}" from saved keywords`);
                              }}
                              className="text-gray-400 hover:text-red-500"
                              title="Remove from saved list"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </label>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Custom keyword input */}
              <div className="flex gap-2 mt-3">
                <Input
                  value={customExcludeKeyword}
                  onChange={(e) => setCustomExcludeKeyword(e.target.value)}
                  placeholder="Add custom keyword..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customExcludeKeyword.trim()) {
                      e.preventDefault();
                      const keyword = customExcludeKeyword.trim().toLowerCase();
                      if (!excludeKeywords.includes(keyword)) {
                        setExcludeKeywords([...excludeKeywords, keyword]);
                      }
                      setCustomExcludeKeyword('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (customExcludeKeyword.trim()) {
                      const keyword = customExcludeKeyword.trim().toLowerCase();
                      if (!excludeKeywords.includes(keyword)) {
                        setExcludeKeywords([...excludeKeywords, keyword]);
                      }
                      setCustomExcludeKeyword('');
                    }
                  }}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (customExcludeKeyword.trim()) {
                      const keyword = customExcludeKeyword.trim();
                      const keywordLower = keyword.toLowerCase();

                      // Add to current task
                      if (!excludeKeywords.includes(keywordLower)) {
                        setExcludeKeywords([...excludeKeywords, keywordLower]);
                      }

                      // Save to settings for future use
                      const currentSaved = (settings as any)?.custom_exclude_keywords || [];
                      if (!currentSaved.some((k: string) => k.toLowerCase() === keywordLower)) {
                        await updateSetting('custom_exclude_keywords' as any, [...currentSaved, keyword]);
                        toast.success(`"${keyword}" saved to your keyword list`);
                      }

                      setCustomExcludeKeyword('');
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add & Save
                </Button>
              </div>

              {/* Show selected custom keywords (not in suggested or saved list) */}
              {excludeKeywords.filter(k =>
                !suggestedExcludeKeywords.some(s => s.value === k) &&
                !savedCustomKeywords.some(s => s.value === k)
              ).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {excludeKeywords
                    .filter(k =>
                      !suggestedExcludeKeywords.some(s => s.value === k) &&
                      !savedCustomKeywords.some(s => s.value === k)
                    )
                    .map(keyword => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={async () => {
                            // Save to settings
                            const currentSaved = (settings as any)?.custom_exclude_keywords || [];
                            if (!currentSaved.some((k: string) => k.toLowerCase() === keyword)) {
                              await updateSetting('custom_exclude_keywords' as any, [...currentSaved, keyword]);
                              toast.success(`"${keyword}" saved to your keyword list`);
                            }
                          }}
                          className="text-blue-500 hover:text-blue-700"
                          title="Save to your keyword list"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcludeKeywords(excludeKeywords.filter(k => k !== keyword))}
                          className="text-gray-500 hover:text-red-500"
                          title="Remove from this task"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Listing Format Options */}
          <div className="space-y-3">
            <Label>Listing Formats * <FilterBadge type="api" /></Label>
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
