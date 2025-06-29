
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useUserSettings } from '@/hooks/useUserSettings';

export const ApiConfiguration = () => {
  const { settings, loading, updateSettings } = useUserSettings();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const updates = {
      ebay_api_version: formData.get('ebay_api_version') as string,
      gold_api_version: formData.get('gold_api_version') as string,
      openai_model: formData.get('openai_model') as string,
      default_poll_interval: parseInt(formData.get('default_poll_interval') as string),
      default_max_price: parseFloat(formData.get('default_max_price') as string),
    };

    try {
      await updateSettings(updates);
      toast.success('API configuration updated successfully!');
    } catch (error) {
      toast.error('Failed to update API configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Configuration</CardTitle>
        <CardDescription>Configure your API keys and versions</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ebay_api_version">eBay API Version</Label>
              <Select name="ebay_api_version" defaultValue={settings?.ebay_api_version || 'v1'}>
                <SelectTrigger>
                  <SelectValue placeholder="Select eBay API version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">Version 1</SelectItem>
                  <SelectItem value="v2">Version 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gold_api_version">Gold Price API Version</Label>
              <Select name="gold_api_version" defaultValue={settings?.gold_api_version || 'v1'}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Gold API version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">Version 1</SelectItem>
                  <SelectItem value="v2">Version 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai_model">OpenAI Model</Label>
              <Select name="openai_model" defaultValue={settings?.openai_model || 'gpt-4'}>
                <SelectTrigger>
                  <SelectValue placeholder="Select OpenAI model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_poll_interval">Default Poll Interval (seconds)</Label>
              <Input
                type="number"
                name="default_poll_interval"
                defaultValue={settings?.default_poll_interval || 300}
                min="60"
                max="3600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_max_price">Default Max Price ($)</Label>
              <Input
                type="number"
                name="default_max_price"
                step="0.01"
                defaultValue={settings?.default_max_price || 1000}
                min="0"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">API Keys Required</h4>
          <p className="text-sm text-yellow-700 mb-2">
            To use the full functionality of this CRM, you'll need to configure the following API keys:
          </p>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• eBay API Key (for listing searches)</li>
            <li>• Gold Price API Key (for market prices)</li>
            <li>• OpenAI API Key (for AI analysis)</li>
          </ul>
          <p className="text-sm text-yellow-700 mt-2">
            API keys will be securely stored and managed through Supabase Edge Functions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
