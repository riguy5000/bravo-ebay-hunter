
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

// Standard eBay conditions (these are NOT aspects - they're a separate eBay concept)
const EBAY_CONDITIONS = [
  { value: 'New', label: 'New', description: 'Brand new, unused item' },
  { value: 'Pre-owned', label: 'Pre-owned', description: 'Previously owned/used item' },
  { value: 'For parts or not working', label: 'For Parts / Not Working', description: 'Item for parts or repair' },
];

interface EnhancedJewelryFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
  selectedSubcategories?: string[];
}

export const EnhancedJewelryFilters: React.FC<EnhancedJewelryFiltersProps> = ({ 
  filters, 
  onChange,
  selectedSubcategories = []
}) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  // Update the enhanced jewelry filters to use merged data
  const getCategoryForAspects = () => {
    // If we have selected subcategories, try the first one
    if (selectedSubcategories.length > 0) {
      return selectedSubcategories[0];
    }
    
    // Fall back to category 50647 which has comprehensive jewelry aspects
    return '50647';
  };

  const categoryId = getCategoryForAspects();
  const fallbackCategory = '50647'; // Most comprehensive jewelry category
  const mergedCategory = 'jewelry_merged'; // Comprehensive merged data from all categories

  console.log('Enhanced Jewelry Filters using category:', categoryId);
  console.log('Selected subcategories:', selectedSubcategories);
  console.log('Will fall back to category 50647 if no data found');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Jewelry Filters</CardTitle>
        <p className="text-sm text-gray-600">
          Using comprehensive jewelry aspect data to help you find exactly what you're looking for.
        </p>
        <div className="text-xs space-y-1">
          <p className="text-blue-600">
            Primary category: {categoryId}
          </p>
          <p className="text-gray-500">
            Fallback: Category 50647 (40+ comprehensive aspects)
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multi-select aspect filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MultiSelectAspectFilter
              title="Metal Types"
              categoryId={categoryId}
              fallbackCategoryId={mergedCategory}
              aspectName="Metal"
              selectedValues={filters.metal || []}
              onChange={(values) => handleChange('metal', values)}
              placeholder="Select metals..."
            />

          <MultiSelectAspectFilter
            title="Colors"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Color"
            selectedValues={filters.colors || []}
            onChange={(values) => handleChange('colors', values)}
            placeholder="Select colors..."
          />

          <MultiSelectAspectFilter
            title="Jewelry Types"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Type"
            selectedValues={filters.categories || []}
            onChange={(values) => handleChange('categories', values)}
            placeholder="Select jewelry types..."
          />

          {/* Conditions - hardcoded since they're not aspects */}
          <div className="space-y-2">
            <Label>Conditions</Label>
            <div className="space-y-2 p-3 border rounded-md">
              {EBAY_CONDITIONS.map((condition) => {
                const selectedConditions = filters.conditions || [];
                const isChecked = selectedConditions.includes(condition.value);
                return (
                  <div key={condition.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`condition-${condition.value}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleChange('conditions', [...selectedConditions, condition.value]);
                        } else {
                          handleChange('conditions', selectedConditions.filter((c: string) => c !== condition.value));
                        }
                      }}
                    />
                    <Label htmlFor={`condition-${condition.value}`} className="text-sm cursor-pointer">
                      {condition.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <MultiSelectAspectFilter
            title="Brands"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Brand"
            selectedValues={filters.brands || []}
            onChange={(values) => handleChange('brands', values)}
            placeholder="Select brands..."
          />

          <MultiSelectAspectFilter
            title="Main Stone"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Main Stone"
            selectedValues={filters.main_stones || []}
            onChange={(values) => handleChange('main_stones', values)}
            placeholder="Select stones..."
          />

          <MultiSelectAspectFilter
            title="Metal Purity"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Metal Purity"
            selectedValues={filters.metal_purity || []}
            onChange={(values) => handleChange('metal_purity', values)}
            placeholder="Select purity..."
          />

          <MultiSelectAspectFilter
            title="Setting Style"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Setting Style"
            selectedValues={filters.setting_style || []}
            onChange={(values) => handleChange('setting_style', values)}
            placeholder="Select setting style..."
          />

          <MultiSelectAspectFilter
            title="Era"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Era"
            selectedValues={filters.era || []}
            onChange={(values) => handleChange('era', values)}
            placeholder="Select era..."
          />

          <MultiSelectAspectFilter
            title="Features"
            categoryId={categoryId}
            fallbackCategoryId={fallbackCategory}
            aspectName="Features"
            selectedValues={filters.features || []}
            onChange={(values) => handleChange('features', values)}
            placeholder="Select features..."
          />
        </div>

        {/* Price and size filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="weight_min">Min Weight (grams)</Label>
            <Input
              id="weight_min"
              type="number"
              step="0.1"
              placeholder="e.g., 1.0"
              value={filters.weight_min || ''}
              onChange={(e) => handleChange('weight_min', Number(e.target.value) || null)}
            />
          </div>

          <div>
            <Label htmlFor="weight_max">Max Weight (grams)</Label>
            <Input
              id="weight_max"
              type="number"
              step="0.1"
              placeholder="e.g., 50.0"
              value={filters.weight_max || ''}
              onChange={(e) => handleChange('weight_max', Number(e.target.value) || null)}
            />
          </div>
        </div>

        {/* Additional keywords */}
        <div>
          <Label htmlFor="keywords">Additional Keywords</Label>
          <Input
            id="keywords"
            placeholder="Enter additional search terms (comma-separated)"
            value={filters.keywords || ''}
            onChange={(e) => handleChange('keywords', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
