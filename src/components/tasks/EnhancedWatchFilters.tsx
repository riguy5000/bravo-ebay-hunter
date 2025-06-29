
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEbayAspects } from '@/hooks/useEbayAspects';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface EnhancedWatchFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const EnhancedWatchFilters: React.FC<EnhancedWatchFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  const { aspects, loading, getAspectValues, refreshCache } = useEbayAspects('164'); // Watches category
  const [selectedBrand, setSelectedBrand] = useState(filters.brand || '');

  const handleChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    // Handle brand -> model cascading
    if (key === 'brand' && value !== selectedBrand) {
      newFilters.model = '';
      setSelectedBrand(value);
    }
    
    onChange(newFilters);
  };

  // Get values for specific aspects
  const brands = getAspectValues('Brand');
  const conditions = getAspectValues('Condition');
  const movements = getAspectValues('Movement');
  const caseMaterials = getAspectValues('Case Material');
  const bandMaterials = getAspectValues('Band Material');
  const dialColors = getAspectValues('Dial Color');
  const watchTypes = getAspectValues('Watch Type');
  const complications = getAspectValues('Complications');

  // Popular watch brands for cascading
  const watchBrands = [
    'Rolex', 'Omega', 'TAG Heuer', 'Breitling', 'Cartier', 'Patek Philippe',
    'Audemars Piguet', 'Vacheron Constantin', 'Jaeger-LeCoultre', 'IWC',
    'Panerai', 'Tudor', 'Seiko', 'Citizen', 'Casio', 'Tissot', 'Longines',
    'Breguet', 'A. Lange & Söhne', 'Richard Mille'
  ];

  // Model mappings for popular brands
  const getModelsForBrand = (brand: string) => {
    const models: Record<string, string[]> = {
      'Rolex': ['Submariner', 'GMT-Master', 'Daytona', 'Datejust', 'Day-Date', 'Explorer', 'Sea-Dweller', 'Yacht-Master', 'Air-King', 'Milgauss'],
      'Omega': ['Speedmaster', 'Seamaster', 'Constellation', 'De Ville', 'Planet Ocean', 'Aqua Terra'],
      'TAG Heuer': ['Carrera', 'Monaco', 'Aquaracer', 'Formula 1', 'Link', 'Autavia'],
      'Breitling': ['Navitimer', 'Superocean', 'Avenger', 'Premier', 'Chronomat', 'Endurance Pro'],
      'Patek Philippe': ['Nautilus', 'Aquanaut', 'Calatrava', 'Gondolo', 'Complications', 'Grand Complications'],
      'Seiko': ['SKX', 'Turtle', 'Monster', 'Prospex', 'Presage', 'Astron']
    };
    return models[brand] || [];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Watch Aspects...</CardTitle>
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
        <CardTitle>Enhanced Watch Filters</CardTitle>
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
        {/* Brand and Model */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Select 
              value={selectedBrand}
              onValueChange={(value) => handleChange('brand', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {watchBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="model">Model</Label>
            <Select 
              onValueChange={(value) => handleChange('model', value)}
              disabled={!selectedBrand}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {getModelsForBrand(selectedBrand).map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Condition and Type */}
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
            <Label htmlFor="watch_type">Watch Type</Label>
            <Select onValueChange={(value) => handleChange('watch_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {watchTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Movement and Materials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="movement">Movement</Label>
            <Select onValueChange={(value) => handleChange('movement', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select movement" />
              </SelectTrigger>
              <SelectContent>
                {movements.map((movement) => (
                  <SelectItem key={movement.value} value={movement.value}>
                    {movement.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="case_material">Case Material</Label>
            <Select onValueChange={(value) => handleChange('case_material', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {caseMaterials.map((material) => (
                  <SelectItem key={material.value} value={material.value}>
                    {material.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="band_material">Band Material</Label>
            <Select onValueChange={(value) => handleChange('band_material', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {bandMaterials.map((material) => (
                  <SelectItem key={material.value} value={material.value}>
                    {material.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Case Size and Year Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="case_size_min">Min Case Size (mm)</Label>
            <Input
              id="case_size_min"
              type="number"
              placeholder="e.g., 36"
              value={filters.case_size_min || ''}
              onChange={(e) => handleChange('case_size_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="case_size_max">Max Case Size (mm)</Label>
            <Input
              id="case_size_max"
              type="number"
              placeholder="e.g., 42"
              value={filters.case_size_max || ''}
              onChange={(e) => handleChange('case_size_max', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Year Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="year_from">Year From</Label>
            <Input
              id="year_from"
              type="number"
              placeholder="1950"
              value={filters.year_from || ''}
              onChange={(e) => handleChange('year_from', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="year_to">Year To</Label>
            <Input
              id="year_to"
              type="number"
              placeholder="2024"
              value={filters.year_to || ''}
              onChange={(e) => handleChange('year_to', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Reference Price Integration */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Price Reference</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chrono24_reference">Use Chrono24 Reference</Label>
              <Select onValueChange={(value) => handleChange('chrono24_reference', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avg">Average Price</SelectItem>
                  <SelectItem value="low">Lowest Price</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reference_margin">Reference Margin (%)</Label>
              <Input
                id="reference_margin"
                type="number"
                placeholder="e.g., 15"
                value={filters.reference_margin || ''}
                onChange={(e) => handleChange('reference_margin', Number(e.target.value))}
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
