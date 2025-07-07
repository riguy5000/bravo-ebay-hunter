
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, X, RefreshCw, Info } from 'lucide-react';
import { useEbayTaxonomy } from '@/hooks/useEbayTaxonomy';

interface MultiSelectAspectFilterProps {
  title: string;
  categoryId?: string;
  fallbackCategoryId?: string;
  aspectName: string;
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export const MultiSelectAspectFilter: React.FC<MultiSelectAspectFilterProps> = ({
  title,
  categoryId,
  fallbackCategoryId,
  aspectName,
  selectedValues,
  onChange,
  placeholder = 'Select options...'
}) => {
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
  const { aspects: mergedAspects, getAspectValues: getMergedValues, loading: mergedLoading } = useEbayTaxonomy('jewelry_merged');
  
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

  console.log('MultiSelectAspectFilter:', {
    title,
    aspectName,
    categoryId,
    fallbackCategoryId,
    primaryValuesCount: primaryValues.length,
    fallbackValuesCount: fallbackValues.length,
    usingFallback,
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
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="text-sm space-y-1">
                    <div className="font-medium">
                      {availableValues.length} options available
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
                
                {availableValues.map((valueObj) => (
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
              </>
            ) : (
              <div className="text-sm text-gray-500 py-4 text-center space-y-2">
                <div>No {aspectName.toLowerCase()} options available.</div>
                <div className="text-xs text-gray-400">
                  Category: {categoryId || 'None'} | Fallback: {fallbackCategoryId || 'None'}
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
