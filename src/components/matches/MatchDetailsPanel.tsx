import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Truck,
  RotateCcw,
  ArrowLeft,
  DollarSign,
  CheckCircle,
} from 'lucide-react';

interface MatchDetailsPanelProps {
  matchId: string;
  offers: {
    offer1?: number;
    offer2?: number;
    offer3?: number;
    offer4?: number;
    offer5?: number;
  };
  toggles: {
    purchased_toggle?: boolean;
    arrived_toggle?: boolean;
    return_toggle?: boolean;
    shipped_back_toggle?: boolean;
    refunded_toggle?: boolean;
  };
  onToggleChange: (field: string, value: boolean) => Promise<void>;
  colSpan: number;
}

export const MatchDetailsPanel: React.FC<MatchDetailsPanelProps> = ({
  matchId,
  offers,
  toggles,
  onToggleChange,
  colSpan,
}) => {
  const offerList = [
    offers.offer1,
    offers.offer2,
    offers.offer3,
    offers.offer4,
    offers.offer5,
  ].filter((o) => o !== undefined && o !== null);

  const toggleItems = [
    {
      field: 'purchased_toggle',
      label: 'Purchased',
      icon: <Package className="h-4 w-4" />,
      value: toggles.purchased_toggle,
      color: 'text-green-600',
    },
    {
      field: 'arrived_toggle',
      label: 'Arrived',
      icon: <Truck className="h-4 w-4" />,
      value: toggles.arrived_toggle,
      color: 'text-blue-600',
    },
    {
      field: 'return_toggle',
      label: 'Return Requested',
      icon: <RotateCcw className="h-4 w-4" />,
      value: toggles.return_toggle,
      color: 'text-orange-600',
    },
    {
      field: 'shipped_back_toggle',
      label: 'Shipped Back',
      icon: <ArrowLeft className="h-4 w-4" />,
      value: toggles.shipped_back_toggle,
      color: 'text-purple-600',
    },
    {
      field: 'refunded_toggle',
      label: 'Refunded',
      icon: <DollarSign className="h-4 w-4" />,
      value: toggles.refunded_toggle,
      color: 'text-red-600',
    },
  ];

  return (
    <TableRow className="bg-gray-50 hover:bg-gray-50">
      <TableCell colSpan={colSpan} className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Offer History */}
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Offer History
            </h4>
            {offerList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {offerList.map((offer, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-white"
                  >
                    Offer {index + 1}: ${offer?.toFixed(2)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No offers recorded yet</p>
            )}
          </div>

          {/* Tracking Toggles */}
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Tracking Status
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {toggleItems.map((item) => (
                <div
                  key={item.field}
                  className="flex items-center justify-between space-x-2 bg-white p-2 rounded border"
                >
                  <Label
                    htmlFor={`${matchId}-${item.field}`}
                    className={`flex items-center gap-2 text-sm cursor-pointer ${
                      item.value ? item.color : 'text-gray-500'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Label>
                  <Switch
                    id={`${matchId}-${item.field}`}
                    checked={item.value || false}
                    onCheckedChange={(checked) =>
                      onToggleChange(item.field, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
};
