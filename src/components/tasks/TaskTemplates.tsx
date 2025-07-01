import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Gem, 
  Watch, 
  Settings,
  Zap,
  Target,
  Clock,
  Diamond
} from 'lucide-react';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'jewelry' | 'watch' | 'gemstone';
  config: any;
  badges: string[];
  // Add missing properties that TaskForm expects
  itemType: 'watch' | 'jewelry' | 'gemstone';
  maxPrice?: number;
  listingFormats?: string[];
  watchFilters?: any;
  jewelryFilters?: any;
  gemstoneFilters?: any;
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'gold_scanner',
    name: 'Gold Scrap Scanner',
    description: 'Automatically find undervalued gold jewelry with no stones for scrap value arbitrage',
    icon: <Gem className="h-5 w-5" />,
    category: 'jewelry',
    itemType: 'jewelry',
    maxPrice: 1000,
    listingFormats: ['Best Offer'],
    jewelryFilters: {
      condition: 'Pre-owned',
      metal: 'Yellow Gold',
      main_stone: 'None',
      jewelry_type: 'Ring',
      weight_min: 2.0,
      setting_style: '',
    },
    badges: ['Fast 5s polls', 'Best Offer only', 'Melt value calc', 'No stones filter'],
    config: {
      item_type: 'jewelry',
      name: 'Gold Scrap Scanner',
      poll_interval: 5,
      listing_format: ['best_offer'],
      price_delta_type: 'percent',
      price_delta_value: 5,
      exclude_keywords: ['plated', 'filled', 'tone', 'hollow', 'gold-field', 'goldfield', 'GF', 'cartier', 'van cleef', 'tiffany', 'bulgari', 'hermes', 'diamond', 'ruby', 'sapphire', 'emerald'],
      jewelry_filters: {
        condition: 'Pre-owned',
        metal: 'Yellow Gold',
        main_stone: 'None',
        jewelry_type: 'Ring',
        weight_min: 2.0,
        setting_style: '',
      }
    }
  },
  {
    id: 'luxury_watch_hunt',
    name: 'Luxury Watch Hunt',
    description: 'Find luxury watches below market value using Chrono24 price references',
    icon: <Watch className="h-5 w-5" />,
    category: 'watch',
    itemType: 'watch',
    maxPrice: 5000,
    listingFormats: ['Fixed Price (BIN)', 'Best Offer'],
    watchFilters: {
      condition: 'Pre-owned',
      brand: 'Rolex',
      type: 'Luxury',
      movement: 'Automatic',
      case_material: 'Stainless Steel',
      chrono24_reference: 'low',
      reference_margin: 15,
      case_size_min: 36,
      case_size_max: 44,
      country_manufacture: 'Switzerland'
    },
    badges: ['Chrono24 pricing', 'Pre-owned focus', 'Auction alerts', 'Swiss brands'],
    config: {
      item_type: 'watch',
      name: 'Luxury Watch Hunt',
      poll_interval: 30,
      listing_format: ['buy_it_now', 'best_offer'],
      price_delta_type: 'percent',
      price_delta_value: 15,
      auction_alert: true,
      exclude_keywords: ['replica', 'homage', 'parts', 'repair', 'broken'],
      watch_filters: {
        condition: 'Pre-owned',
        brand: 'Rolex',
        type: 'Luxury',
        movement: 'Automatic',
        case_material: 'Stainless Steel',
        chrono24_reference: 'low',
        reference_margin: 15,
        case_size_min: 36,
        case_size_max: 44,
        country_manufacture: 'Switzerland'
      }
    }
  },
  {
    id: 'diamond_scout',
    name: 'Diamond Scout',
    description: 'Search for certified diamonds below market price using GIA/AGS references',
    icon: <Diamond className="h-5 w-5" />,
    category: 'gemstone',
    itemType: 'gemstone',
    maxPrice: 10000,
    listingFormats: ['Fixed Price (BIN)', 'Best Offer', 'Auction'],
    gemstoneFilters: {
      condition: 'New',
      stone_type: 'Diamond',
      creation: 'Natural',
      certification: 'GIA',
      clarity_diamond: 'VS1',
      color_diamond: 'G',
      cut_grade: 'Excellent',
      carat_min: 0.5,
      carat_max: 3.0,
      shape: 'Round'
    },
    badges: ['GIA certified', 'Natural only', 'Investment grade', 'Price comparison'],
    config: {
      item_type: 'gemstone',
      name: 'Diamond Scout',
      poll_interval: 60,
      listing_format: ['buy_it_now', 'best_offer', 'auction'],
      price_delta_type: 'percent',
      price_delta_value: 20,
      auction_alert: true,
      exclude_keywords: ['lab', 'synthetic', 'simulated', 'moissanite', 'cz'],
      gemstone_filters: {
        condition: 'New',
        stone_type: 'Diamond',
        creation: 'Natural',
        certification: 'GIA',
        clarity_diamond: 'VS1',
        color_diamond: 'G',
        cut_grade: 'Excellent',
        carat_min: 0.5,
        carat_max: 3.0,
        shape: 'Round'
      }
    }
  },
  {
    id: 'vintage_jewelry',
    name: 'Vintage Jewelry Hunter',
    description: 'Search for undervalued vintage and antique jewelry pieces',
    icon: <Gem className="h-5 w-5" />,
    category: 'jewelry',
    itemType: 'jewelry',
    maxPrice: 2000,
    listingFormats: ['Fixed Price (BIN)', 'Best Offer', 'Auction'],
    jewelryFilters: {
      condition: 'Pre-owned',
      style: 'Vintage-Inspired',
      metal: 'Yellow Gold',
      metal_purity: '14k',
      jewelry_type: 'Ring',
      main_stone: 'Diamond',
      setting_style: 'Prong'
    },
    badges: ['Estate pieces', 'Vintage focus', 'Designer brands', 'Art Deco'],
    config: {
      item_type: 'jewelry',
      name: 'Vintage Jewelry Hunter',
      poll_interval: 60,
      listing_format: ['buy_it_now', 'best_offer', 'auction'],
      price_delta_type: 'absolute',
      price_delta_value: 500,
      auction_alert: true,
      exclude_keywords: ['replica', 'reproduction', 'costume'],
      jewelry_filters: {
        condition: 'Pre-owned',
        style: 'Vintage-Inspired',
        metal: 'Yellow Gold',
        metal_purity: '14k',
        jewelry_type: 'Ring',
        main_stone: 'Diamond',
        setting_style: 'Prong'
      }
    }
  },
  {
    id: 'colored_gemstone_hunt',
    name: 'Colored Gemstone Hunt',
    description: 'Find natural colored gemstones with good investment potential',
    icon: <Gem className="h-5 w-5" />,
    category: 'gemstone',
    itemType: 'gemstone',
    maxPrice: 5000,
    listingFormats: ['Fixed Price (BIN)', 'Best Offer'],
    gemstoneFilters: {
      condition: 'New',
      stone_type: 'Sapphire',
      creation: 'Natural',
      treatment: 'Untreated',
      origin: 'Sri Lanka',
      clarity_colored: 'Eye-Clean',
      carat_min: 1.0,
      carat_max: 5.0,
      shape: 'Oval'
    },
    badges: ['Natural stones', 'Untreated focus', 'Ceylon/Burma', 'Collector grade'],
    config: {
      item_type: 'gemstone',
      name: 'Colored Gemstone Hunt',
      poll_interval: 45,
      listing_format: ['buy_it_now', 'best_offer'],
      price_delta_type: 'percent',
      price_delta_value: 25,
      exclude_keywords: ['synthetic', 'lab', 'treated', 'heated', 'filled'],
      gemstone_filters: {
        condition: 'New',
        stone_type: 'Sapphire',
        creation: 'Natural',
        treatment: 'Untreated',
        origin: 'Sri Lanka',
        clarity_colored: 'Eye-Clean',
        carat_min: 1.0,
        carat_max: 5.0,
        shape: 'Oval'
      }
    }
  }
];

interface TaskTemplatesProps {
  onSelectTemplate: (template: TaskTemplate) => void;
  onCustomTask: () => void;
}

export const TaskTemplates: React.FC<TaskTemplatesProps> = ({ 
  onSelectTemplate, 
  onCustomTask 
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose a Task Template</h2>
        <p className="text-gray-600">
          Start with a pre-configured template or create a custom task from scratch
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TASK_TEMPLATES.map((template) => (
          <Card 
            key={template.id} 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200"
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  {template.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {template.badges.map((badge, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {badge}
                  </Badge>
                ))}
              </div>
              <Button className="w-full" size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Use This Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom Task Option */}
      <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Settings className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900">Custom Task</h3>
              <p className="text-gray-600 text-sm">
                Configure all search parameters manually for maximum control
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={onCustomTask}
              className="flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              Create Custom Task
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { TASK_TEMPLATES };
export type { TaskTemplate };
