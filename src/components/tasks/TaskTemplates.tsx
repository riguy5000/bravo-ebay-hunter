
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
  Clock
} from 'lucide-react';

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'jewelry' | 'watch' | 'gemstone';
  config: any;
  badges: string[];
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'gold_scanner',
    name: 'Gold Scrap Scanner',
    description: 'Automatically find undervalued gold jewelry with no stones for scrap value arbitrage',
    icon: <Gem className="h-5 w-5" />,
    category: 'jewelry',
    badges: ['Fast 5s polls', 'Best Offer only', 'Melt value calc', 'No stones filter'],
    config: {
      item_type: 'jewelry',
      name: 'Gold Scrap Scanner',
      poll_interval: 5,
      listing_format: ['best_offer'],
      price_delta_type: 'percent',
      price_delta_value: 5, // 5% below melt
      exclude_keywords: ['plated', 'filled', 'tone', 'hollow', 'gold-field', 'goldfield', 'GF', 'cartier', 'van cleef', 'tiffany', 'bulgari', 'hermes', 'diamond', 'ruby', 'sapphire', 'emerald'],
      jewelry_filters: {
        metal: 'Yellow Gold',
        main_stone: 'None',
        jewelry_type: ['Ring', 'Necklace', 'Bracelet', 'Chain'],
        condition: 'Pre-owned',
        weight_min: 2.0, // Minimum 2g for decent scrap value
        setting_style: '', // Allow any setting since we want scrap
      }
    }
  },
  {
    id: 'watch_hunt',
    name: 'Quick Watch Hunt',
    description: 'Find luxury watches below market value using Chrono24 price references',
    icon: <Watch className="h-5 w-5" />,
    category: 'watch',
    badges: ['Chrono24 pricing', 'Pre-owned focus', 'Auction alerts', 'Luxury brands'],
    config: {
      item_type: 'watch',
      name: 'Quick Watch Hunt',
      poll_interval: 30,
      listing_format: ['buy_it_now', 'best_offer'],
      price_delta_type: 'percent',
      price_delta_value: 15, // 15% below Chrono24 low
      auction_alert: true,
      exclude_keywords: ['replica', 'homage', 'parts', 'repair', 'broken'],
      watch_filters: {
        condition: 'Pre-owned',
        brand: 'Rolex', // Start with Rolex as default
        chrono24_reference: 'low',
        reference_margin: 15,
        case_size_min: 36,
        case_size_max: 44,
        movement: 'Automatic'
      }
    }
  },
  {
    id: 'vintage_jewelry',
    name: 'Vintage Jewelry Hunter',
    description: 'Search for undervalued vintage and antique jewelry pieces',
    icon: <Gem className="h-5 w-5" />,
    category: 'jewelry',
    badges: ['Estate pieces', 'Vintage focus', 'Designer brands'],
    config: {
      item_type: 'jewelry',
      name: 'Vintage Jewelry Hunter',
      poll_interval: 60,
      listing_format: ['buy_it_now', 'best_offer', 'auction'],
      price_delta_type: 'absolute',
      price_delta_value: 500,
      auction_alert: true,
      jewelry_filters: {
        style: 'Vintage-Inspired',
        condition: 'Pre-owned',
        metal: 'Yellow Gold',
        metal_purity: '14k',
        jewelry_type: ['Ring', 'Brooch', 'Necklace']
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
