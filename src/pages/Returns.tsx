
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Returns = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Returns</h1>
        <p className="text-gray-600">Manage your return requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Returns Yet</CardTitle>
          <CardDescription>
            Any return requests will be tracked here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">No returns recorded yet</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Returns;
