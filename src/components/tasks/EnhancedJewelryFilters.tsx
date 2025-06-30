
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  // Use the first selected subcategory, or fall back to jewelry_general
  const categoryId = selectedSubcategories.length > 0 
    ? selectedSubcategories[0] 
    : 'jewelry_general';

  console.log('Enhanced Jewelry Filters categoryId:', categoryId);
  console.log('Selected subcategories:', selectedSubcategories);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Jewelry Filters</CardTitle>
        <p className="text-sm text-gray-600">
          Using comprehensive jewelry aspect data to help you find exactly what you're looking for.
        </p>
        {selectedSubcategories.length > 0 && (
          <p className="text-xs text-blue-600">
            Using category: {categoryId}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multi-select aspect filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelectAspectFilter
            title="Metal Types"
            categoryId={categoryId}
            aspectName="Metal"
            selectedValues={filters.metal || []}
            onChange={(values) => handleChange('metal', values)}
            placeholder="Select metals..."
          />

          <MultiSelectAspectFilter
            title="Colors"
            categoryId={categoryId}
            aspectName="Color"
            selectedValues={filters.colors || []}
            onChange={(values) => handleChange('colors', values)}
            placeholder="Select colors..."
          />

          <MultiSelectAspectFilter
            title="Jewelry Types"
            categoryId={categoryId}
            aspectName="Type"
            selectedValues={filters.categories || []}
            onChange={(values) => handleChange('categories', values)}
            placeholder="Select jewelry types..."
          />

          <MultiSelectAspectFilter
            title="Conditions"
            categoryId={categoryId}
            aspectName="Condition"
            selectedValues={filters.conditions || []}
            onChange={(values) => handleChange('conditions', values)}
            placeholder="Select conditions..."
          />

          <MultiSelectAspectFilter
            title="Brands"
            categoryId={categoryId}
            aspectName="Brand"
            selectedValues={filters.brands || []}
            onChange={(values) => handleChange('brands', values)}
            placeholder="Select brands..."
          />

          <MultiSelectAspectFilter
            title="Main Stone"
            categoryId={categoryId}
            aspectName="Main Stone"
            selectedValues={filters.main_stones || []}
            onChange={(values) => handleChange('main_stones', values)}
            placeholder="Select stones..."
          />

          <MultiSelectAspectFilter
            title="Metal Purity"
            categoryId={categoryId}
            aspectName="Metal Purity"
            selectedValues={filters.metal_purity || []}
            onChange={(values) => handleChange('metal_purity', values)}
            placeholder="Select purity..."
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
