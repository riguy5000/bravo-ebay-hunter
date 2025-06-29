
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Matches = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
        <p className="text-gray-600">Review your search results</p>
      </div>

      <Tabs defaultValue="watches" className="w-full">
        <TabsList>
          <TabsTrigger value="watches">Watches</TabsTrigger>
          <TabsTrigger value="jewelry">Jewelry</TabsTrigger>
          <TabsTrigger value="gemstones">Gemstones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="watches">
          <Card>
            <CardHeader>
              <CardTitle>Watch Matches</CardTitle>
              <CardDescription>Found watch listings matching your criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500">No watch matches found yet</div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="jewelry">
          <Card>
            <CardHeader>
              <CardTitle>Jewelry Matches</CardTitle>
              <CardDescription>Found jewelry listings matching your criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500">No jewelry matches found yet</div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="gemstones">
          <Card>
            <CardHeader>
              <CardTitle>Gemstone Matches</CardTitle>
              <CardDescription>Found gemstone listings matching your criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500">No gemstone matches found yet</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Matches;
