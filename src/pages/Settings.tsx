
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiConfiguration } from '@/components/settings/ApiConfiguration';
import { UserPreferences } from '@/components/settings/UserPreferences';
import { DataImport } from '@/components/settings/DataImport';

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your eBay CRM</p>
      </div>

      <Tabs defaultValue="api" className="w-full">
        <TabsList>
          <TabsTrigger value="api">API Configuration</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="import">Import Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api">
          <ApiConfiguration />
        </TabsContent>
        
        <TabsContent value="preferences">
          <UserPreferences />
        </TabsContent>
        
        <TabsContent value="import">
          <DataImport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
