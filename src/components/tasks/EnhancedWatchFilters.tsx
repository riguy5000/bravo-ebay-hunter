
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface EnhancedWatchFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
  selectedSubcategories?: string[];
}

// Recommended luxury watch brands with optional model line filters
const LUXURY_BRANDS = [
  { brand: 'Rolex', models: [] },
  { brand: 'Patek Philippe', models: [] },
  { brand: 'Audemars Piguet', models: [] },
  { brand: 'Omega', models: ['Speedmaster', 'Seamaster'] },
  { brand: 'Tudor', models: ['Black Bay'] },
];

export const EnhancedWatchFilters: React.FC<EnhancedWatchFiltersProps> = ({
  filters,
  onChange,
  selectedSubcategories = []
}) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  // Handle quick brand selection
  const handleBrandToggle = (brand: string, checked: boolean) => {
    const currentBrands = filters.brands || [];
    if (checked) {
      handleChange('brands', [...currentBrands, brand]);
    } else {
      handleChange('brands', currentBrands.filter((b: string) => b !== brand));
    }
  };

  // Handle model line keywords
  const handleModelKeywordToggle = (keyword: string, checked: boolean) => {
    const currentKeywords = filters.model_keywords || [];
    if (checked) {
      handleChange('model_keywords', [...currentKeywords, keyword]);
    } else {
      handleChange('model_keywords', currentKeywords.filter((k: string) => k !== keyword));
    }
  };

  // Use real eBay category for watches
  const categoryId = selectedSubcategories.length > 0
    ? selectedSubcategories[0]
    : 'watches_merged';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enhanced Watch Filters</CardTitle>
        <p className="text-sm text-gray-600">
          Filter watches by brand, movement, materials and more.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Brand Selection */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Luxury Brands (Quick Select)</h3>
          <div className="space-y-3">
            {LUXURY_BRANDS.map(({ brand, models }) => (
              <div key={brand} className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 min-w-[180px]">
                  <Checkbox
                    id={`brand-${brand}`}
                    checked={(filters.brands || []).includes(brand)}
                    onCheckedChange={(checked) => handleBrandToggle(brand, checked as boolean)}
                  />
                  <Label htmlFor={`brand-${brand}`} className="cursor-pointer font-medium">
                    {brand}
                  </Label>
                </div>
                {models.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Models:</span>
                    {models.map((model) => (
                      <div key={model} className="flex items-center space-x-1">
                        <Checkbox
                          id={`model-${brand}-${model}`}
                          checked={(filters.model_keywords || []).includes(model)}
                          onCheckedChange={(checked) => handleModelKeywordToggle(model, checked as boolean)}
                        />
                        <Label htmlFor={`model-${brand}-${model}`} className="cursor-pointer text-sm">
                          {model}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Show selected model keywords */}
          {(filters.model_keywords?.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-xs text-gray-500">Model keywords:</span>
              {filters.model_keywords.map((kw: string) => (
                <Badge key={kw} variant="secondary" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Primary Filters */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Primary Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectAspectFilter
              title="Brand (All)"
              categoryId={categoryId}
              aspectName="Brand"
              selectedValues={filters.brands || []}
              onChange={(values) => handleChange('brands', values)}
              placeholder="Select brands..."
            />

            <MultiSelectAspectFilter
              title="Movement"
              categoryId={categoryId}
              aspectName="Movement"
              selectedValues={filters.movements || []}
              onChange={(values) => handleChange('movements', values)}
              placeholder="Select movements..."
            />

            <MultiSelectAspectFilter
              title="Model"
              categoryId={categoryId}
              aspectName="Model"
              selectedValues={filters.models || []}
              onChange={(values) => handleChange('models', values)}
              placeholder="Select models..."
            />

            <MultiSelectAspectFilter
              title="Department"
              categoryId={categoryId}
              aspectName="Department"
              selectedValues={filters.departments || []}
              onChange={(values) => handleChange('departments', values)}
              placeholder="Select department..."
            />

            <MultiSelectAspectFilter
              title="Style"
              categoryId={categoryId}
              aspectName="Style"
              selectedValues={filters.styles || []}
              onChange={(values) => handleChange('styles', values)}
              placeholder="Select styles..."
            />

            <MultiSelectAspectFilter
              title="Type"
              categoryId={categoryId}
              aspectName="Type"
              selectedValues={filters.types || []}
              onChange={(values) => handleChange('types', values)}
              placeholder="Select types..."
            />
          </div>
        </div>

        <Separator />

        {/* Case & Display */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Case & Display</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectAspectFilter
              title="Case Material"
              categoryId={categoryId}
              aspectName="Case Material"
              selectedValues={filters.case_materials || []}
              onChange={(values) => handleChange('case_materials', values)}
              placeholder="Select case materials..."
            />

            <MultiSelectAspectFilter
              title="Case Size"
              categoryId={categoryId}
              aspectName="Case Size"
              selectedValues={filters.case_sizes || []}
              onChange={(values) => handleChange('case_sizes', values)}
              placeholder="Select case sizes..."
            />

            <MultiSelectAspectFilter
              title="Case Color"
              categoryId={categoryId}
              aspectName="Case Color"
              selectedValues={filters.case_colors || []}
              onChange={(values) => handleChange('case_colors', values)}
              placeholder="Select case colors..."
            />

            <MultiSelectAspectFilter
              title="Case Finish"
              categoryId={categoryId}
              aspectName="Case Finish"
              selectedValues={filters.case_finishes || []}
              onChange={(values) => handleChange('case_finishes', values)}
              placeholder="Select case finishes..."
            />

            <MultiSelectAspectFilter
              title="Case Thickness"
              categoryId={categoryId}
              aspectName="Case Thickness"
              selectedValues={filters.case_thicknesses || []}
              onChange={(values) => handleChange('case_thicknesses', values)}
              placeholder="Select case thickness..."
            />

            <MultiSelectAspectFilter
              title="Watch Shape"
              categoryId={categoryId}
              aspectName="Watch Shape"
              selectedValues={filters.watch_shapes || []}
              onChange={(values) => handleChange('watch_shapes', values)}
              placeholder="Select watch shapes..."
            />

            <MultiSelectAspectFilter
              title="Display"
              categoryId={categoryId}
              aspectName="Display"
              selectedValues={filters.displays || []}
              onChange={(values) => handleChange('displays', values)}
              placeholder="Select display type..."
            />

            <MultiSelectAspectFilter
              title="Caseback"
              categoryId={categoryId}
              aspectName="Caseback"
              selectedValues={filters.casebacks || []}
              onChange={(values) => handleChange('casebacks', values)}
              placeholder="Select caseback type..."
            />
          </div>
        </div>

        <Separator />

        {/* Dial & Bezel */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Dial & Bezel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectAspectFilter
              title="Dial Color"
              categoryId={categoryId}
              aspectName="Dial Color"
              selectedValues={filters.dial_colors || []}
              onChange={(values) => handleChange('dial_colors', values)}
              placeholder="Select dial colors..."
            />

            <MultiSelectAspectFilter
              title="Dial Pattern"
              categoryId={categoryId}
              aspectName="Dial Pattern"
              selectedValues={filters.dial_patterns || []}
              onChange={(values) => handleChange('dial_patterns', values)}
              placeholder="Select dial patterns..."
            />

            <MultiSelectAspectFilter
              title="Indices"
              categoryId={categoryId}
              aspectName="Indices"
              selectedValues={filters.indices || []}
              onChange={(values) => handleChange('indices', values)}
              placeholder="Select indices type..."
            />

            <MultiSelectAspectFilter
              title="Bezel Color"
              categoryId={categoryId}
              aspectName="Bezel Color"
              selectedValues={filters.bezel_colors || []}
              onChange={(values) => handleChange('bezel_colors', values)}
              placeholder="Select bezel colors..."
            />

            <MultiSelectAspectFilter
              title="Bezel Type"
              categoryId={categoryId}
              aspectName="Bezel Type"
              selectedValues={filters.bezel_types || []}
              onChange={(values) => handleChange('bezel_types', values)}
              placeholder="Select bezel types..."
            />
          </div>
        </div>

        <Separator />

        {/* Band/Strap */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Band & Strap</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectAspectFilter
              title="Band Material"
              categoryId={categoryId}
              aspectName="Band Material"
              selectedValues={filters.band_materials || []}
              onChange={(values) => handleChange('band_materials', values)}
              placeholder="Select band materials..."
            />

            <MultiSelectAspectFilter
              title="Band Color"
              categoryId={categoryId}
              aspectName="Band Color"
              selectedValues={filters.band_colors || []}
              onChange={(values) => handleChange('band_colors', values)}
              placeholder="Select band colors..."
            />

            <MultiSelectAspectFilter
              title="Band/Strap Type"
              categoryId={categoryId}
              aspectName="Band Type"
              selectedValues={filters.band_types || []}
              onChange={(values) => handleChange('band_types', values)}
              placeholder="Select band/strap type..."
            />

            <MultiSelectAspectFilter
              title="Band Width"
              categoryId={categoryId}
              aspectName="Band Width"
              selectedValues={filters.band_widths || []}
              onChange={(values) => handleChange('band_widths', values)}
              placeholder="Select band width..."
            />

            <MultiSelectAspectFilter
              title="Lug Width"
              categoryId={categoryId}
              aspectName="Lug Width"
              selectedValues={filters.lug_widths || []}
              onChange={(values) => handleChange('lug_widths', values)}
              placeholder="Select lug width..."
            />

            <MultiSelectAspectFilter
              title="Closure"
              categoryId={categoryId}
              aspectName="Closure"
              selectedValues={filters.closures || []}
              onChange={(values) => handleChange('closures', values)}
              placeholder="Select closure type..."
            />

            <MultiSelectAspectFilter
              title="Max Wrist Size"
              categoryId={categoryId}
              aspectName="Max. Wrist Size"
              selectedValues={filters.max_wrist_sizes || []}
              onChange={(values) => handleChange('max_wrist_sizes', values)}
              placeholder="Select max wrist size..."
            />
          </div>
        </div>

        <Separator />

        {/* Features & Specs */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Features & Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectAspectFilter
              title="Features"
              categoryId={categoryId}
              aspectName="Features"
              selectedValues={filters.features || []}
              onChange={(values) => handleChange('features', values)}
              placeholder="Select features..."
            />

            <MultiSelectAspectFilter
              title="Water Resistance"
              categoryId={categoryId}
              aspectName="Water Resistance"
              selectedValues={filters.water_resistances || []}
              onChange={(values) => handleChange('water_resistances', values)}
              placeholder="Select water resistance..."
            />

            <MultiSelectAspectFilter
              title="Number of Jewels"
              categoryId={categoryId}
              aspectName="Number of Jewels"
              selectedValues={filters.jewel_counts || []}
              onChange={(values) => handleChange('jewel_counts', values)}
              placeholder="Select jewel count..."
            />

            <MultiSelectAspectFilter
              title="Handedness"
              categoryId={categoryId}
              aspectName="Handedness"
              selectedValues={filters.handedness || []}
              onChange={(values) => handleChange('handedness', values)}
              placeholder="Select handedness..."
            />

            <MultiSelectAspectFilter
              title="Country of Origin"
              categoryId={categoryId}
              aspectName="Country/Region of Manufacture"
              selectedValues={filters.countries_of_origin || []}
              onChange={(values) => handleChange('countries_of_origin', values)}
              placeholder="Select country..."
            />
          </div>
        </div>

        <Separator />

        {/* Year & Condition */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Year & Condition</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectAspectFilter
              title="Year Manufactured"
              categoryId={categoryId}
              aspectName="Year Manufactured"
              selectedValues={filters.years_manufactured || []}
              onChange={(values) => handleChange('years_manufactured', values)}
              placeholder="Select years..."
            />

            <MultiSelectAspectFilter
              title="Vintage"
              categoryId={categoryId}
              aspectName="Vintage"
              selectedValues={filters.vintage || []}
              onChange={(values) => handleChange('vintage', values)}
              placeholder="Select vintage status..."
            />

            {/* Simple Condition Filter */}
            <div className="space-y-2">
              <Label>Condition</Label>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'New', label: 'New' },
                  { value: 'Pre-owned', label: 'Pre-owned' },
                ].map((condition) => (
                  <div key={condition.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`condition-${condition.value}`}
                      checked={(filters.conditions || []).includes(condition.value)}
                      onCheckedChange={(checked) => {
                        const current = filters.conditions || [];
                        if (checked) {
                          handleChange('conditions', [...current, condition.value]);
                        } else {
                          handleChange('conditions', current.filter((c: string) => c !== condition.value));
                        }
                      }}
                    />
                    <Label htmlFor={`condition-${condition.value}`} className="cursor-pointer">
                      {condition.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <MultiSelectAspectFilter
              title="Handmade"
              categoryId={categoryId}
              aspectName="Handmade"
              selectedValues={filters.handmade || []}
              onChange={(values) => handleChange('handmade', values)}
              placeholder="Select handmade status..."
            />

            {/* Year range inputs */}
            <div className="space-y-2">
              <Label htmlFor="year_from">Year From</Label>
              <Input
                id="year_from"
                type="number"
                placeholder="e.g., 1950"
                value={filters.year_from || ''}
                onChange={(e) => handleChange('year_from', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year_to">Year To</Label>
              <Input
                id="year_to"
                type="number"
                placeholder="e.g., 2024"
                value={filters.year_to || ''}
                onChange={(e) => handleChange('year_to', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Included Items & Documentation */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Included Items & Documentation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MultiSelectAspectFilter
              title="With Original Box/Packaging"
              categoryId={categoryId}
              aspectName="With Original Box/Packaging"
              selectedValues={filters.with_box || []}
              onChange={(values) => handleChange('with_box', values)}
              placeholder="Select box status..."
            />

            <MultiSelectAspectFilter
              title="With Papers"
              categoryId={categoryId}
              aspectName="With Papers"
              selectedValues={filters.with_papers || []}
              onChange={(values) => handleChange('with_papers', values)}
              placeholder="Select papers status..."
            />

            <MultiSelectAspectFilter
              title="With Manual/Booklet"
              categoryId={categoryId}
              aspectName="With Manual/Booklet"
              selectedValues={filters.with_manual || []}
              onChange={(values) => handleChange('with_manual', values)}
              placeholder="Select manual status..."
            />

            <MultiSelectAspectFilter
              title="With Service Records"
              categoryId={categoryId}
              aspectName="With Service Records"
              selectedValues={filters.with_service_records || []}
              onChange={(values) => handleChange('with_service_records', values)}
              placeholder="Select service records..."
            />

            <MultiSelectAspectFilter
              title="Seller Warranty"
              categoryId={categoryId}
              aspectName="Seller Warranty"
              selectedValues={filters.seller_warranty || []}
              onChange={(values) => handleChange('seller_warranty', values)}
              placeholder="Select warranty status..."
            />
          </div>
        </div>

        <Separator />

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
