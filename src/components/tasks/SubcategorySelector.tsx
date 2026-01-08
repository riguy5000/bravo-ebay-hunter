
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
    { id: '261994', name: 'Fine Rings' },
    { id: '261993', name: 'Fine Necklaces & Pendants' },
    { id: '261990', name: 'Fine Earrings' },
    { id: '261988', name: 'Fine Bracelets' },
    { id: '261989', name: 'Fine Brooches & Pins' },
    { id: '261988', name: 'Fine Charms & Charm Bracelets' },
    { id: '261986', name: 'Fine Body Jewelry' },
  ],
  fashion: [
    { id: '67681', name: 'Fashion Rings' },
    { id: '155101', name: 'Fashion Necklaces & Pendants' },
    { id: '50647', name: 'Fashion Earrings' },
    { id: '261987', name: 'Fashion Bracelets' },
    { id: '50677', name: 'Fashion Pins & Brooches' },
  ],
  mens: [
    { id: '10290', name: 'Men\'s Jewelry (General)' },
    { id: '137856', name: 'Men\'s Rings' },
    { id: '137839', name: 'Men\'s Necklaces' },
    { id: '137836', name: 'Men\'s Bracelets' },
  ],
  wedding: [
    { id: '261975', name: 'Engagement Rings' },
    { id: '261977', name: 'Wedding Bands' },
    { id: '261976', name: 'Wedding Sets' },
  ],
  vintage: [
    { id: '262024', name: 'Vintage & Antique Jewelry' },
    { id: '262014', name: 'Vintage Fine Jewelry' },
    { id: '262023', name: 'Vintage Costume Jewelry' },
  ],
  metal: [
    { id: '4196', name: 'Fine Jewelry (Gold/Silver/Platinum)' },
    { id: '10968', name: 'Fashion Jewelry' },
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

  // Map of all category IDs (including old incorrect ones) to names
  const ALL_CATEGORY_NAMES: Record<string, string> = {
    // Current correct IDs
    '261994': 'Fine Rings',
    '261993': 'Fine Necklaces & Pendants',
    '261990': 'Fine Earrings',
    '261988': 'Fine Bracelets / Charms',
    '261989': 'Fine Brooches & Pins',
    '261986': 'Fine Body Jewelry',
    '67681': 'Fashion Rings',
    '155101': 'Fashion Necklaces & Pendants',
    '50647': 'Fashion Earrings',
    '261987': 'Fashion Bracelets',
    '50677': 'Fashion Pins & Brooches',
    '10290': "Men's Jewelry (General)",
    '137856': "Men's Rings",
    '137839': "Men's Necklaces",
    '137836': "Men's Bracelets",
    '261975': 'Engagement Rings',
    '261977': 'Wedding Bands',
    '261976': 'Wedding Sets',
    '262024': 'Vintage & Antique Jewelry',
    '262014': 'Vintage Fine Jewelry',
    '262023': 'Vintage Costume Jewelry',
    '4196': 'Fine Jewelry (Gold/Silver/Platinum)',
    '10968': 'Fashion Jewelry',
    // Old incorrect IDs (for backwards compatibility)
    '164330': 'Fine Rings (old ID)',
    '164331': 'Fine Necklaces & Pendants (old ID)',
    '164332': 'Fine Earrings (old ID)',
    '164333': 'Fine Bracelets (old ID)',
    '164334': 'Fine Brooches & Pins (old ID)',
    '164336': 'Fine Charms (old ID)',
    '164338': 'Fine Body Jewelry (old ID)',
    '45077': 'Fashion Rings (old ID)',
    '45080': 'Fashion Necklaces (old ID)',
    '45081': 'Fashion Earrings (old ID)',
    '45079': 'Fashion Bracelets (old ID)',
    '45078': 'Fashion Brooches (old ID)',
    '155123': "Men's Jewelry (old ID)",
    '155124': "Men's Rings (old ID)",
    '155125': "Men's Necklaces (old ID)",
    '155126': "Men's Bracelets (old ID)",
    '164395': 'Engagement Rings (old ID)',
    '164396': 'Wedding Bands (old ID)',
    '164397': 'Wedding Sets (old ID)',
    '48579': 'Vintage Jewelry (old ID)',
    '48580': 'Vintage Fine (old ID)',
    '48581': 'Vintage Costume (old ID)',
    // Watch IDs
    '31387': 'Luxury Watches',
    '14324': 'Casual Watches',
    '31388': "Men's Watches",
    '31389': "Women's Watches",
    // Gemstone IDs
    '10207': 'Loose Diamonds',
    '51089': 'Loose Gemstones',
  };

  const getSubcategoryName = (subcategoryId: string): string => {
    // First check the complete mapping
    if (ALL_CATEGORY_NAMES[subcategoryId]) {
      return ALL_CATEGORY_NAMES[subcategoryId];
    }
    // Fall back to searching availableSubcategories
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
