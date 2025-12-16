
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { EbayApiKeysList } from './EbayApiKeysList';
import { AddEbayApiKeyForm } from './AddEbayApiKeyForm';
import { EbayKeyRotationSettings } from './EbayKeyRotationSettings';
import { toast } from 'sonner';

export const EbayApiKeysManager = () => {
  const { settings, loading, updateSetting } = useSettings();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  if (loading) {
    return <div>Loading eBay API keys...</div>;
  }

  const ebayKeys = settings.ebay_keys?.keys || [];
  const rotationStrategy = settings.ebay_keys?.rotation_strategy || 'round_robin';

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleDelete = async (index: number) => {
    const keyToDelete = ebayKeys[index];
    if (!confirm(`Are you sure you want to delete API key set "${keyToDelete.label}"?`)) {
      return;
    }

    try {
      const updatedKeys = ebayKeys.filter((_, i) => i !== index);
      await updateSetting('ebay_keys', {
        keys: updatedKeys,
        rotation_strategy: rotationStrategy
      });
      toast.success(`API key set "${keyToDelete.label}" deleted successfully`);
    } catch (error: any) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key set: ' + error.message);
    }
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingIndex(null);
  };

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
              <EbayApiKeysList keys={ebayKeys} onEdit={handleEdit} onDelete={handleDelete} />
            </div>
          )}
        </CardContent>
      </Card>

      {showAddForm && (
        <AddEbayApiKeyForm
          onClose={handleFormClose}
          onSuccess={handleFormClose}
          editingKey={editingIndex !== null ? ebayKeys[editingIndex] : undefined}
          editingIndex={editingIndex}
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
