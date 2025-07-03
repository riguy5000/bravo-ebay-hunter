
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';

interface JewelryFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const JewelryFilters: React.FC<JewelryFiltersProps> = ({ filters, onChange }) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jewelry-Specific Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelectAspectFilter
            title="Metal Types"
            categoryId="281"
            fallbackCategoryId="50647"
            aspectName="Metal"
            selectedValues={filters.metal || []}
            onChange={(values) => handleChange('metal', values)}
            placeholder="Select metals..."
          />

          <MultiSelectAspectFilter
            title="Conditions"
            categoryId="281"
            fallbackCategoryId="50647"
            aspectName="Condition"
            selectedValues={filters.conditions || []}
            onChange={(values) => handleChange('conditions', values)}
            placeholder="Select conditions..."
          />

          <MultiSelectAspectFilter
            title="Brands"
            categoryId="281"
            fallbackCategoryId="50647"
            aspectName="Brand"
            selectedValues={filters.brands || []}
            onChange={(values) => handleChange('brands', values)}
            placeholder="Select brands..."
          />

          <MultiSelectAspectFilter
            title="Jewelry Categories"
            categoryId="281"
            fallbackCategoryId="50647"
            aspectName="Type"
            selectedValues={filters.categories || []}
            onChange={(values) => handleChange('categories', values)}
            placeholder="Select jewelry types..."
          />

          <MultiSelectAspectFilter
            title="Main Stone"
            categoryId="281"
            fallbackCategoryId="50647"
            aspectName="Main Stone"
            selectedValues={filters.main_stones || []}
            onChange={(values) => handleChange('main_stones', values)}
            placeholder="Select stones..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="weight_min">Min Weight (grams)</Label>
            <Input
              id="weight_min"
              type="number"
              step="0.1"
              placeholder="e.g., 5.0"
              value={filters.weight_min || ''}
              onChange={(e) => handleChange('weight_min', e.target.value ? Number(e.target.value) : null)}
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
              onChange={(e) => handleChange('weight_max', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="keywords">Additional Keywords</Label>
          <Input
            id="keywords"
            placeholder="Enter additional search terms"
            value={filters.keywords || ''}
            onChange={(e) => handleChange('keywords', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
