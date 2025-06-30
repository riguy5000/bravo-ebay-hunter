
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useEbayAspects } from '@/hooks/useEbayAspects';
import { Button } from '@/components/ui/button';
import { RefreshCw, TestTube } from 'lucide-react';

interface EnhancedJewelryFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const EnhancedJewelryFilters: React.FC<EnhancedJewelryFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  // Use Fine Rings category (164330) - a valid leaf category with aspects
  const { aspects, loading, getAspectValues, refreshCache, populateTestData } = useEbayAspects('164330');
  const [selectedMetal, setSelectedMetal] = useState(filters.metal || '');
  const [isPopulatingTestData, setIsPopulatingTestData] = useState(false);
  
  const handleChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    // Handle cascading - reset metal purity when metal changes
    if (key === 'metal' && value !== selectedMetal) {
      newFilters.metal_purity = '';
      setSelectedMetal(value);
    }
    
    onChange(newFilters);
  };

  const handleMultiSelectChange = (key: string, value: string, checked: boolean) => {
    const currentValues = filters[key] || [];
    if (checked) {
      handleChange(key, [...currentValues, value]);
    } else {
      handleChange(key, currentValues.filter((v: string) => v !== value));
    }
  };

  const handlePopulateTestData = async () => {
    setIsPopulatingTestData(true);
    try {
      await populateTestData();
    } finally {
      setIsPopulatingTestData(false);
    }
  };

  // Get values for specific aspects
  const conditions = getAspectValues('Condition');
  const metals = getAspectValues('Metal');
  const metalPurities = getAspectValues('Metal Purity');
  const mainStones = getAspectValues('Main Stone');
  const stoneShapes = getAspectValues('Main Stone Shape');
  const stoneColors = getAspectValues('Main Stone Colour');
  const stoneCreations = getAspectValues('Main Stone Creation');
  const stoneTreatments = getAspectValues('Main Stone Treatment');
  const jewelryTypes = getAspectValues('Jewelry Type');
  const settingStyles = getAspectValues('Setting Style');
  const styles = getAspectValues('Style');
  const vintageEras = getAspectValues('Vintage');

  // Filter metal purities based on selected metal
  const getFilteredMetalPurities = () => {
    if (!selectedMetal) return metalPurities;
    
    // Basic filtering logic - in real implementation, this would be more sophisticated
    if (selectedMetal.toLowerCase().includes('gold')) {
      return metalPurities.filter(p => 
        p.value.includes('k') || p.value.includes('K')
      );
    } else if (selectedMetal.toLowerCase().includes('silver')) {
      return metalPurities.filter(p => 
        p.value.includes('925') || p.value.includes('Sterling') || p.value.includes('Fine')
      );
    } else if (selectedMetal.toLowerCase().includes('platinum')) {
      return metalPurities.filter(p => 
        p.value.includes('850') || p.value.includes('900') || p.value.includes('950') || p.value.includes('999')
      );
    }
    
    return metalPurities;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading eBay Aspects...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Enhanced Jewelry Filters</CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePopulateTestData}
            disabled={isPopulatingTestData}
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isPopulatingTestData ? 'Adding Test Data...' : 'Add Test Data'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshCache}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh eBay Data
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show data status */}
        <div className="text-sm text-gray-600 mb-4">
          {aspects.length > 0 ? (
            <span className="text-green-600">✓ {aspects.length} aspects loaded from eBay</span>
          ) : (
            <span className="text-orange-600">⚠ No aspects loaded - try refreshing or adding test data</span>
          )}
        </div>

        {/* Basic Properties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select onValueChange={(value) => handleChange('condition', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {conditions.map((condition) => (
                  <SelectItem key={condition.value} value={condition.value}>
                    {condition.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="jewelry_type">Jewelry Type</Label>
            <Select onValueChange={(value) => handleChange('jewelry_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {jewelryTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metal Properties */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Metal Properties</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="metal">Metal</Label>
              <Select 
                value={selectedMetal}
                onValueChange={(value) => handleChange('metal', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select metal" />
                </SelectTrigger>
                <SelectContent>
                  {metals.map((metal) => (
                    <SelectItem key={metal.value} value={metal.value}>
                      {metal.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="metal_purity">Metal Purity</Label>
              <Select 
                onValueChange={(value) => handleChange('metal_purity', value)}
                disabled={!selectedMetal}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select purity" />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredMetalPurities().map((purity) => (
                    <SelectItem key={purity.value} value={purity.value}>
                      {purity.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stone Properties */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Stone Properties</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="main_stone">Main Stone</Label>
              <Select onValueChange={(value) => handleChange('main_stone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select main stone" />
                </SelectTrigger>
                <SelectContent>
                  {mainStones.map((stone) => (
                    <SelectItem key={stone.value} value={stone.value}>
                      {stone.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="stone_shape">Stone Shape</Label>
              <Select onValueChange={(value) => handleChange('stone_shape', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shape" />
                </SelectTrigger>
                <SelectContent>
                  {stoneShapes.map((shape) => (
                    <SelectItem key={shape.value} value={shape.value}>
                      {shape.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="stone_color">Stone Color</Label>
              <Select onValueChange={(value) => handleChange('stone_color', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {stoneColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="stone_creation">Stone Creation</Label>
              <Select onValueChange={(value) => handleChange('stone_creation', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select creation" />
                </SelectTrigger>
                <SelectContent>
                  {stoneCreations.map((creation) => (
                    <SelectItem key={creation.value} value={creation.value}>
                      {creation.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Style & Setting */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="setting_style">Setting Style</Label>
            <Select onValueChange={(value) => handleChange('setting_style', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select setting" />
              </SelectTrigger>
              <SelectContent>
                {settingStyles.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="style">Style</Label>
            <Select onValueChange={(value) => handleChange('style', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ring-specific fields */}
        {filters.jewelry_type === 'Ring' && (
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Ring-Specific Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ring_size">Ring Size (US)</Label>
                <Select onValueChange={(value) => handleChange('ring_size', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 41 }, (_, i) => {
                      const size = 3 + (i * 0.25);
                      return (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sizable">Sizable</Label>
                <Select onValueChange={(value) => handleChange('sizable', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="band_width">Band Width (mm)</Label>
                <Input
                  id="band_width"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 3.5"
                  value={filters.band_width || ''}
                  onChange={(e) => handleChange('band_width', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Weight Range */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Weight & Price</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weight_min">Min Weight (grams)</Label>
              <Input
                id="weight_min"
                type="number"
                step="0.1"
                placeholder="e.g., 1.0"
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
