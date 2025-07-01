
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { EbayApiKeysList } from './EbayApiKeysList';
import { AddEbayApiKeyForm } from './AddEbayApiKeyForm';
import { EbayKeyRotationSettings } from './EbayKeyRotationSettings';

export const EbayApiKeysManager = () => {
  const { settings, loading } = useSettings();
  const [showAddForm, setShowAddForm] = useState(false);

  if (loading) {
    return <div>Loading eBay API keys...</div>;
  }

  const ebayKeys = settings.ebay_keys?.keys || [];
  const rotationStrategy = settings.ebay_keys?.rotation_strategy || 'round_robin';

  return (
    <div className="space-y-6">
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

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-800 mb-2">How Multiple API Key Sets Work</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Each eBay API key set (App ID + Dev ID + Cert ID) has its own daily rate limit</li>
            <li>• System automatically rotates between available key sets</li>
            <li>• When one set hits rate limit, system switches to next available set</li>
            <li>• Significantly increases your total API capacity</li>
            <li>• Prevents system downtime due to rate limiting</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
