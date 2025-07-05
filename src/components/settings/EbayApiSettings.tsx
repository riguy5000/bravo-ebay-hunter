
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useUserSettings } from '@/hooks/useUserSettings';
import { EbayApiKeysList } from './EbayApiKeysList';
import { AddEbayApiKeyForm } from './AddEbayApiKeyForm';
import { EbayKeyRotationSettings } from './EbayKeyRotationSettings';

export const EbayApiSettings = () => {
  const { settings, loading: settingsLoading, updateSetting } = useSettings();
  const { settings: userSettings, loading: userLoading, updateSettings } = useUserSettings();
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  if (settingsLoading || userLoading) {
    return <div>Loading eBay API settings...</div>;
  }

  const ebayKeys = settings.ebay_keys?.keys || [];
  const rotationStrategy = settings.ebay_keys?.rotation_strategy || 'round_robin';

  const handleApiVersionUpdate = async (version: string) => {
    setSaving(true);
    try {
      await updateSettings({ ebay_api_version: version });
      toast.success('eBay API version updated successfully!');
    } catch (error) {
      toast.error('Failed to update eBay API version');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Version Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>eBay API Configuration</CardTitle>
          <CardDescription>
            Configure eBay API version and basic settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ebay-api-version">eBay API Version</Label>
            <Select 
              value={userSettings?.ebay_api_version || 'v1'} 
              onValueChange={handleApiVersionUpdate}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select eBay API version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">Version 1 (Legacy)</SelectItem>
                <SelectItem value="v2">Version 2 (Recommended)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 font-medium mb-2">API Version Notes:</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Version 2 provides better performance and more features</li>
              <li>• Version 1 is maintained for backward compatibility</li>
              <li>• Switching versions may require updating your API key configurations</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Multiple API Keys Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>eBay API Keys Management</CardTitle>
              <CardDescription>
                Manage multiple eBay API key sets to avoid rate limiting and increase API capacity
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add API Key Set
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ebayKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No eBay API key sets configured yet.</p>
              <p className="text-sm">Add your first API key set to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <EbayKeyRotationSettings 
                currentStrategy={rotationStrategy}
              />
              <EbayApiKeysList keys={ebayKeys} />
            </div>
          )}
        </CardContent>
      </Card>

      {showAddForm && (
        <AddEbayApiKeyForm 
          onClose={() => setShowAddForm(false)}
          onSuccess={() => setShowAddForm(false)}
        />
      )}

      {/* API Information */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-800 mb-2">eBay API Setup Guide</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Create an eBay Developer account at developer.ebay.com</li>
            <li>• Generate App ID, Dev ID, and Cert ID for your application</li>
            <li>• Each API key set has its own daily rate limit (5,000 calls/day typically)</li>
            <li>• Multiple key sets allow you to exceed single-key limitations</li>
            <li>• System automatically rotates between available key sets</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
