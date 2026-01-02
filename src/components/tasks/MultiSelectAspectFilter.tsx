
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, X, RefreshCw, Info, Search } from 'lucide-react';
import { useEbayTaxonomy } from '@/hooks/useEbayTaxonomy';

// Popular brands to show by default (before user searches)
const POPULAR_JEWELRY_BRANDS = [
  'Tiffany & Co.', 'Cartier', 'David Yurman', 'Pandora', 'Van Cleef & Arpels',
  'Bulgari', 'Harry Winston', 'Chopard', 'Graff', 'Mikimoto',
  'John Hardy', 'Lagos', 'Roberto Coin', 'Marco Bicego', 'Ippolita',
  'Hearts on Fire', 'Tacori', 'Verragio', 'Simon G.', 'A. Jaffe'
];

const POPULAR_WATCH_BRANDS = [
  'Rolex', 'Omega', 'Patek Philippe', 'Audemars Piguet', 'Cartier',
  'TAG Heuer', 'Breitling', 'IWC', 'Panerai', 'Tudor',
  'Jaeger-LeCoultre', 'Vacheron Constantin', 'A. Lange & Söhne', 'Blancpain', 'Hublot',
  'Zenith', 'Grand Seiko', 'Seiko', 'Citizen', 'Longines'
];

const MAX_DISPLAY_RESULTS = 100;

interface MultiSelectAspectFilterProps {
  title: string;
  categoryId?: string;
  fallbackCategoryId?: string;
  mergedCategoryId?: string;
  aspectName: string;
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export const MultiSelectAspectFilter: React.FC<MultiSelectAspectFilterProps> = ({
  title,
  categoryId,
  fallbackCategoryId,
  mergedCategoryId = 'jewelry_merged',
  aspectName,
  selectedValues: rawSelectedValues,
  onChange,
  placeholder = 'Select options...'
}) => {
  // Ensure selectedValues is always an array to prevent .map() errors
  const selectedValues = Array.isArray(rawSelectedValues) ? rawSelectedValues : [];
  const [searchTerm, setSearchTerm] = useState('');
  // Validate category IDs - only use real eBay categories or merged data
  const isValidEbayCategoryId = (id?: string) => {
    if (!id) return false;
    // Check if it's a merged category or a valid numeric eBay category
    return id.endsWith('_merged') || /^\d+$/.test(id);
  };

  const validCategoryId = isValidEbayCategoryId(categoryId) ? categoryId : undefined;
  const validFallbackId = isValidEbayCategoryId(fallbackCategoryId) ? fallbackCategoryId : undefined;

  const { aspects: primaryAspects, getAspectValues: getPrimaryValues, loading: primaryLoading, error: primaryError, refreshTaxonomyData } = useEbayTaxonomy(validCategoryId);
  const { aspects: fallbackAspects, getAspectValues: getFallbackValues, loading: fallbackLoading } = useEbayTaxonomy(validFallbackId);
  const { aspects: mergedAspects, getAspectValues: getMergedValues, loading: mergedLoading } = useEbayTaxonomy(mergedCategoryId);
  
  // Try primary category first, then fallback, then merged comprehensive data
  const primaryValues = getPrimaryValues(aspectName);
  const fallbackValues = getFallbackValues(aspectName);
  const mergedValues = getMergedValues(aspectName);
  
  // Use primary values if available, otherwise fallback, otherwise merged comprehensive data
  let availableValues = primaryValues;
  let dataSource = 'primary';
  
  if (availableValues.length === 0 && fallbackValues.length > 0) {
    availableValues = fallbackValues;
    dataSource = 'fallback';
  }
  
  if (availableValues.length === 0 && mergedValues.length > 0) {
    availableValues = mergedValues;
    dataSource = 'merged';
  }
  
  const loading = primaryLoading || fallbackLoading || mergedLoading;
  const usingFallback = dataSource === 'fallback';
  const usingMerged = dataSource === 'merged';

  // Determine which popular brands list to use based on aspect name
  const popularBrands = useMemo(() => {
    if (aspectName.toLowerCase().includes('brand')) {
      // Try to detect if this is for watches based on category
      const isWatch = categoryId?.includes('watch') || title.toLowerCase().includes('watch');
      return isWatch ? POPULAR_WATCH_BRANDS : POPULAR_JEWELRY_BRANDS;
    }
    return [];
  }, [aspectName, categoryId, title]);

  // Filter and limit displayed values
  const displayedValues = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();

    // If searching, filter all available values by search term
    if (searchLower) {
      const filtered = availableValues.filter(v =>
        v.value.toLowerCase().includes(searchLower) ||
        (v.meaning && v.meaning.toLowerCase().includes(searchLower))
      );
      return filtered.slice(0, MAX_DISPLAY_RESULTS);
    }

    // No search term - show popular brands first (if applicable), then others
    if (popularBrands.length > 0 && aspectName.toLowerCase().includes('brand')) {
      // Find popular brands that exist in available values
      const popularMatches = popularBrands
        .map(brand => availableValues.find(v =>
          v.value.toLowerCase() === brand.toLowerCase() ||
          (v.meaning && v.meaning.toLowerCase() === brand.toLowerCase())
        ))
        .filter(Boolean) as typeof availableValues;

      // Get selected values that aren't in popular (to keep them visible)
      const selectedNotInPopular = selectedValues
        .filter(sv => !popularBrands.some(pb => pb.toLowerCase() === sv.toLowerCase()))
        .map(sv => availableValues.find(v => v.value === sv))
        .filter(Boolean) as typeof availableValues;

      // Combine: selected first, then popular
      const combined = [...selectedNotInPopular, ...popularMatches];
      // Remove duplicates
      const seen = new Set<string>();
      return combined.filter(v => {
        if (seen.has(v.value)) return false;
        seen.add(v.value);
        return true;
      }).slice(0, MAX_DISPLAY_RESULTS);
    }

    // Default: just limit to max display
    return availableValues.slice(0, MAX_DISPLAY_RESULTS);
  }, [availableValues, searchTerm, popularBrands, aspectName, selectedValues]);

  console.log('MultiSelectAspectFilter:', {
    title,
    aspectName,
    categoryId,
    mergedCategoryId,
    primaryValuesCount: primaryValues.length,
    fallbackValuesCount: fallbackValues.length,
    mergedValuesCount: mergedValues.length,
    dataSource,
    loading
  });

  const handleValueToggle = (value: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedValues, value]);
    } else {
      onChange(selectedValues.filter(v => v !== value));
    }
  };

  const handleRemoveValue = (valueToRemove: string) => {
    onChange(selectedValues.filter(v => v !== valueToRemove));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleRefreshTaxonomy = () => {
    if (refreshTaxonomyData) {
      refreshTaxonomyData();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>{title}</Label>
        {usingMerged ? (
          <div className="flex items-center gap-1 text-xs text-purple-600">
            <Info className="h-3 w-3" />
            <span>Using comprehensive merged data</span>
          </div>
        ) : usingFallback && (
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <Info className="h-3 w-3" />
            <span>Using fallback data</span>
          </div>
        )}
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-left font-normal"
          >
            <span className="truncate">
              {selectedValues.length > 0 
                ? `${selectedValues.length} selected`
                : placeholder
              }
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-80 max-h-80 overflow-y-auto bg-white z-50">
          <div className="p-2 space-y-2">
            {loading ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                Loading {aspectName.toLowerCase()} options...
              </div>
            ) : primaryError && !usingFallback ? (
              <div className="text-sm text-red-500 py-2 text-center space-y-2">
                <div>Error: {primaryError}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshTaxonomy}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : availableValues.length > 0 ? (
              <>
                {/* Search input */}
                <div className="relative pb-2 border-b">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search brands..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="text-sm space-y-1">
                    <div className="font-medium">
                      {searchTerm
                        ? `${displayedValues.length} of ${availableValues.length} shown`
                        : `${displayedValues.length} popular brands`
                      }
                    </div>
                     {usingMerged ? (
                       <div className="text-xs text-purple-600">
                         Using comprehensive merged data from all jewelry categories
                       </div>
                     ) : usingFallback ? (
                       <div className="text-xs text-blue-600">
                         Using category {fallbackCategoryId} data
                       </div>
                     ) : (
                       <div className="text-xs text-green-600">
                         Live taxonomy data for {categoryId}
                       </div>
                     )}
                  </div>
                  {selectedValues.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="h-6 px-2 text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                
                {displayedValues.map((valueObj) => (
                  <div key={valueObj.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${aspectName}-${valueObj.value}`}
                      checked={selectedValues.includes(valueObj.value)}
                      onCheckedChange={(checked) =>
                        handleValueToggle(valueObj.value, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`${aspectName}-${valueObj.value}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {valueObj.meaning || valueObj.value}
                    </Label>
                  </div>
                ))}

                {/* Show hint when there are more results */}
                {!searchTerm && availableValues.length > displayedValues.length && (
                  <div className="text-xs text-gray-500 pt-2 border-t text-center">
                    Type to search {availableValues.length.toLocaleString()} brands
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500 py-4 text-center space-y-2">
                <div>No {aspectName.toLowerCase()} options available.</div>
                <div className="text-xs text-gray-400">
                  Category: {categoryId || 'None'} | Merged: {mergedCategoryId}
                </div>
                <div className="text-xs text-gray-400">
                  Primary: {primaryValues.length} | Merged: {mergedValues.length} | Loading: {loading ? 'yes' : 'no'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshTaxonomy}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Fetch Taxonomy Data
                </Button>
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected values display */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedValues.map((value) => {
            const valueObj = availableValues.find(v => v.value === value);
            return (
              <div
                key={value}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
              >
                <span>{valueObj?.meaning || value}</span>
                <button
                  onClick={() => handleRemoveValue(value)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
