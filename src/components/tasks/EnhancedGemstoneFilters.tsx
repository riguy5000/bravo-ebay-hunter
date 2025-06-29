
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEbayAspects } from '@/hooks/useEbayAspects';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface EnhancedGemstoneFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const EnhancedGemstoneFilters: React.FC<EnhancedGemstoneFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  // Load aspects from both gemstone categories
  const diamondAspects = useEbayAspects('10207'); // Loose Diamonds
  const gemstoneAspects = useEbayAspects('51089'); // Loose Gemstones (Non-Diamond)
  const [selectedStoneType, setSelectedStoneType] = useState(filters.stone_type || '');

  const handleChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    // Handle stone type cascading - reset specific properties when stone type changes
    if (key === 'stone_type' && value !== selectedStoneType) {
      // Reset diamond-specific fields if switching away from diamond
      if (selectedStoneType === 'Diamond' && value !== 'Diamond') {
        newFilters.color_diamond = '';
        newFilters.clarity_diamond = '';
        newFilters.cut_grade = '';
      }
      // Reset colored gem fields if switching to diamond
      if (value === 'Diamond' && selectedStoneType !== 'Diamond') {
        newFilters.color_colored = '';
        newFilters.clarity_colored = '';
      }
      setSelectedStoneType(value);
    }
    
    onChange(newFilters);
  };

  // Determine which aspects to use based on stone type
  const currentAspects = selectedStoneType === 'Diamond' ? diamondAspects : gemstoneAspects;
  const { getAspectValues, refreshCache, loading } = currentAspects;

  // Get values for specific aspects
  const conditions = getAspectValues('Condition');
  const stoneTypes = [
    ...diamondAspects.getAspectValues('Stone Type'),
    ...gemstoneAspects.getAspectValues('Stone Type')
  ].filter((item, index, self) => 
    index === self.findIndex(t => t.value === item.value)
  );
  const creations = getAspectValues('Creation');
  const treatments = getAspectValues('Treatment');
  const transparencies = getAspectValues('Transparency');
  const shapes = getAspectValues('Shape / Cut');
  const cutGrades = getAspectValues('Cut Grade (Diamonds)');
  const diamondColors = getAspectValues('Colour (Diamonds)');
  const coloredGemColors = getAspectValues('Colour (Coloured Gems)');
  const diamondClarities = getAspectValues('Clarity (Diamonds)');
  const coloredGemClarities = getAspectValues('Clarity (Coloured Gems)');
  const certifications = getAspectValues('Certification / Report');
  const origins = getAspectValues('Country / Region of Origin');
  const features = getAspectValues('Features');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Gemstone Aspects...</CardTitle>
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
        <CardTitle>Enhanced Gemstone Filters</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshCache}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh eBay Data
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
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
            <Label htmlFor="stone_type">Stone Type</Label>
            <Select 
              value={selectedStoneType}
              onValueChange={(value) => handleChange('stone_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stone type" />
              </SelectTrigger>
              <SelectContent>
                {stoneTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stone Properties */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Stone Properties</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="creation">Creation</Label>
              <Select onValueChange={(value) => handleChange('creation', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select creation" />
                </SelectTrigger>
                <SelectContent>
                  {creations.map((creation) => (
                    <SelectItem key={creation.value} value={creation.value}>
                      {creation.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="treatment">Treatment</Label>
              <Select onValueChange={(value) => handleChange('treatment', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select treatment" />
                </SelectTrigger>
                <SelectContent>
                  {treatments.map((treatment) => (
                    <SelectItem key={treatment.value} value={treatment.value}>
                      {treatment.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="transparency">Transparency</Label>
              <Select onValueChange={(value) => handleChange('transparency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transparency" />
                </SelectTrigger>
                <SelectContent>
                  {transparencies.map((transparency) => (
                    <SelectItem key={transparency.value} value={transparency.value}>
                      {transparency.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Shape and Cut */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shape">Shape / Cut</Label>
            <Select onValueChange={(value) => handleChange('shape', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select shape" />
              </SelectTrigger>
              <SelectContent>
                {shapes.map((shape) => (
                  <SelectItem key={shape.value} value={shape.value}>
                    {shape.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStoneType === 'Diamond' && (
            <div>
              <Label htmlFor="cut_grade">Cut Grade (Diamonds)</Label>
              <Select onValueChange={(value) => handleChange('cut_grade', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cut grade" />
                </SelectTrigger>
                <SelectContent>
                  {cutGrades.map((grade) => (
                    <SelectItem key={grade.value} value={grade.value}>
                      {grade.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Color - conditional based on stone type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedStoneType === 'Diamond' ? (
            <div>
              <Label htmlFor="color_diamond">Diamond Color</Label>
              <Select onValueChange={(value) => handleChange('color_diamond', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select diamond color" />
                </SelectTrigger>
                <SelectContent>
                  {diamondColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label htmlFor="color_colored">Gemstone Color</Label>
              <Select onValueChange={(value) => handleChange('color_colored', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gemstone color" />
                </SelectTrigger>
                <SelectContent>
                  {coloredGemColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedStoneType === 'Diamond' ? (
            <div>
              <Label htmlFor="clarity_diamond">Diamond Clarity</Label>
              <Select onValueChange={(value) => handleChange('clarity_diamond', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select diamond clarity" />
                </SelectTrigger>
                <SelectContent>
                  {diamondClarities.map((clarity) => (
                    <SelectItem key={clarity.value} value={clarity.value}>
                      {clarity.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label htmlFor="clarity_colored">Gemstone Clarity</Label>
              <Select onValueChange={(value) => handleChange('clarity_colored', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gemstone clarity" />
                </SelectTrigger>
                <SelectContent>
                  {coloredGemClarities.map((clarity) => (
                    <SelectItem key={clarity.value} value={clarity.value}>
                      {clarity.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Carat Weight */}
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
              placeholder="e.g., 5.00"
              value={filters.carat_max || ''}
              onChange={(e) => handleChange('carat_max', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Dimensions (L×W×D) */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Dimensions (mm)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="length_mm">Length</Label>
              <Input
                id="length_mm"
                type="number"
                step="0.1"
                placeholder="e.g., 6.5"
                value={filters.length_mm || ''}
                onChange={(e) => handleChange('length_mm', Number(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="width_mm">Width</Label>
              <Input
                id="width_mm"
                type="number"
                step="0.1"
                placeholder="e.g., 4.5"
                value={filters.width_mm || ''}
                onChange={(e) => handleChange('width_mm', Number(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="depth_mm">Depth</Label>
              <Input
                id="depth_mm"
                type="number"
                step="0.1"
                placeholder="e.g., 2.8"
                value={filters.depth_mm || ''}
                onChange={(e) => handleChange('depth_mm', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Certification and Origin */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="certification">Certification / Report</Label>
            <Select onValueChange={(value) => handleChange('certification', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select certification" />
              </SelectTrigger>
              <SelectContent>
                {certifications.map((cert) => (
                  <SelectItem key={cert.value} value={cert.value}>
                    {cert.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="origin">Country / Region of Origin</Label>
            <Select onValueChange={(value) => handleChange('origin', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select origin" />
              </SelectTrigger>
              <SelectContent>
                {origins.map((origin) => (
                  <SelectItem key={origin.value} value={origin.value}>
                    {origin.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Special Features */}
        <div>
          <Label htmlFor="features">Special Features</Label>
          <Select onValueChange={(value) => handleChange('features', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select features" />
            </SelectTrigger>
            <SelectContent>
              {features.map((feature) => (
                <SelectItem key={feature.value} value={feature.value}>
                  {feature.meaning}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
