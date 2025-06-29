
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Target, TrendingUp } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            eBay CRM
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your intelligent assistant for finding profitable deals on eBay
          </p>
          <div className="space-x-4">
            <Link to="/auth">
              <Button size="lg" className="px-8">
                Get Started
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="lg" className="px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <Target className="h-12 w-12 text-blue-600 mb-4" />
              <CardTitle>Smart Search Tasks</CardTitle>
              <CardDescription>
                Create automated search tasks for watches, jewelry, and gemstones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Set up intelligent filters and let our system find profitable deals for you automatically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Search className="h-12 w-12 text-green-600 mb-4" />
              <CardTitle>AI-Powered Matching</CardTitle>
              <CardDescription>
                Advanced AI analyzes listings to find the best opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Our AI evaluates listings against current market prices and identifies hidden gems.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-purple-600 mb-4" />
              <CardTitle>Profit Tracking</CardTitle>
              <CardDescription>
                Track purchases, returns, and resales with detailed analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Complete workflow management from purchase to resale with ROI calculations.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to start finding profitable deals?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join the smart way to trade on eBay with automated searches and AI-powered insights.
          </p>
          <Link to="/auth">
            <Button size="lg" className="px-12">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
