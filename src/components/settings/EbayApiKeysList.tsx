
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TestTube, Edit, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EbayApiKey {
  label: string;
  app_id: string;
  dev_id: string;
  cert_id: string;
  last_used?: string;
  status?: 'active' | 'rate_limited' | 'error' | 'unknown';
  success_rate?: number;
}

interface EbayApiKeysListProps {
  keys: EbayApiKey[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

export const EbayApiKeysList: React.FC<EbayApiKeysListProps> = ({ keys, onEdit, onDelete }) => {
  const [testingKeys, setTestingKeys] = useState<Set<string>>(new Set());

  const testApiKey = async (apiKey: EbayApiKey) => {
    setTestingKeys(prev => new Set([...prev, apiKey.app_id]));
    
    try {
      const { data, error } = await supabase.functions.invoke('ebay-search', {
        body: {
          keywords: 'test jewelry',
          maxPrice: 50,
          minFeedback: 0,
          testKey: {
            app_id: apiKey.app_id,
            dev_id: apiKey.dev_id,
            cert_id: apiKey.cert_id
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`API Key Set "${apiKey.label}" is working! Found ${data.items?.length || 0} items.`);
      } else if (data.rateLimited) {
        toast.warning(`API Key Set "${apiKey.label}" is rate limited. Try again later.`);
      } else {
        toast.error(`API Key Set "${apiKey.label}" test failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error('API key test error:', error);
      toast.error(`Failed to test API key set "${apiKey.label}": ${error.message}`);
    } finally {
      setTestingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(apiKey.app_id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'rate_limited':
        return <Badge className="bg-orange-100 text-orange-800"><AlertCircle className="h-3 w-3 mr-1" />Rate Limited</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const maskCredential = (credential: string) => {
    if (credential.length <= 8) return credential;
    return credential.substring(0, 4) + '••••••••' + credential.substring(credential.length - 4);
  };

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Configured API Key Sets ({keys.length})</h3>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>App ID</TableHead>
            <TableHead>Dev ID</TableHead>
            <TableHead>Cert ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Success Rate</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((apiKey, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{apiKey.label}</TableCell>
              <TableCell className="font-mono text-sm">{maskCredential(apiKey.app_id)}</TableCell>
              <TableCell className="font-mono text-sm">{maskCredential(apiKey.dev_id)}</TableCell>
              <TableCell className="font-mono text-sm">{maskCredential(apiKey.cert_id)}</TableCell>
              <TableCell>{getStatusBadge(apiKey.status)}</TableCell>
              <TableCell>
                {apiKey.success_rate !== undefined 
                  ? `${Math.round(apiKey.success_rate)}%` 
                  : 'N/A'
                }
              </TableCell>
              <TableCell>
                {apiKey.last_used 
                  ? new Date(apiKey.last_used).toLocaleString()
                  : 'Never'
                }
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testApiKey(apiKey)}
                    disabled={testingKeys.has(apiKey.app_id)}
                  >
                    <TestTube className="h-4 w-4" />
                    {testingKeys.has(apiKey.app_id) ? 'Testing...' : 'Test'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(index)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
