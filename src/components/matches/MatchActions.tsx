import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Eye,
  DollarSign,
  ShoppingCart,
  XCircle,
  RotateCcw,
  Package,
  ChevronDown,
} from 'lucide-react';
import { OfferDialog } from './OfferDialog';

export type MatchStatus = 'new' | 'reviewed' | 'offered' | 'purchased' | 'passed';

interface MatchActionsProps {
  matchId: string;
  currentStatus: MatchStatus;
  itemType: string;
  suggestedOffer?: number;
  currentOffers?: {
    offer1?: number;
    offer2?: number;
    offer3?: number;
    offer4?: number;
    offer5?: number;
  };
  onStatusChange: (newStatus: MatchStatus, offerAmount?: number) => Promise<void>;
  onExpandDetails?: () => void;
}

export const MatchActions: React.FC<MatchActionsProps> = ({
  matchId,
  currentStatus,
  itemType,
  suggestedOffer,
  currentOffers,
  onStatusChange,
  onExpandDetails,
}) => {
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusChange = async (newStatus: MatchStatus) => {
    setIsLoading(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfferSubmit = async (amount: number) => {
    setIsLoading(true);
    try {
      await onStatusChange('offered', amount);
      setOfferDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchaseSubmit = async (amount: number) => {
    setIsLoading(true);
    try {
      await onStatusChange('purchased', amount);
      setPurchaseDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine which offer field to use next
  const getNextOfferField = () => {
    if (!currentOffers?.offer1) return 'offer1';
    if (!currentOffers?.offer2) return 'offer2';
    if (!currentOffers?.offer3) return 'offer3';
    if (!currentOffers?.offer4) return 'offer4';
    if (!currentOffers?.offer5) return 'offer5';
    return 'offer5'; // Overwrite last one if all full
  };

  const getOfferCount = () => {
    let count = 0;
    if (currentOffers?.offer1) count++;
    if (currentOffers?.offer2) count++;
    if (currentOffers?.offer3) count++;
    if (currentOffers?.offer4) count++;
    if (currentOffers?.offer5) count++;
    return count;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={isLoading}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* View Details */}
          {onExpandDetails && (
            <DropdownMenuItem onClick={onExpandDetails}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
          )}

          {/* Status-specific actions */}
          {currentStatus === 'new' && (
            <>
              <DropdownMenuItem onClick={() => handleStatusChange('reviewed')}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Mark Reviewed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOfferDialogOpen(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Make Offer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPurchaseDialogOpen(true)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Mark Purchased
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleStatusChange('passed')}
                className="text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Pass
              </DropdownMenuItem>
            </>
          )}

          {currentStatus === 'reviewed' && (
            <>
              <DropdownMenuItem onClick={() => setOfferDialogOpen(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Make Offer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPurchaseDialogOpen(true)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Mark Purchased
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleStatusChange('passed')}
                className="text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Pass
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('new')}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Revert to New
              </DropdownMenuItem>
            </>
          )}

          {currentStatus === 'offered' && (
            <>
              <DropdownMenuItem onClick={() => setOfferDialogOpen(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Add Another Offer ({getOfferCount()}/5)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPurchaseDialogOpen(true)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Mark Purchased
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleStatusChange('passed')}
                className="text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Pass
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('reviewed')}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Revert to Reviewed
              </DropdownMenuItem>
            </>
          )}

          {currentStatus === 'purchased' && (
            <>
              <DropdownMenuItem onClick={() => handleStatusChange('offered')}>
                <Package className="mr-2 h-4 w-4" />
                Revert to Offered
              </DropdownMenuItem>
            </>
          )}

          {currentStatus === 'passed' && (
            <>
              <DropdownMenuItem onClick={() => handleStatusChange('new')}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Revert to New
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Offer Dialog */}
      <OfferDialog
        open={offerDialogOpen}
        onOpenChange={setOfferDialogOpen}
        suggestedAmount={suggestedOffer}
        title="Make an Offer"
        description="Enter the offer amount you submitted on eBay."
        onSubmit={handleOfferSubmit}
        isLoading={isLoading}
      />

      {/* Purchase Dialog */}
      <OfferDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        suggestedAmount={suggestedOffer}
        title="Mark as Purchased"
        description="Enter the final purchase price."
        onSubmit={handlePurchaseSubmit}
        isLoading={isLoading}
        submitLabel="Mark Purchased"
      />
    </>
  );
};
