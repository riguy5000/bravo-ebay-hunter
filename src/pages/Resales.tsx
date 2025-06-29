
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Resales = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Resales</h1>
        <p className="text-gray-600">Track your resale activities and profits</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Resales Yet</CardTitle>
          <CardDescription>
            Track your resale listings and profits here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">No resales recorded yet</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Resales;
