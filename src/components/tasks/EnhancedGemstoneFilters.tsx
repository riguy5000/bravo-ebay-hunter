
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EnhancedGemstoneFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
  selectedSubcategories?: string[];
}

export const EnhancedGemstoneFilters: React.FC<EnhancedGemstoneFiltersProps> = ({ 
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
    : 'gemstone_general';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Gemstone Filters</CardTitle>
        <p className="text-sm text-gray-600">
          Search for specific gemstones by type, cut, and quality.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multi-select aspect filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelectAspectFilter
            title="Stone Types"
            categoryId={categoryId}
            aspectName="Stone Type"
            selectedValues={filters.stone_types || []}
            onChange={(values) => handleChange('stone_types', values)}
            placeholder="Select stone types..."
          />

          <MultiSelectAspectFilter
            title="Cuts/Shapes"
            categoryId={categoryId}
            aspectName="Cut"
            selectedValues={filters.cuts || []}
            onChange={(values) => handleChange('cuts', values)}
            placeholder="Select cuts/shapes..."
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
