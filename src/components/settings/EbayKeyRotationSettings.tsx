
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

interface EbayKeyRotationSettingsProps {
  currentStrategy: string;
}

export const EbayKeyRotationSettings: React.FC<EbayKeyRotationSettingsProps> = ({ currentStrategy }) => {
  const { settings, updateSetting } = useSettings();

  const updateRotationStrategy = async (strategy: string) => {
    try {
      const updatedEbayKeys = {
        ...settings.ebay_keys,
        rotation_strategy: strategy
      };
      
      await updateSetting('ebay_keys', updatedEbayKeys);
      toast.success('Rotation strategy updated successfully!');
    } catch (error: any) {
      console.error('Error updating rotation strategy:', error);
      toast.error('Failed to update rotation strategy: ' + error.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Key Rotation Strategy</CardTitle>
        <CardDescription>
          Choose how the system should rotate between your API keys
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="rotation-strategy">Rotation Method</Label>
            <Select value={currentStrategy} onValueChange={updateRotationStrategy}>
              <SelectTrigger>
                <SelectValue placeholder="Select rotation strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round Robin</SelectItem>
                <SelectItem value="least_used">Least Used</SelectItem>
                <SelectItem value="random">Random</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-gray-600 space-y-2">
            <div>
              <strong>Round Robin:</strong> Cycles through keys in order, ensuring equal usage
            </div>
            <div>
              <strong>Least Used:</strong> Always uses the key with the lowest recent usage
            </div>
            <div>
              <strong>Random:</strong> Randomly selects an available key for each request
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
