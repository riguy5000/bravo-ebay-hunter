
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EbayApiSettings } from '@/components/settings/EbayApiSettings';
import { MetalPriceApiSettings } from '@/components/settings/MetalPriceApiSettings';
import { OpenAiApiSettings } from '@/components/settings/OpenAiApiSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { DataImport } from '@/components/settings/DataImport';

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your eBay CRM APIs and preferences</p>
      </div>

      <Tabs defaultValue="ebay" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ebay">eBay API</TabsTrigger>
          <TabsTrigger value="metals">Metal Prices</TabsTrigger>
          <TabsTrigger value="openai">OpenAI</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ebay">
          <EbayApiSettings />
        </TabsContent>
        
        <TabsContent value="metals">
          <MetalPriceApiSettings />
        </TabsContent>
        
        <TabsContent value="openai">
          <OpenAiApiSettings />
        </TabsContent>
        
        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>
        
        <TabsContent value="data">
          <DataImport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
