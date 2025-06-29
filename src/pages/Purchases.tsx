
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Purchases = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Purchases</h1>
        <p className="text-gray-600">Track your purchases and costs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Purchases Yet</CardTitle>
          <CardDescription>
            Your purchases will appear here once you start buying matched items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">No purchases recorded yet</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Purchases;
