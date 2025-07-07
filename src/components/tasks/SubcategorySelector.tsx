
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface Subcategory {
  id: string;
  name: string;
}

interface SubcategorySelectorProps {
  itemType: string;
  selectedSubcategories: string[];
  onChange: (subcategories: string[]) => void;
}

const JEWELRY_SUBCATEGORIES: Record<string, Subcategory[]> = {
  fine: [
    { id: '164330', name: 'Fine Rings' },
    { id: '164331', name: 'Fine Necklaces & Pendants' },
    { id: '164332', name: 'Fine Earrings' },
    { id: '164333', name: 'Fine Bracelets' },
    { id: '164334', name: 'Fine Brooches & Pins' },
    { id: '164336', name: 'Fine Charms & Charm Bracelets' },
    { id: '164338', name: 'Fine Body Jewelry' },
  ],
  fashion: [
    { id: '45077', name: 'Fashion Rings' },
    { id: '45080', name: 'Fashion Necklaces & Pendants' },
    { id: '45081', name: 'Fashion Earrings' },
    { id: '45079', name: 'Fashion Bracelets' },
    { id: '45078', name: 'Fashion Pins & Brooches' },
  ],
  mens: [
    { id: '155123', name: 'Men\'s Jewelry (General)' },
    { id: '155124', name: 'Men\'s Rings' },
    { id: '155125', name: 'Men\'s Necklaces' },
    { id: '155126', name: 'Men\'s Bracelets' },
  ],
  wedding: [
    { id: '164395', name: 'Engagement Rings' },
    { id: '164396', name: 'Wedding Bands' },
    { id: '164397', name: 'Wedding Sets' },
  ],
  vintage: [
    { id: '48579', name: 'Vintage & Antique Jewelry' },
    { id: '48580', name: 'Vintage Fine Jewelry' },
    { id: '48581', name: 'Vintage Costume Jewelry' },
  ],
  metal: [
    { id: '164344', name: 'Gold Jewelry' },
    { id: '164345', name: 'Silver Jewelry' },
    { id: '164346', name: 'Platinum Jewelry' },
  ]
};

const WATCH_SUBCATEGORIES: Record<string, Subcategory[]> = {
  luxury: [
    { id: '31387', name: 'Luxury Watches/Wristwatches' },
  ],
  casual: [
    { id: '14324', name: 'Casual Watches' },
  ],
  mens: [
    { id: '31388', name: 'Men\'s Watches' },
  ],
  womens: [
    { id: '31389', name: 'Women\'s Watches' },
  ]
};

const GEMSTONE_SUBCATEGORIES: Record<string, Subcategory[]> = {
  diamonds: [
    { id: '10207', name: 'Loose Diamonds' },
  ],
  gemstones: [
    { id: '51089', name: 'Loose Gemstones (Non-Diamond)' },
  ]
};

export const SubcategorySelector: React.FC<SubcategorySelectorProps> = ({
  itemType,
  selectedSubcategories,
  onChange
}) => {
  const [availableSubcategories, setAvailableSubcategories] = useState<Record<string, Subcategory[]>>({});

  console.log('🏷️ SubcategorySelector received:', { itemType, selectedSubcategories });

  useEffect(() => {
    switch (itemType) {
      case 'jewelry':
        setAvailableSubcategories(JEWELRY_SUBCATEGORIES);
        break;
      case 'watch':
        setAvailableSubcategories(WATCH_SUBCATEGORIES);
        break;
      case 'gemstone':
        setAvailableSubcategories(GEMSTONE_SUBCATEGORIES);
        break;
      default:
        setAvailableSubcategories({});
    }
  }, [itemType]);

  const handleSubcategoryAdd = (categoryKey: string, subcategoryId: string) => {
    if (!selectedSubcategories.includes(subcategoryId)) {
      onChange([...selectedSubcategories, subcategoryId]);
    }
  };

  const handleRemoveSubcategory = (subcategoryId: string) => {
    onChange(selectedSubcategories.filter(id => id !== subcategoryId));
  };

  const getSubcategoryName = (subcategoryId: string): string => {
    for (const categoryGroup of Object.values(availableSubcategories)) {
      const found = categoryGroup.find(sub => sub.id === subcategoryId);
      if (found) return found.name;
    }
    return subcategoryId;
  };

  if (Object.keys(availableSubcategories).length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Label>Select Specific Subcategories (Optional)</Label>
      <p className="text-sm text-gray-600">
        Choose specific subcategories to get more targeted aspect data and search results.
      </p>
      
      {Object.entries(availableSubcategories).map(([categoryKey, subcategories]) => (
        <div key={categoryKey} className="space-y-2">
          <Label className="text-sm font-medium capitalize">{categoryKey.replace('_', ' ')} Categories</Label>
          <Select onValueChange={(value) => handleSubcategoryAdd(categoryKey, value)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${categoryKey} subcategory...`} />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map((subcategory) => (
                <SelectItem 
                  key={subcategory.id} 
                  value={subcategory.id}
                  disabled={selectedSubcategories.includes(subcategory.id)}
                >
                  {subcategory.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* Selected subcategories display */}
      {selectedSubcategories.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selected Subcategories:</Label>
          <div className="flex flex-wrap gap-2">
            {selectedSubcategories.map((subcategoryId) => (
              <Badge key={subcategoryId} variant="secondary" className="flex items-center gap-1">
                {getSubcategoryName(subcategoryId)}
                <button
                  onClick={() => handleRemoveSubcategory(subcategoryId)}
                  className="hover:bg-gray-300 rounded-full p-0.5 ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
