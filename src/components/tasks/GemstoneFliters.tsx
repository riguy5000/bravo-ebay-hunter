
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GemstoneFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const GemstoneFliters: React.FC<GemstoneFiltersProps> = ({ filters, onChange }) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const gemstoneTypes = [
    'Diamond', 'Ruby', 'Sapphire', 'Emerald', 'Amethyst', 'Citrine',
    'Garnet', 'Peridot', 'Topaz', 'Opal', 'Turquoise', 'Jade',
    'Tanzanite', 'Aquamarine', 'Pearl', 'Coral'
  ];

  const cuts = [
    'Round', 'Princess', 'Cushion', 'Emerald', 'Asscher', 'Radiant',
    'Oval', 'Pear', 'Marquise', 'Heart', 'Trillion', 'Baguette'
  ];

  const clarities = [
    'FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'
  ];

  const colors = [
    'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
  ];

  const treatments = [
    'Natural', 'Heat Treated', 'Oil Treated', 'Irradiated', 'Diffused', 'Synthetic'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gemstone-Specific Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="gemstone_type">Gemstone Type</Label>
            <Select onValueChange={(value) => handleChange('gemstone_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select gemstone" />
              </SelectTrigger>
              <SelectContent>
                {gemstoneTypes.map((type) => (
                  <SelectItem key={type} value={type.toLowerCase()}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="cut">Cut</Label>
            <Select onValueChange={(value) => handleChange('cut', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select cut" />
              </SelectTrigger>
              <SelectContent>
                {cuts.map((cut) => (
                  <SelectItem key={cut} value={cut.toLowerCase()}>
                    {cut}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="carat_min">Min Carat Weight</Label>
            <Input
              id="carat_min"
              type="number"
              step="0.01"
              placeholder="e.g., 0.5"
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
            <Label htmlFor="clarity">Clarity (Diamonds)</Label>
            <Select onValueChange={(value) => handleChange('clarity', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select clarity" />
              </SelectTrigger>
              <SelectContent>
                {clarities.map((clarity) => (
                  <SelectItem key={clarity} value={clarity}>
                    {clarity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="color">Color (Diamonds)</Label>
            <Select onValueChange={(value) => handleChange('color', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                {colors.map((color) => (
                  <SelectItem key={color} value={color}>
                    {color}
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
                  <SelectItem key={treatment} value={treatment.toLowerCase()}>
                    {treatment}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="origin">Origin</Label>
            <Input
              id="origin"
              placeholder="e.g., Burma, Sri Lanka, Kashmir"
              value={filters.origin || ''}
              onChange={(e) => handleChange('origin', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="certification">Certification</Label>
            <Input
              id="certification"
              placeholder="e.g., GIA, AGS, SSEF"
              value={filters.certification || ''}
              onChange={(e) => handleChange('certification', e.target.value)}
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
