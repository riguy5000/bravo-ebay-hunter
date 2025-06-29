
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Target, TrendingUp } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();

  // Redirect authenticated users to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            eBay CRM System
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Internal system for automated eBay deal discovery and profit tracking
          </p>
          <div>
            <Link to="/auth">
              <Button size="lg" className="px-8">
                Login
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Target className="h-12 w-12 text-blue-600 mb-4" />
              <CardTitle>Automated Search Tasks</CardTitle>
              <CardDescription>
                Configure search parameters for watches, jewelry, and gemstones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Set up automated searches with custom filters and price thresholds to monitor eBay listings continuously.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Search className="h-12 w-12 text-green-600 mb-4" />
              <CardTitle>AI Match Analysis</CardTitle>
              <CardDescription>
                AI-powered evaluation of listing opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Automated analysis compares listing prices against market data to identify profitable opportunities.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-purple-600 mb-4" />
              <CardTitle>Transaction Management</CardTitle>
              <CardDescription>
                Complete purchase-to-resale workflow tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Track purchases, returns, and resales with detailed profit/loss calculations and performance metrics.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
