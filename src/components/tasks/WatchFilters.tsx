
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface WatchFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const WatchFilters: React.FC<WatchFiltersProps> = ({ filters, onChange }) => {
  const handleChange = (key: string, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const watchBrands = [
    'Rolex', 'Omega', 'TAG Heuer', 'Breitling', 'Cartier', 'Patek Philippe',
    'Audemars Piguet', 'Vacheron Constantin', 'Jaeger-LeCoultre', 'IWC',
    'Panerai', 'Tudor', 'Seiko', 'Citizen', 'Casio', 'Tissot'
  ];

  const watchTypes = [
    'Dress Watch', 'Sports Watch', 'Diving Watch', 'Pilot Watch',
    'Chronograph', 'GMT', 'Field Watch', 'Racing Watch'
  ];

  const conditions = [
    'New', 'Excellent', 'Very Good', 'Good', 'Fair', 'Parts/Repair'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch-Specific Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Select onValueChange={(value) => handleChange('brand', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {watchBrands.map((brand) => (
                  <SelectItem key={brand} value={brand.toLowerCase()}>
                    {brand}
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
                  <SelectItem key={type} value={type.toLowerCase()}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="e.g., Submariner, Speedmaster"
              value={filters.model || ''}
              onChange={(e) => handleChange('model', e.target.value)}
            />
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

          <div>
            <Label htmlFor="case_material">Case Material</Label>
            <Input
              id="case_material"
              placeholder="e.g., Stainless Steel, Gold"
              value={filters.case_material || ''}
              onChange={(e) => handleChange('case_material', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="movement">Movement</Label>
            <Select onValueChange={(value) => handleChange('movement', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select movement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Automatic</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="quartz">Quartz</SelectItem>
              </SelectContent>
            </Select>
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
