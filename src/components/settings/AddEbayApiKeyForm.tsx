
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

interface AddEbayApiKeyFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddEbayApiKeyForm: React.FC<AddEbayApiKeyFormProps> = ({ onClose, onSuccess }) => {
  const { settings, updateSetting } = useSettings();
  const [formData, setFormData] = useState({
    label: '',
    key: '',
    request_interval: 60
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.label.trim() || !formData.key.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    
    try {
      const currentKeys = settings.ebay_keys?.keys || [];
      const existingKey = currentKeys.find(k => k.key === formData.key.trim());
      
      if (existingKey) {
        toast.error('This API key is already configured');
        return;
      }

      const newKey = {
        label: formData.label.trim(),
        key: formData.key.trim(),
        request_interval: formData.request_interval,
        status: 'unknown' as const,
        last_used: null,
        success_rate: null
      };

      const updatedEbayKeys = {
        keys: [...currentKeys, newKey],
        rotation_strategy: settings.ebay_keys?.rotation_strategy || 'round_robin'
      };

      await updateSetting('ebay_keys', updatedEbayKeys);
      
      toast.success(`API key "${formData.label}" added successfully!`);
      onSuccess();
    } catch (error: any) {
      console.error('Error adding API key:', error);
      toast.error('Failed to add API key: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Add New eBay API Key</CardTitle>
            <CardDescription>
              Add another eBay API key to increase your rate limit capacity
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              placeholder="e.g., Primary API Key, Backup Key 1"
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="apiKey">eBay API Key (App ID) *</Label>
            <Input
              id="apiKey"
              placeholder="Your eBay App ID"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="interval">Request Interval (seconds)</Label>
            <Input
              id="interval"
              type="number"
              min="1"
              max="86400"
              value={formData.request_interval}
              onChange={(e) => setFormData(prev => ({ ...prev, request_interval: parseInt(e.target.value) || 60 }))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum time between requests for this key (helps avoid rate limiting)
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add API Key'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
