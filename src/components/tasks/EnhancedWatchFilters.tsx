
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EnhancedWatchFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const EnhancedWatchFilters: React.FC<EnhancedWatchFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  // Use multiple watch categories to get comprehensive aspect data
  const watchCategoryIds = ['31387', '14324', '31388', '31389']; // Mix of luxury, casual, men's, women's

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Watch Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multi-select aspect filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelectAspectFilter
            title="Brands"
            categoryId={watchCategoryIds[0]}
            aspectName="Brand"
            selectedValues={filters.brands || []}
            onChange={(values) => handleChange('brands', values)}
            placeholder="Select brands..."
          />

          <MultiSelectAspectFilter
            title="Movement Types"
            categoryId={watchCategoryIds[0]}
            aspectName="Movement"
            selectedValues={filters.movements || []}
            onChange={(values) => handleChange('movements', values)}
            placeholder="Select movements..."
          />

          <MultiSelectAspectFilter
            title="Case Materials"
            categoryId={watchCategoryIds[0]}
            aspectName="Case Material"
            selectedValues={filters.case_materials || []}
            onChange={(values) => handleChange('case_materials', values)}
            placeholder="Select case materials..."
          />

          <MultiSelectAspectFilter
            title="Band Materials"
            categoryId={watchCategoryIds[0]}
            aspectName="Band Material"
            selectedValues={filters.band_materials || []}
            onChange={(values) => handleChange('band_materials', values)}
            placeholder="Select band materials..."
          />

          <MultiSelectAspectFilter
            title="Conditions"
            categoryId={watchCategoryIds[0]}
            aspectName="Condition"
            selectedValues={filters.conditions || []}
            onChange={(values) => handleChange('conditions', values)}
            placeholder="Select conditions..."
          />

          <MultiSelectAspectFilter
            title="Department"
            categoryId={watchCategoryIds[0]}
            aspectName="Department"
            selectedValues={filters.departments || []}
            onChange={(values) => handleChange('departments', values)}
            placeholder="Select departments..."
          />

          <MultiSelectAspectFilter
            title="Case Sizes"
            categoryId={watchCategoryIds[0]}
            aspectName="Case Size"
            selectedValues={filters.case_sizes || []}
            onChange={(values) => handleChange('case_sizes', values)}
            placeholder="Select case sizes..."
          />

          <MultiSelectAspectFilter
            title="Colors"
            categoryId={watchCategoryIds[1]}
            aspectName="Color"
            selectedValues={filters.colors || []}
            onChange={(values) => handleChange('colors', values)}
            placeholder="Select colors..."
          />
        </div>

        {/* Numeric filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="case_size_min">Min Case Size (mm)</Label>
            <Input
              id="case_size_min"
              type="number"
              placeholder="e.g., 32"
              value={filters.case_size_min || ''}
              onChange={(e) => handleChange('case_size_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="case_size_max">Max Case Size (mm)</Label>
            <Input
              id="case_size_max"
              type="number"
              placeholder="e.g., 44"
              value={filters.case_size_max || ''}
              onChange={(e) => handleChange('case_size_max', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="year_min">Min Year</Label>
            <Input
              id="year_min"
              type="number"
              placeholder="e.g., 2000"
              value={filters.year_min || ''}
              onChange={(e) => handleChange('year_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="year_max">Max Year</Label>
            <Input
              id="year_max"
              type="number"
              placeholder="e.g., 2024"
              value={filters.year_max || ''}
              onChange={(e) => handleChange('year_max', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Text filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="e.g., Submariner, Speedmaster"
              value={filters.model || ''}
              onChange={(e) => handleChange('model', e.target.value)}
            />
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
        </div>
      </CardContent>
    </Card>
  );
};
