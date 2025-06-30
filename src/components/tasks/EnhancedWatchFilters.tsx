
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEbayAspects } from '@/hooks/useEbayAspects';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database } from 'lucide-react';

interface EnhancedWatchFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const EnhancedWatchFilters: React.FC<EnhancedWatchFiltersProps> = ({ 
  filters, 
  onChange 
}) => {
  const { aspects, loading, getAspectValues, refreshCache, populateTestData, error } = useEbayAspects('31387'); // Luxury/Wristwatches
  const [selectedBrand, setSelectedBrand] = useState(filters.brand || '');

  const handleChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    // Handle brand → model cascading
    if (key === 'brand' && value !== selectedBrand) {
      newFilters.model = '';
      newFilters.reference_number = '';
      setSelectedBrand(value);
    }
    
    onChange(newFilters);
  };

  // Get values for specific aspects from eBay
  const conditions = getAspectValues('Condition');
  const brands = getAspectValues('Brand');
  const departments = getAspectValues('Department');
  const types = getAspectValues('Type');
  const movements = getAspectValues('Movement');
  const caseMaterials = getAspectValues('Case Material');
  const caseColors = getAspectValues('Case Colour');
  const bezelMaterials = getAspectValues('Bezel Material');
  const bezelColors = getAspectValues('Bezel Colour');
  const crystals = getAspectValues('Crystal');
  const dialColors = getAspectValues('Dial Colour');
  const dialPatterns = getAspectValues('Dial Pattern / Indices');
  const bandMaterials = getAspectValues('Band Material');
  const bandColors = getAspectValues('Band Colour');
  const bandTypes = getAspectValues('Band/Bracelet Type');
  const waterResistances = getAspectValues('Water Resistance (m)');
  const complications = getAspectValues('Complications / Features');
  const countries = getAspectValues('Country/Region of Manufacture');
  const vintageEras = getAspectValues('Vintage / Era');
  const styles = getAspectValues('Style');

  // Model mappings for popular brands
  const getModelsForBrand = (brand: string) => {
    const models: Record<string, string[]> = {
      'Rolex': ['Submariner', 'GMT-Master', 'Daytona', 'Datejust', 'Day-Date', 'Explorer', 'Sea-Dweller', 'Yacht-Master', 'Air-King', 'Milgauss'],
      'Omega': ['Speedmaster', 'Seamaster', 'Constellation', 'De Ville', 'Planet Ocean', 'Aqua Terra'],
      'TAG Heuer': ['Carrera', 'Monaco', 'Aquaracer', 'Formula 1', 'Link', 'Autavia'],
      'Breitling': ['Navitimer', 'Superocean', 'Avenger', 'Premier', 'Chronomat', 'Endurance Pro'],
      'Patek Philippe': ['Nautilus', 'Aquanaut', 'Calatrava', 'Gondolo', 'Complications', 'Grand Complications'],
      'Seiko': ['SKX', 'Turtle', 'Monster', 'Prospex', 'Presage', 'Astron'],
      'Cartier': ['Santos', 'Tank', 'Ballon Bleu', 'Pasha', 'Drive', 'Rotonde'],
      'IWC': ['Pilot', 'Portugieser', 'Aquatimer', 'Da Vinci', 'Ingenieur'],
      'Tudor': ['Black Bay', 'Pelagos', 'Royal', 'Ranger', 'Glamour']
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={populateTestData}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Add Test Data
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
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {/* Basic Properties */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Label htmlFor="department">Department</Label>
            <Select onValueChange={(value) => handleChange('department', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.value} value={dept.value}>
                    {dept.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <Select onValueChange={(value) => handleChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Brand, Model, Reference */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Brand & Model</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {brands.map((brand) => (
                    <SelectItem key={brand.value} value={brand.value}>
                      {brand.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="model">Model / Line</Label>
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

            <div>
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                placeholder="e.g., 116610LN"
                value={filters.reference_number || ''}
                onChange={(e) => handleChange('reference_number', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Movement and Case */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Movement & Case</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="case_color">Case Color</Label>
              <Select onValueChange={(value) => handleChange('case_color', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {caseColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="crystal">Crystal</Label>
              <Select onValueChange={(value) => handleChange('crystal', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crystal" />
                </SelectTrigger>
                <SelectContent>
                  {crystals.map((crystal) => (
                    <SelectItem key={crystal.value} value={crystal.value}>
                      {crystal.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Case Size and Thickness */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="case_size_min">Min Case Size (mm)</Label>
            <Input
              id="case_size_min"
              type="number"
              step="0.5"
              placeholder="24"
              value={filters.case_size_min || ''}
              onChange={(e) => handleChange('case_size_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="case_size_max">Max Case Size (mm)</Label>
            <Input
              id="case_size_max"
              type="number"
              step="0.5"
              placeholder="60"
              value={filters.case_size_max || ''}
              onChange={(e) => handleChange('case_size_max', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="thickness_min">Min Thickness (mm)</Label>
            <Input
              id="thickness_min"
              type="number"
              step="0.1"
              placeholder="4"
              value={filters.thickness_min || ''}
              onChange={(e) => handleChange('thickness_min', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="thickness_max">Max Thickness (mm)</Label>
            <Input
              id="thickness_max"
              type="number"
              step="0.1"
              placeholder="20"
              value={filters.thickness_max || ''}
              onChange={(e) => handleChange('thickness_max', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Bezel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bezel_material">Bezel Material</Label>
            <Select onValueChange={(value) => handleChange('bezel_material', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select bezel material" />
              </SelectTrigger>
              <SelectContent>
                {bezelMaterials.map((material) => (
                  <SelectItem key={material.value} value={material.value}>
                    {material.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="bezel_color">Bezel Color</Label>
            <Select onValueChange={(value) => handleChange('bezel_color', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select bezel color" />
              </SelectTrigger>
              <SelectContent>
                {bezelColors.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    {color.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dial */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dial_color">Dial Color</Label>
            <Select onValueChange={(value) => handleChange('dial_color', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select dial color" />
              </SelectTrigger>
              <SelectContent>
                {dialColors.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    {color.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dial_pattern">Dial Pattern / Indices</Label>
            <Select onValueChange={(value) => handleChange('dial_pattern', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select dial pattern" />
              </SelectTrigger>
              <SelectContent>
                {dialPatterns.map((pattern) => (
                  <SelectItem key={pattern.value} value={pattern.value}>
                    {pattern.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Band/Bracelet */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Band / Bracelet</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div>
              <Label htmlFor="band_color">Band Color</Label>
              <Select onValueChange={(value) => handleChange('band_color', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {bandColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="band_type">Band/Bracelet Type</Label>
              <Select onValueChange={(value) => handleChange('band_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {bandTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lug_width_min">Min Lug Width (mm)</Label>
              <Input
                id="lug_width_min"
                type="number"
                placeholder="10"
                value={filters.lug_width_min || ''}
                onChange={(e) => handleChange('lug_width_min', Number(e.target.value))}
              />
            </div>

            <div>
              <Label htmlFor="lug_width_max">Max Lug Width (mm)</Label>
              <Input
                id="lug_width_max"
                type="number"
                placeholder="32"
                value={filters.lug_width_max || ''}
                onChange={(e) => handleChange('lug_width_max', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Features and Complications */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="water_resistance">Water Resistance (m)</Label>
            <Select onValueChange={(value) => handleChange('water_resistance', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select resistance" />
              </SelectTrigger>
              <SelectContent>
                {waterResistances.map((resistance) => (
                  <SelectItem key={resistance.value} value={resistance.value}>
                    {resistance.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="complications">Complications / Features</Label>
            <Select onValueChange={(value) => handleChange('complications', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select complications" />
              </SelectTrigger>
              <SelectContent>
                {complications.map((comp) => (
                  <SelectItem key={comp.value} value={comp.value}>
                    {comp.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Year and Origin */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="year_manufactured">Year Manufactured</Label>
            <Input
              id="year_manufactured"
              type="number"
              placeholder="e.g., 2020"
              value={filters.year_manufactured || ''}
              onChange={(e) => handleChange('year_manufactured', Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="country_manufacture">Country of Manufacture</Label>
            <Select onValueChange={(value) => handleChange('country_manufacture', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.value} value={country.value}>
                    {country.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="vintage_era">Vintage / Era</Label>
            <Select onValueChange={(value) => handleChange('vintage_era', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select era" />
              </SelectTrigger>
              <SelectContent>
                {vintageEras.map((era) => (
                  <SelectItem key={era.value} value={era.value}>
                    {era.meaning}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Accessories and Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="with_box">With Original Box</Label>
            <Select onValueChange={(value) => handleChange('with_box', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="with_papers">With Papers / Warranty Card</Label>
            <Select onValueChange={(value) => handleChange('with_papers', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

        {/* Price Reference Integration */}
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
