
import React from 'react';
import { CategorySpecificJewelryFilters } from './CategorySpecificJewelryFilters';

interface JewelryFiltersProps {
  filters: any;
  onChange: (filters: any) => void;
}

export const JewelryFilters: React.FC<JewelryFiltersProps> = ({ filters, onChange }) => {
  return (
    <CategorySpecificJewelryFilters 
      filters={filters} 
      onChange={onChange} 
    />
  );
};
