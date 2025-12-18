import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Loader2 } from 'lucide-react';

interface OfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedAmount?: number;
  title: string;
  description: string;
  onSubmit: (amount: number) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export const OfferDialog: React.FC<OfferDialogProps> = ({
  open,
  onOpenChange,
  suggestedAmount,
  title,
  description,
  onSubmit,
  isLoading = false,
  submitLabel = 'Submit Offer',
}) => {
  const [amount, setAmount] = useState<string>('');

  // Pre-fill with suggested amount when dialog opens
  useEffect(() => {
    if (open && suggestedAmount) {
      setAmount(suggestedAmount.toFixed(2));
    } else if (!open) {
      setAmount('');
    }
  }, [open, suggestedAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return;
    }
    await onSubmit(numAmount);
  };

  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {suggestedAmount && (
                <p className="text-xs text-muted-foreground">
                  Suggested offer (87% of melt): ${suggestedAmount.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isValidAmount}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
