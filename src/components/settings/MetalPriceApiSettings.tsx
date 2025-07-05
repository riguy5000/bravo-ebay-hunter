
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TestTube, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useGoldPrices } from '@/hooks/useGoldPrices';

export const MetalPriceApiSettings = () => {
  const { settings, loading, updateSetting } = useSettings();
  const { prices, loading: pricesLoading, refetch } = useGoldPrices();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  if (loading) {
    return <div>Loading Metal Price API settings...</div>;
  }

  const metalApiSettings = settings.precious_metal_api || {
    provider: 'goldapi',
    api_key: '',
    poll_interval: 300
  };

  const validateApiKey = (apiKey: string) => {
    if (!apiKey) return false;
    if (!apiKey.startsWith('goldapi-')) {
      toast.error('API key should start with "goldapi-"');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const apiKey = formData.get('api_key') as string;
    
    if (!validateApiKey(apiKey)) {
      setSaving(false);
      return;
    }

    const updatedSettings = {
      provider: formData.get('provider') as string,
      api_key: apiKey,
      poll_interval: parseInt(formData.get('poll_interval') as string)
    };

    try {
      await updateSetting('precious_metal_api', updatedSettings);
      toast.success('Metal Price API settings updated successfully!');
    } catch (error) {
      console.error('Error updating metal price API settings:', error);
      toast.error('Failed to update Metal Price API settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!metalApiSettings.api_key || !validateApiKey(metalApiSettings.api_key)) {
      toast.error('Please save a valid API key first');
      return;
    }

    setTesting(true);
    try {
      await refetch();
      if (prices && prices.length > 0) {
        toast.success(`Metal Price API connection successful! Fetched ${prices.length} metals.`);
      } else {
        toast.warning('API connected but no price data received');
      }
    } catch (error) {
      console.error('Error testing metal price API connection:', error);
      toast.error('Failed to connect to Metal Price API');
    } finally {
      setTesting(false);
    }
  };

  const isValidApiKey = metalApiSettings.api_key && metalApiSettings.api_key.startsWith('goldapi-');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Metal Price API Configuration</CardTitle>
          <CardDescription>
            Configure precious metals price data provider and polling settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="provider">API Provider</Label>
              <Select name="provider" defaultValue={metalApiSettings.provider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select API provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goldapi">GoldAPI.io (Recommended)</SelectItem>
                  <SelectItem value="metals-api">Metals-API.com</SelectItem>
                  <SelectItem value="finage">Finage.co.uk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="api_key">API Key</Label>
              <Input
                name="api_key"
                type="password"
                placeholder="goldapi-xxxxxxxxx-io"
                defaultValue={metalApiSettings.api_key}
                required
              />
              {metalApiSettings.api_key && !isValidApiKey && (
                <div className="flex items-center gap-2 mt-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">API key should start with "goldapi-"</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="poll_interval">Poll Interval (seconds)</Label>
              <Input
                name="poll_interval"
                type="number"
                min="60"
                max="3600"
                defaultValue={metalApiSettings.poll_interval}
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                How often to fetch updated price data (minimum 60 seconds)
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={testConnection}
                disabled={testing || pricesLoading || !isValidApiKey}
                className="flex items-center gap-2"
              >
                <TestTube className="h-4 w-4" />
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Connection Status:</span>
              <Badge variant={prices && prices.length > 0 ? "default" : "secondary"}>
                {pricesLoading ? 'Checking...' : (prices && prices.length > 0) ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span>API Key Status:</span>
              <Badge variant={isValidApiKey ? "default" : "secondary"}>
                {isValidApiKey ? 'Valid' : 'Not Set'}
              </Badge>
            </div>
            
            {prices && prices.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Current Prices:</span>
                <div className="grid grid-cols-2 gap-2">
                  {prices.map((price) => (
                    <div key={price.symbol} className="bg-gray-50 p-2 rounded text-sm">
                      <div className="font-medium">{price.metal}</div>
                      <div className="text-lg font-bold">
                        ${typeof price.price === 'number' ? price.price.toFixed(2) : 'N/A'}
                      </div>
                      {price.change && (
                        <div className={`text-xs ${price.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {price.change >= 0 ? '+' : ''}{price.change.toFixed(2)} ({price.changePercent?.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Last updated: {prices[0]?.lastUpdated ? new Date(prices[0].lastUpdated).toLocaleString() : 'Unknown'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Information */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-green-800 mb-2">Metal Price API Information</h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• GoldAPI.io provides real-time precious metals prices</li>
            <li>• Free tier includes 100 requests per month</li>
            <li>• Covers Gold, Silver, Platinum, and Palladium pricing</li>
            <li>• Data updates every few minutes during market hours</li>
            <li>• API key format: goldapi-xxxxxxxxx-io</li>
          </ul>
          <div className="mt-3">
            <a 
              href="https://www.goldapi.io/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <Button variant="outline" size="sm" className="text-green-700 border-green-300">
                <ExternalLink className="h-3 w-3 mr-1" />
                Get API Key from GoldAPI.io
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
