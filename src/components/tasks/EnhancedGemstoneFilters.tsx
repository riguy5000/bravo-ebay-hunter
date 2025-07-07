
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

  // Use real eBay category for gemstones or fallback to merged data
  const categoryId = selectedSubcategories.length > 0 
    ? selectedSubcategories[0] 
    : 'gems_merged';

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
            title="Gemstone Types"
            categoryId={categoryId}
            aspectName="Gemstone Type"
            selectedValues={filters.gemstone_types || []}
            onChange={(values) => handleChange('gemstone_types', values)}
            placeholder="Select gemstone types..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Creation"
            categoryId={categoryId}
            aspectName="Gemstone Creation"
            selectedValues={filters.gemstone_creation || []}
            onChange={(values) => handleChange('gemstone_creation', values)}
            placeholder="Select creation method..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Color"
            categoryId={categoryId}
            aspectName="Gemstone Color"
            selectedValues={filters.gemstone_color || []}
            onChange={(values) => handleChange('gemstone_color', values)}
            placeholder="Select colors..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Shape"
            categoryId={categoryId}
            aspectName="Gemstone Shape"
            selectedValues={filters.gemstone_shape || []}
            onChange={(values) => handleChange('gemstone_shape', values)}
            placeholder="Select shapes..."
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
            title="Condition"
            categoryId={categoryId}
            aspectName="Condition"
            selectedValues={filters.condition || []}
            onChange={(values) => handleChange('condition', values)}
            placeholder="Select condition..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Clarity Grade"
            categoryId={categoryId}
            aspectName="Gemstone Clarity Grade"
            selectedValues={filters.clarity_grade || []}
            onChange={(values) => handleChange('clarity_grade', values)}
            placeholder="Select clarity..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Treatment"
            categoryId={categoryId}
            aspectName="Gemstone Treatment"
            selectedValues={filters.treatment || []}
            onChange={(values) => handleChange('treatment', values)}
            placeholder="Select treatment..."
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
