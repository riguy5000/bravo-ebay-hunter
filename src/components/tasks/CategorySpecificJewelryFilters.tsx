
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectAspectFilter } from './MultiSelectAspectFilter';
import { supabase } from '@/integrations/supabase/client';

// Map UI categories to eBay leaf category IDs
const JEWELRY_CATEGORIES = {
  'Fine Categories': {
    'Rings': '164343',
    'Necklaces & Pendants': '164329', 
    'Earrings': '164321',
    'Bracelets': '10968',
    'Brooches & Pins': '50692',
    'Charms / Charm Bracelets': '140956',
    'Body Jewellery': '103428'
  },
  'Fashion Categories': {
    'Fashion Rings': '50647',
    'Fashion Necklaces & Pendants': '155101',
    'Fashion Earrings': '155099',
    'Fashion Bracelets': '155100'
  },
  'Men\'s Categories': {
    'Men\'s Rings': '102888',
    'Men\'s Necklaces': '102890',
    'Men\'s Bracelets': '102889',
    'Men\'s Cufflinks': '102891'
  },
  'Wedding Categories': {
    'Engagement Rings': '92947',
    'Wedding Bands': '91452'
  },
  'Vintage': {
    'Vintage Fine Jewellery': '48579'
  },
  'Metal-only': {
    'Gold Jewellery': '67705',
    'Silver Jewellery': '4191',
    'Platinum Jewellery': '164329' // Note: requires Metal=Platinum aspect filter
  }
};

interface CategorySpecificJewelryFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const CategorySpecificJewelryFilters: React.FC<CategorySpecificJewelryFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');

  // Update category ID when selection changes
  useEffect(() => {
    if (selectedGroup && selectedCategory) {
      const newCategoryId = JEWELRY_CATEGORIES[selectedGroup as keyof typeof JEWELRY_CATEGORIES][selectedCategory];
      setCategoryId(newCategoryId);
      
      // Update filters with new category
      const updatedFilters = {
        ...filters,
        categoryGroup: selectedGroup,
        categoryName: selectedCategory,
        leafCategoryId: newCategoryId,
        // Add special handling for Platinum Jewellery
        ...(selectedCategory === 'Platinum Jewellery' && {
          metal: ['Platinum']
        })
      };
      onChange(updatedFilters);
    }
  }, [selectedGroup, selectedCategory, filters, onChange]);

  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const handleGroupChange = (group: string) => {
    setSelectedGroup(group);
    setSelectedCategory('');
    setCategoryId('');
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jewelry Category & Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="category-group">Category Group</Label>
            <Select value={selectedGroup} onValueChange={handleGroupChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select category group..." />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(JEWELRY_CATEGORIES).map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="specific-category">Specific Category</Label>
            <Select 
              value={selectedCategory} 
              onValueChange={handleCategoryChange}
              disabled={!selectedGroup}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select specific category..." />
              </SelectTrigger>
              <SelectContent>
                {selectedGroup && Object.keys(JEWELRY_CATEGORIES[selectedGroup as keyof typeof JEWELRY_CATEGORIES]).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Display selected category info */}
        {categoryId && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm">
              <strong>Selected:</strong> {selectedGroup} → {selectedCategory}
            </div>
            <div className="text-xs text-gray-600">
              eBay Category ID: {categoryId}
            </div>
          </div>
        )}

        {/* Aspect-based filters - only show when category is selected */}
        {categoryId && (
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

            <MultiSelectAspectFilter
              title="Setting Style"
              categoryId={categoryId}
              aspectName="Setting Style"
              selectedValues={filters.setting_style || []}
              onChange={(values) => handleChange('setting_style', values)}
              placeholder="Select setting styles..."
            />
          </div>
        )}

        {/* Additional keywords */}
        <div>
          <Label htmlFor="keywords">Additional Keywords</Label>
          <input
            id="keywords"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter additional search terms"
            value={filters.keywords || ''}
            onChange={(e) => handleChange('keywords', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
};
