
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

interface EbayApiKey {
  label: string;
  app_id: string;
  dev_id: string;
  cert_id: string;
  last_used?: string;
  status?: string;
  success_rate?: number;
}

interface AddEbayApiKeyFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editingKey?: EbayApiKey;
  editingIndex?: number | null;
}

export const AddEbayApiKeyForm: React.FC<AddEbayApiKeyFormProps> = ({ onClose, onSuccess, editingKey, editingIndex }) => {
  const { settings, updateSetting } = useSettings();
  const isEditing = editingKey !== undefined && editingIndex !== null;
  const [formData, setFormData] = useState({
    label: editingKey?.label || '',
    app_id: editingKey?.app_id || '',
    dev_id: editingKey?.dev_id || '',
    cert_id: editingKey?.cert_id || ''
  });
  const [saving, setSaving] = useState(false);

  // Update form data when editingKey changes
  useEffect(() => {
    if (editingKey) {
      setFormData({
        label: editingKey.label || '',
        app_id: editingKey.app_id || '',
        dev_id: editingKey.dev_id || '',
        cert_id: editingKey.cert_id || ''
      });
    }
  }, [editingKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.label.trim() || !formData.app_id.trim() || !formData.dev_id.trim() || !formData.cert_id.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      const currentKeys = settings.ebay_keys?.keys || [];

      // Check for duplicates (but skip the key being edited)
      const existingKey = currentKeys.find((k, idx) => {
        if (isEditing && idx === editingIndex) return false; // Skip the key being edited
        return k.app_id === formData.app_id.trim() ||
               k.dev_id === formData.dev_id.trim() ||
               k.cert_id === formData.cert_id.trim();
      });

      if (existingKey) {
        toast.error('One or more of these credentials are already configured');
        setSaving(false);
        return;
      }

      let updatedKeys;

      if (isEditing && editingIndex !== null) {
        // Update existing key
        updatedKeys = currentKeys.map((key, idx) => {
          if (idx === editingIndex) {
            return {
              ...key,
              label: formData.label.trim(),
              app_id: formData.app_id.trim(),
              dev_id: formData.dev_id.trim(),
              cert_id: formData.cert_id.trim(),
              status: 'unknown' as const // Reset status after edit
            };
          }
          return key;
        });
        toast.success(`API key set "${formData.label}" updated successfully!`);
      } else {
        // Add new key
        const newKey = {
          label: formData.label.trim(),
          app_id: formData.app_id.trim(),
          dev_id: formData.dev_id.trim(),
          cert_id: formData.cert_id.trim(),
          status: 'unknown' as const,
          last_used: null,
          success_rate: null
        };
        updatedKeys = [...currentKeys, newKey];
        toast.success(`API key set "${formData.label}" added successfully!`);
      }

      const updatedEbayKeys = {
        keys: updatedKeys,
        rotation_strategy: settings.ebay_keys?.rotation_strategy || 'round_robin'
      };

      await updateSetting('ebay_keys', updatedEbayKeys);
      onSuccess();
    } catch (error: any) {
      console.error('Error saving API key set:', error);
      toast.error('Failed to save API key set: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{isEditing ? 'Edit eBay API Key Set' : 'Add New eBay API Key Set'}</CardTitle>
            <CardDescription>
              {isEditing
                ? 'Update the credentials for this API key set'
                : 'Add a complete set of eBay API credentials to increase your rate limit capacity'
              }
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
              placeholder="e.g., Primary Keys, Backup Keys 1"
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="appId">eBay App ID (Client ID) *</Label>
            <Input
              id="appId"
              placeholder="Your eBay App ID"
              value={formData.app_id}
              onChange={(e) => setFormData(prev => ({ ...prev, app_id: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="devId">eBay Dev ID (Developer ID) *</Label>
            <Input
              id="devId"
              placeholder="Your eBay Dev ID"
              value={formData.dev_id}
              onChange={(e) => setFormData(prev => ({ ...prev, dev_id: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="certId">eBay Cert ID (Certificate ID) *</Label>
            <Input
              id="certId"
              placeholder="Your eBay Cert ID"
              value={formData.cert_id}
              onChange={(e) => setFormData(prev => ({ ...prev, cert_id: e.target.value }))}
              required
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 font-medium mb-2">Where to find your eBay credentials:</p>
            <p className="text-xs text-blue-700">
              Go to your eBay Developer Dashboard → My Account → Keys & Certificates
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add API Key Set')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
