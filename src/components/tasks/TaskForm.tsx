
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { EnhancedJewelryFilters } from './EnhancedJewelryFilters';
import { EnhancedWatchFilters } from './EnhancedWatchFilters';
import { EnhancedGemstoneFilters } from './EnhancedGemstoneFilters';
import { SubcategorySelector } from './SubcategorySelector';

interface TaskFormProps {
  template?: any;
  onSuccess: () => void;
  onCancel: () => void;
  onBackToTemplates?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ template, onSuccess, onCancel, onBackToTemplates }) => {
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minFeedback, setMinFeedback] = useState<number | null>(null);
  const [pollInterval, setPollInterval] = useState<number | null>(300);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [listingFormats, setListingFormats] = useState<string[]>([]);
  const [itemLocation, setItemLocation] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [priceDeltaType, setPriceDeltaType] = useState<'fixed' | 'percentage'>('fixed');
  const [priceDeltaValue, setPriceDeltaValue] = useState<number | null>(null);
  const [pricePercentage, setPricePercentage] = useState<number | null>(null);
  const [auctionAlert, setAuctionAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jewelryFilters, setJewelryFilters] = useState({});
  const [watchFilters, setWatchFilters] = useState({});
  const [gemstoneFilters, setGemstoneFilters] = useState({});
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setItemType(template.itemType || null);
    }
  }, [template]);

  const handleKeywordAdd = (keyword: string) => {
    setExcludeKeywords([...excludeKeywords, keyword]);
  };

  const handleKeywordRemove = (index: number) => {
    const newKeywords = [...excludeKeywords];
    newKeywords.splice(index, 1);
    setExcludeKeywords(newKeywords);
  };

  const handleListingFormatToggle = (format: string) => {
    if (listingFormats.includes(format)) {
      setListingFormats(listingFormats.filter(f => f !== format));
    } else {
      setListingFormats([...listingFormats, format]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    try {
      const taskData = {
        name,
        item_type: itemType as 'jewelry' | 'watch' | 'gemstone',
        max_price: maxPrice || null,
        min_seller_feedback: minFeedback || 0,
        poll_interval: pollInterval || 300,
        exclude_keywords: excludeKeywords.filter(k => k.trim()),
        listing_format: listingFormats.length > 0 ? listingFormats : null,
        item_location: itemLocation || null,
        date_from: dateFrom ? dateFrom.toISOString() : null,
        date_to: dateTo ? dateTo.toISOString() : null,
        price_delta_type: priceDeltaType,
        price_delta_value: priceDeltaValue || null,
        price_percentage: pricePercentage || null,
        auction_alert: auctionAlert,
        jewelry_filters: itemType === 'jewelry' ? {
          ...jewelryFilters,
          selected_subcategories: selectedSubcategories
        } : null,
        watch_filters: itemType === 'watch' ? {
          ...watchFilters,
          selected_subcategories: selectedSubcategories
        } : null,
        gemstone_filters: itemType === 'gemstone' ? {
          ...gemstoneFilters,
          selected_subcategories: selectedSubcategories
        } : null,
        user_id: 'temp-user-id', // TODO: Replace with actual user ID from auth context
        status: 'active' as const
      };

      console.log('Creating task with data:', taskData);

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        throw error;
      }

      console.log('Task created successfully:', data);
      toast({
        title: "Success",
        description: "Task created successfully!",
      });
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create task:', error);
      setError(error.message || 'Failed to create task');
      toast({
        title: "Error",
        description: error.message || 'Failed to create task',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Task Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Task Name</Label>
            <Input
              id="name"
              placeholder="e.g., Rolex Submariner Search"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="itemType">Item Type</Label>
            <Select onValueChange={setItemType} defaultValue={itemType || undefined}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jewelry">Jewelry</SelectItem>
                <SelectItem value="watch">Watches</SelectItem>
                <SelectItem value="gemstone">Gemstones</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price and Feedback Criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxPrice">Maximum Price</Label>
              <Input
                id="maxPrice"
                type="number"
                placeholder="e.g., 1500"
                value={maxPrice === null ? '' : maxPrice.toString()}
                onChange={(e) => setMaxPrice(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="minFeedback">Minimum Seller Feedback</Label>
              <Input
                id="minFeedback"
                type="number"
                placeholder="e.g., 500"
                value={minFeedback === null ? '' : minFeedback.toString()}
                onChange={(e) => setMinFeedback(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Polling and Exclusion Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pollInterval">Poll Interval (seconds)</Label>
            <Input
              id="pollInterval"
              type="number"
              placeholder="e.g., 300"
              value={pollInterval === null ? '' : pollInterval.toString()}
              onChange={(e) => setPollInterval(e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Exclude Keywords</Label>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Enter keyword"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const target = e.target as HTMLInputElement;
                    if (target.value.trim()) {
                      handleKeywordAdd(target.value.trim());
                      target.value = '';
                    }
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  const target = e.target as HTMLButtonElement;
                  const input = target.parentElement?.querySelector('input') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleKeywordAdd(input.value.trim());
                    input.value = '';
                  }
                }}
              >
                Add Keyword
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {excludeKeywords.map((keyword, index) => (
                <Button key={index} variant="secondary" size="sm" onClick={() => handleKeywordRemove(index)}>
                  {keyword}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Listing Formats</Label>
            <div className="flex flex-wrap gap-2">
              {['Auction', 'FixedPrice', 'StoreInventory'].map(format => (
                <Button
                  key={format}
                  variant={listingFormats.includes(format) ? 'default' : 'outline'}
                  size="sm"
                  type="button"
                  onClick={() => handleListingFormatToggle(format)}
                >
                  {format}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="itemLocation">Item Location</Label>
            <Input
              id="itemLocation"
              placeholder="e.g., US, CA, UK"
              value={itemLocation || ''}
              onChange={(e) => setItemLocation(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    {dateFrom ? format(dateFrom, "PPP") : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    disabled={(date) =>
                      date > new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    {dateTo ? format(dateTo, "PPP") : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    disabled={(date) =>
                      date > new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priceDeltaType">Price Delta Type</Label>
              <Select onValueChange={(value) => setPriceDeltaType(value as 'fixed' | 'percentage')} defaultValue={priceDeltaType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select delta type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {priceDeltaType === 'fixed' && (
              <div>
                <Label htmlFor="priceDeltaValue">Price Delta Value</Label>
                <Input
                  id="priceDeltaValue"
                  type="number"
                  placeholder="e.g., 10"
                  value={priceDeltaValue === null ? '' : priceDeltaValue.toString()}
                  onChange={(e) => setPriceDeltaValue(e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            )}

            {priceDeltaType === 'percentage' && (
              <div>
                <Label htmlFor="pricePercentage">Price Percentage</Label>
                <Input
                  id="pricePercentage"
                  type="number"
                  placeholder="e.g., 5"
                  value={pricePercentage === null ? '' : pricePercentage.toString()}
                  onChange={(e) => setPricePercentage(e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="auctionAlert"
              type="checkbox"
              checked={auctionAlert}
              onChange={(e) => setAuctionAlert(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="auctionAlert">Auction Alert</Label>
          </div>
        </CardContent>
      </Card>

      {itemType && (
        <SubcategorySelector
          itemType={itemType}
          selectedSubcategories={selectedSubcategories}
          onChange={setSelectedSubcategories}
        />
      )}

      {itemType === 'jewelry' && (
        <EnhancedJewelryFilters
          filters={jewelryFilters}
          onChange={setJewelryFilters}
        />
      )}

      {itemType === 'watch' && (
        <EnhancedWatchFilters
          filters={watchFilters}
          onChange={setWatchFilters}
        />
      )}

      {itemType === 'gemstone' && (
        <EnhancedGemstoneFilters
          filters={gemstoneFilters}
          onChange={setGemstoneFilters}
        />
      )}

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <div className="flex justify-between">
        {onBackToTemplates && (
          <Button type="button" variant="secondary" onClick={onBackToTemplates}>
            Back to Templates
          </Button>
        )}
        <div className="space-x-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </div>
    </form>
  );
};
