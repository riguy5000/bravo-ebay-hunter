
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EnhancedGemstoneFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const EnhancedGemstoneFilters: React.FC<EnhancedGemstoneFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  // Use gemstone-specific categories
  const gemstoneCategoryIds = ['10207', '51089']; // Diamonds and non-diamond gemstones

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Gemstone Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Multi-select aspect filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MultiSelectAspectFilter
            title="Stone Types"
            categoryId={gemstoneCategoryIds[1]}
            aspectName="Stone Type"
            selectedValues={filters.stone_types || []}
            onChange={(values) => handleChange('stone_types', values)}
            placeholder="Select stone types..."
          />

          <MultiSelectAspectFilter
            title="Cuts/Shapes"
            categoryId={gemstoneCategoryIds[0]}
            aspectName="Shape / Cut"
            selectedValues={filters.cuts || []}
            onChange={(values) => handleChange('cuts', values)}
            placeholder="Select cuts/shapes..."
          />

          <MultiSelectAspectFilter
            title="Colors"
            categoryId={gemstoneCategoryIds[1]}
            aspectName="Color"
            selectedValues={filters.colors || []}
            onChange={(values) => handleChange('colors', values)}
            placeholder="Select colors..."
          />

          <MultiSelectAspectFilter
            title="Creation Method"
            categoryId={gemstoneCategoryIds[0]}
            aspectName="Creation"
            selectedValues={filters.creation_methods || []}
            onChange={(values) => handleChange('creation_methods', values)}
            placeholder="Select creation methods..."
          />

          <MultiSelectAspectFilter
            title="Diamond Color Grades"
            categoryId={gemstoneCategoryIds[0]}
            aspectName="Colour (Diamonds)"
            selectedValues={filters.diamond_colors || []}
            onChange={(values) => handleChange('diamond_colors', values)}
            placeholder="Select diamond colors..."
          />

          <MultiSelectAspectFilter
            title="Diamond Clarity Grades"
            categoryId={gemstoneCategoryIds[0]}
            aspectName="Clarity (Diamonds)"
            selectedValues={filters.diamond_clarity || []}
            onChange={(values) => handleChange('diamond_clarity', values)}
            placeholder="Select clarity grades..."
          />

          <MultiSelectAspectFilter
            title="Conditions"
            categoryId={gemstoneCategoryIds[0]}
            aspectName="Condition"
            selectedValues={filters.conditions || []}
            onChange={(values) => handleChange('conditions', values)}
            placeholder="Select conditions..."
          />

          <MultiSelectAspectFilter
            title="Carat Weight Ranges"
            categoryId={gemstoneCategoryIds[0]}
            aspectName="Carat Weight"
            selectedValues={filters.carat_ranges || []}
            onChange={(values) => handleChange('carat_ranges', values)}
            placeholder="Select carat ranges..."
          />
        </div>

        {/* Numeric filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="carat_min">Min Carat Weight</Label>
            <Input
              id="carat_min"
              type="number"
              step="0.01"
              placeholder="e.g., 0.25"
              value={filters.carat_min || ''}
              onChange={(e) => handleChange('carat_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="carat_max">Max Carat Weight</Label>
            <Input
              id="carat_max"
              type="number"
              step="0.01"
              placeholder="e.g., 5.0"
              value={filters.carat_max || ''}
              onChange={(e) => handleChange('carat_max', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="length_min">Min Length (mm)</Label>
            <Input
              id="length_min"
              type="number"
              step="0.1"
              placeholder="e.g., 5.0"
              value={filters.length_min || ''}
              onChange={(e) => handleChange('length_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="width_min">Min Width (mm)</Label>
            <Input
              id="width_min"
              type="number"
              step="0.1"
              placeholder="e.g., 5.0"
              value={filters.width_min || ''}
              onChange={(e) => handleChange('width_min', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Text filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="certification_lab">Certification Lab</Label>
            <Input
              id="certification_lab"
              placeholder="e.g., GIA, AGS, Gübelin"
              value={filters.certification_lab || ''}
              onChange={(e) => handleChange('certification_lab', e.target.value)}
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
