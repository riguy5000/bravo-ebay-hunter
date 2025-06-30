
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EnhancedWatchFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
  selectedSubcategories?: string[];
}

export const EnhancedWatchFilters: React.FC<EnhancedWatchFiltersProps> = ({ 
  filters, 
  onChange,
  selectedSubcategories = []
}) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  // Use test category for consistent data
  const categoryId = selectedSubcategories.length > 0 
    ? selectedSubcategories[0] 
    : 'watch_general';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Watch Filters</CardTitle>
        <p className="text-sm text-gray-600">
          Filter watches by brand, movement, materials and more.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multi-select aspect filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelectAspectFilter
            title="Brands"
            categoryId={categoryId}
            aspectName="Brand"
            selectedValues={filters.brands || []}
            onChange={(values) => handleChange('brands', values)}
            placeholder="Select brands..."
          />

          <MultiSelectAspectFilter
            title="Movement Types"
            categoryId={categoryId}
            aspectName="Movement"
            selectedValues={filters.movements || []}
            onChange={(values) => handleChange('movements', values)}
            placeholder="Select movements..."
          />

          <MultiSelectAspectFilter
            title="Case Materials"
            categoryId={categoryId}
            aspectName="Case Material"
            selectedValues={filters.case_materials || []}
            onChange={(values) => handleChange('case_materials', values)}
            placeholder="Select case materials..."
          />
        </div>

        {/* Additional filters */}
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
