
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EnhancedJewelryFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const EnhancedJewelryFilters: React.FC<EnhancedJewelryFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  // Use multiple jewelry categories to get comprehensive aspect data
  const jewelryCategoryIds = ['164330', '45077', '164331', '45080', '155124', '164395']; // Mix of fine, fashion, men's, and wedding jewelry

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Jewelry Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multi-select aspect filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelectAspectFilter
            title="Metal Types"
            categoryId={jewelryCategoryIds[0]}
            aspectName="Metal"
            selectedValues={filters.metal || []}
            onChange={(values) => handleChange('metal', values)}
            placeholder="Select metals..."
          />

          <MultiSelectAspectFilter
            title="Colors"
            categoryId={jewelryCategoryIds[1]}
            aspectName="Color"
            selectedValues={filters.colors || []}
            onChange={(values) => handleChange('colors', values)}
            placeholder="Select colors..."
          />

          <MultiSelectAspectFilter
            title="Jewelry Types"
            categoryId={jewelryCategoryIds[2]}
            aspectName="Type"
            selectedValues={filters.categories || []}
            onChange={(values) => handleChange('categories', values)}
            placeholder="Select jewelry types..."
          />

          <MultiSelectAspectFilter
            title="Conditions"
            categoryId={jewelryCategoryIds[0]}
            aspectName="Condition"
            selectedValues={filters.conditions || []}
            onChange={(values) => handleChange('conditions', values)}
            placeholder="Select conditions..."
          />

          <MultiSelectAspectFilter
            title="Brands"
            categoryId={jewelryCategoryIds[3]}
            aspectName="Brand"
            selectedValues={filters.brands || []}
            onChange={(values) => handleChange('brands', values)}
            placeholder="Select brands..."
          />

          <MultiSelectAspectFilter
            title="Main Stone"
            categoryId={jewelryCategoryIds[4]}
            aspectName="Main Stone"
            selectedValues={filters.main_stones || []}
            onChange={(values) => handleChange('main_stones', values)}
            placeholder="Select stones..."
          />

          <MultiSelectAspectFilter
            title="Metal Purity"
            categoryId={jewelryCategoryIds[0]}
            aspectName="Metal Purity"
            selectedValues={filters.metal_purity || []}
            onChange={(values) => handleChange('metal_purity', values)}
            placeholder="Select purity..."
          />

          <MultiSelectAspectFilter
            title="Style"
            categoryId={jewelryCategoryIds[1]}
            aspectName="Style"
            selectedValues={filters.styles || []}
            onChange={(values) => handleChange('styles', values)}
            placeholder="Select styles..."
          />

          <MultiSelectAspectFilter
            title="Main Stone Color"
            categoryId={jewelryCategoryIds[5]}
            aspectName="Main Stone Color"
            selectedValues={filters.stone_colors || []}
            onChange={(values) => handleChange('stone_colors', values)}
            placeholder="Select stone colors..."
          />

          <MultiSelectAspectFilter
            title="Material"
            categoryId={jewelryCategoryIds[2]}
            aspectName="Material"
            selectedValues={filters.materials || []}
            onChange={(values) => handleChange('materials', values)}
            placeholder="Select materials..."
          />
        </div>

        {/* Numeric filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="weight_min">Min Weight (grams)</Label>
            <Input
              id="weight_min"
              type="number"
              step="0.1"
              placeholder="e.g., 5.0"
              value={filters.weight_min || ''}
              onChange={(e) => handleChange('weight_min', Number(e.target.value))}
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
              onChange={(e) => handleChange('weight_max', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="carat_weight_min">Min Carat Weight</Label>
            <Input
              id="carat_weight_min"
              type="number"
              step="0.01"
              placeholder="e.g., 0.25"
              value={filters.carat_weight_min || ''}
              onChange={(e) => handleChange('carat_weight_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="carat_weight_max">Max Carat Weight</Label>
            <Input
              id="carat_weight_max"
              type="number"
              step="0.01"
              placeholder="e.g., 2.0"
              value={filters.carat_weight_max || ''}
              onChange={(e) => handleChange('carat_weight_max', Number(e.target.value))}
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
