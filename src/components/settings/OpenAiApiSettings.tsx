
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { TestTube, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useUserSettings } from '@/hooks/useUserSettings';

export const OpenAiApiSettings = () => {
  const { settings, loading: settingsLoading, updateSetting } = useSettings();
  const { settings: userSettings, loading: userLoading, updateSettings } = useUserSettings();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  if (settingsLoading || userLoading) {
    return <div>Loading OpenAI API settings...</div>;
  }

  const llmConfig = settings.llm_config || {
    provider: 'openai',
    model: 'gpt-4.1-2025-04-14',
    temperature: 0.7,
    max_tokens: 2000,
    api_key: '',
    endpoint_url: ''
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const llmUpdates = {
      provider: formData.get('provider') as string,
      model: formData.get('model') as string,
      temperature: parseFloat(formData.get('temperature') as string),
      max_tokens: parseInt(formData.get('max_tokens') as string),
      api_key: formData.get('api_key') as string,
      endpoint_url: formData.get('endpoint_url') as string
    };

    const userUpdates = {
      openai_model: formData.get('model') as string
    };

    try {
      await Promise.all([
        updateSetting('llm_config', llmUpdates),
        updateSettings(userUpdates)
      ]);
      toast.success('OpenAI settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update OpenAI settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      // Simple test to verify API key works
      const response = await fetch('/api/test-openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test connection' })
      });

      if (response.ok) {
        toast.success('OpenAI API connection successful!');
      } else {
        toast.error('OpenAI API connection failed');
      }
    } catch (error) {
      toast.error('Failed to test OpenAI connection');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OpenAI API Configuration</CardTitle>
          <CardDescription>
            Configure OpenAI models and parameters for AI analysis features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">AI Provider</Label>
                <Select name="provider" defaultValue={llmConfig.provider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="custom">Custom Endpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="model">AI Model</Label>
                <Select name="model" defaultValue={llmConfig.model}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (Recommended)</SelectItem>
                    <SelectItem value="o3-2025-04-16">O3 (Reasoning)</SelectItem>
                    <SelectItem value="o4-mini-2025-04-16">O4 Mini (Fast)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Legacy)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (Legacy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="api_key">API Key</Label>
              <Input
                name="api_key"
                type="password"
                placeholder="Enter your OpenAI API key"
                defaultValue={llmConfig.api_key}
                required
              />
            </div>

            <div>
              <Label htmlFor="endpoint_url">Custom Endpoint URL (Optional)</Label>
              <Input
                name="endpoint_url"
                type="url"
                placeholder="https://api.openai.com/v1"
                defaultValue={llmConfig.endpoint_url}
              />
              <p className="text-sm text-gray-500 mt-1">
                Leave empty to use default OpenAI endpoint
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="temperature">Temperature: {llmConfig.temperature}</Label>
                <Slider
                  name="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  defaultValue={[llmConfig.temperature]}
                  className="mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Controls randomness (0 = focused, 2 = creative)
                </p>
              </div>

              <div>
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input
                  name="max_tokens"
                  type="number"
                  min="100"
                  max="8000"
                  defaultValue={llmConfig.max_tokens}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Maximum response length
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={testConnection}
                disabled={testing}
                className="flex items-center gap-2"
              >
                <TestTube className="h-4 w-4" />
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Model Information */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-purple-800 mb-2">OpenAI Model Guide</h4>
          <div className="space-y-2 text-sm text-purple-700">
            <div><strong>GPT-4.1:</strong> Latest flagship model with superior performance</div>
            <div><strong>O3:</strong> Advanced reasoning model for complex analysis</div>
            <div><strong>O4 Mini:</strong> Fast and efficient for quick responses</div>
            <div><strong>GPT-4o:</strong> Legacy model with vision capabilities</div>
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" className="text-purple-700 border-purple-300">
              <ExternalLink className="h-3 w-3 mr-1" />
              Get API Key from OpenAI
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
