
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';

interface EnhancedGemstoneFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
  selectedSubcategories?: string[];
}

// Certification labs for manual selection
const CERT_LABS = ['GIA', 'AGS', 'AGL', 'Gubelin', 'SSEF', 'GRS', 'IGI', 'GCAL', 'HRD', 'EGL'];

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
            mergedCategoryId="gems_merged"
            aspectName="Gemstone Type"
            selectedValues={filters.stone_types || []}
            onChange={(values) => handleChange('stone_types', values)}
            placeholder="Select gemstone types..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Creation"
            categoryId={categoryId}
            mergedCategoryId="gems_merged"
            aspectName="Gemstone Creation"
            selectedValues={filters.gemstone_creation || []}
            onChange={(values) => handleChange('gemstone_creation', values)}
            placeholder="Select creation method..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Color"
            categoryId={categoryId}
            mergedCategoryId="gems_merged"
            aspectName="Gemstone Color"
            selectedValues={filters.colors || []}
            onChange={(values) => handleChange('colors', values)}
            placeholder="Select colors..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Shape"
            categoryId={categoryId}
            mergedCategoryId="gems_merged"
            aspectName="Gemstone Shape"
            selectedValues={filters.shapes || []}
            onChange={(values) => handleChange('shapes', values)}
            placeholder="Select shapes..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Clarity Grade"
            categoryId={categoryId}
            mergedCategoryId="gems_merged"
            aspectName="Gemstone Clarity Grade"
            selectedValues={filters.clarities || []}
            onChange={(values) => handleChange('clarities', values)}
            placeholder="Select clarity..."
          />

          <MultiSelectAspectFilter
            title="Gemstone Treatment"
            categoryId={categoryId}
            mergedCategoryId="gems_merged"
            aspectName="Gemstone Treatment"
            selectedValues={filters.treatments || []}
            onChange={(values) => handleChange('treatments', values)}
            placeholder="Select treatment..."
          />

          <MultiSelectAspectFilter
            title="Condition"
            categoryId={categoryId}
            mergedCategoryId="gems_merged"
            aspectName="Condition"
            selectedValues={filters.conditions || []}
            onChange={(values) => handleChange('conditions', values)}
            placeholder="Select condition..."
          />

          <MultiSelectAspectFilter
            title="Brands"
            categoryId={categoryId}
            mergedCategoryId="gems_merged"
            aspectName="Brand"
            selectedValues={filters.brands || []}
            onChange={(values) => handleChange('brands', values)}
            placeholder="Select brands..."
          />
        </div>

        {/* Carat Weight Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="carat_min">Min Carat Weight</Label>
            <Input
              id="carat_min"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={filters.carat_min || ''}
              onChange={(e) => handleChange('carat_min', e.target.value ? parseFloat(e.target.value) : undefined)}
            />
          </div>
          <div>
            <Label htmlFor="carat_max">Max Carat Weight</Label>
            <Input
              id="carat_max"
              type="number"
              step="0.01"
              min="0"
              placeholder="10.00"
              value={filters.carat_max || ''}
              onChange={(e) => handleChange('carat_max', e.target.value ? parseFloat(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Certifications */}
        <div>
          <Label className="mb-2 block">Certifications</Label>
          <div className="flex flex-wrap gap-2">
            {CERT_LABS.map((lab) => (
              <label key={lab} className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-md cursor-pointer hover:bg-gray-200">
                <Checkbox
                  checked={(filters.certifications || []).includes(lab)}
                  onCheckedChange={(checked) => {
                    const current = filters.certifications || [];
                    if (checked) {
                      handleChange('certifications', [...current, lab]);
                    } else {
                      handleChange('certifications', current.filter((c: string) => c !== lab));
                    }
                  }}
                />
                <span className="text-sm">{lab}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Scoring Thresholds */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium">Deal Scoring Thresholds</h4>

          <div>
            <div className="flex justify-between mb-2">
              <Label>Minimum Deal Score</Label>
              <span className="text-sm font-medium">{filters.min_deal_score || 0}/100</span>
            </div>
            <Slider
              value={[filters.min_deal_score || 0]}
              onValueChange={([value]) => handleChange('min_deal_score', value)}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Only show deals scoring above this threshold</p>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <Label>Maximum Risk Score</Label>
              <span className="text-sm font-medium">{filters.max_risk_score || 100}/100</span>
            </div>
            <Slider
              value={[filters.max_risk_score || 100]}
              onValueChange={([value]) => handleChange('max_risk_score', value)}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Hide listings with risk score above this threshold</p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="allow_lab_created"
              checked={filters.allow_lab_created || false}
              onCheckedChange={(checked) => handleChange('allow_lab_created', checked)}
            />
            <Label htmlFor="allow_lab_created" className="cursor-pointer">
              Allow lab-created / synthetic stones
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include_jewelry"
              checked={filters.include_jewelry || false}
              onCheckedChange={(checked) => handleChange('include_jewelry', checked)}
            />
            <Label htmlFor="include_jewelry" className="cursor-pointer">
              Include jewelry with stones (not just loose stones)
            </Label>
          </div>
        </div>

        {/* Additional Keywords */}
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
