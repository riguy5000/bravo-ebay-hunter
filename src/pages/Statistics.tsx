
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Statistics = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Statistics</h1>
        <p className="text-gray-600">View your performance analytics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profit/Loss Summary</CardTitle>
            <CardDescription>Your overall performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">No data available yet</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROI Analysis</CardTitle>
            <CardDescription>Return on investment metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">No data available yet</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
