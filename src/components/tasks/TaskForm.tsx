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
import { CalendarIcon, Brain, Zap } from "lucide-react"
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
  const [currentUser, setCurrentUser] = useState<any>(null);

  const { toast } = useToast();

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      setCurrentUser(user);
      
      if (!user) {
        setError('You must be logged in to create tasks');
      }
    };
    getCurrentUser();
  }, []);

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

    if (!currentUser) {
      setError('You must be logged in to create tasks');
      toast({
        title: "Error",
        description: "You must be logged in to create tasks",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    
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
        user_id: currentUser.id,
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
        description: "Task created successfully! The AI-powered task scheduler will start analyzing eBay listings and finding quality matches.",
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
      {/* AI Integration Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <Zap className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">AI-Powered Analysis Included</p>
              <p className="text-xs text-blue-600">
                Your task will automatically use AI to extract metal weights, assess quality, calculate profits, and filter out low-quality listings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basic Task Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Task Name</Label>
            <Input
              id="name"
              placeholder="e.g., Gold Ring Search"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="itemType">Item Type</Label>
            <Select onValueChange={setItemType} value={itemType || undefined}>
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
              <Label htmlFor="maxPrice">Maximum Price ($)</Label>
              <Input
                id="maxPrice"
                type="number"
                placeholder="e.g., 500"
                value={maxPrice === null ? '' : maxPrice.toString()}
                onChange={(e) => setMaxPrice(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="minFeedback">Minimum Seller Feedback</Label>
              <Input
                id="minFeedback"
                type="number"
                placeholder="e.g., 100"
                value={minFeedback === null ? '' : minFeedback.toString()}
                onChange={(e) => setMinFeedback(e.target.value === '' ? null : Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Smart Filtering & Search Settings</CardTitle>
          <p className="text-sm text-gray-600">AI will understand context and exclude items intelligently</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pollInterval">Search Interval (seconds)</Label>
            <Input
              id="pollInterval"
              type="number"
              placeholder="e.g., 300"
              value={pollInterval === null ? '' : pollInterval.toString()}
              onChange={(e) => setPollInterval(e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Exclude Keywords (AI-powered context understanding)</Label>
            <p className="text-xs text-gray-500 mb-2">
              AI will understand context - e.g., "plated" will exclude gold-plated but not solid gold items
            </p>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Enter keyword to exclude"
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
                  const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleKeywordAdd(input.value.trim());
                    input.value = '';
                  }
                }}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {excludeKeywords.map((keyword, index) => (
                <Button key={index} variant="secondary" size="sm" onClick={() => handleKeywordRemove(index)}>
                  {keyword} ×
                </Button>
              ))}
            </div>
          </div>

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
          selectedSubcategories={selectedSubcategories}
        />
      )}

      {itemType === 'watch' && (
        <EnhancedWatchFilters
          filters={watchFilters}
          onChange={setWatchFilters}
          selectedSubcategories={selectedSubcategories}
        />
      )}

      {itemType === 'gemstone' && (
        <EnhancedGemstoneFilters
          filters={gemstoneFilters}
          onChange={setGemstoneFilters}
          selectedSubcategories={selectedSubcategories}
        />
      )}

      {!currentUser && (
        <div className="text-orange-600 text-sm p-4 bg-orange-50 rounded">
          ⚠️ You must be logged in to create tasks. Please sign in first.
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm p-4 bg-red-50 rounded">{error}</div>
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
          <Button type="submit" disabled={loading || !currentUser}>
            {loading ? 'Creating...' : 'Create AI-Powered Task'}
          </Button>
        </div>
      </div>
    </form>
  );
};
