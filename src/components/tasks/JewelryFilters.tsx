
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface JewelryFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const JewelryFilters: React.FC<JewelryFiltersProps> = ({ filters, onChange }) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const jewelryTypes = [
    'Ring', 'Necklace', 'Bracelet', 'Earrings', 'Pendant', 'Brooch',
    'Cufflinks', 'Watch', 'Chain', 'Anklet', 'Charm'
  ];

  const metals = [
    '14k Gold', '18k Gold', '22k Gold', '24k Gold', 'White Gold', 'Rose Gold',
    'Yellow Gold', 'Platinum', 'Silver', 'Sterling Silver', 'Palladium'
  ];

  const conditions = [
    'New', 'Excellent', 'Very Good', 'Good', 'Fair', 'Parts/Repair'
  ];

  const brands = [
    'Tiffany & Co', 'Cartier', 'David Yurman', 'Pandora', 'Kay Jewelers',
    'Zales', 'Jared', 'Blue Nile', 'Brilliant Earth', 'James Allen'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jewelry-Specific Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="jewelry_type">Jewelry Type</Label>
            <Select onValueChange={(value) => handleChange('jewelry_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {jewelryTypes.map((type) => (
                  <SelectItem key={type} value={type.toLowerCase()}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="metal">Metal</Label>
            <Select onValueChange={(value) => handleChange('metal', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select metal" />
              </SelectTrigger>
              <SelectContent>
                {metals.map((metal) => (
                  <SelectItem key={metal} value={metal.toLowerCase()}>
                    {metal}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="brand">Brand</Label>
            <Select onValueChange={(value) => handleChange('brand', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand.toLowerCase()}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select onValueChange={(value) => handleChange('condition', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {conditions.map((condition) => (
                  <SelectItem key={condition} value={condition.toLowerCase()}>
                    {condition}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="weight_min">Min Weight (grams)</Label>
            <Input
              id="weight_min"
              type="number"
              step="0.1"
              placeholder="e.g., 5.0"
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

          <div>
            <Label htmlFor="stone_type">Stone Type</Label>
            <Input
              id="stone_type"
              placeholder="e.g., Diamond, Ruby, Sapphire"
              value={filters.stone_type || ''}
              onChange={(e) => handleChange('stone_type', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="carat_weight">Carat Weight</Label>
            <Input
              id="carat_weight"
              type="number"
              step="0.01"
              placeholder="e.g., 1.5"
              value={filters.carat_weight || ''}
              onChange={(e) => handleChange('carat_weight', Number(e.target.value))}
            />
          </div>
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
      </CardContent>
    </Card>
  );
};
