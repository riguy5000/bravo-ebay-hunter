
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Target, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign,
  Eye,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { MarketPrices } from '@/components/MarketPrices';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';

const Dashboard = () => {
  // Mock data for demonstration
  const stats = {
    activeTasks: 12,
    newMatches: 8,
    pendingOffers: 3,
    totalProfit: 2847.50,
    thisMonthProfit: 1250.30,
    successRate: 68
  };

  const recentMatches = [
    {
      id: '1',
      title: 'Vintage Rolex Submariner 1970s',
      price: 2500,
      aiScore: 85,
      status: 'new' as const,
      endTime: '2024-01-15T18:30:00Z'
    },
    {
      id: '2', 
      title: '18k Gold Diamond Ring Estate Sale',
      price: 450,
      aiScore: 92,
      status: 'reviewed' as const,
      endTime: '2024-01-16T12:15:00Z'
    },
    {
      id: '3',
      title: 'Natural Ruby Gemstone 2.5ct',
      price: 800,
      aiScore: 78,
      status: 'offered' as const,
      endTime: '2024-01-14T20:45:00Z'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Eye className="h-4 w-4" />;
      case 'reviewed': return <CheckCircle className="h-4 w-4" />;
      case 'offered': return <DollarSign className="h-4 w-4" />;
      case 'purchased': return <ShoppingCart className="h-4 w-4" />;
      case 'passed': return <XCircle className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'reviewed': return 'bg-green-100 text-green-800';
      case 'offered': return 'bg-yellow-100 text-yellow-800';
      case 'purchased': return 'bg-purple-100 text-purple-800';
      case 'passed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your eBay CRM activity</p>
      </div>

      {/* Market Prices */}
      <MarketPrices />

      {/* Price History Chart */}
      <PriceHistoryChart />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTasks}</div>
            <p className="text-xs text-muted-foreground">
              Monitoring eBay listings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Matches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newMatches}</div>
            <p className="text-xs text-muted-foreground">
              AI-identified opportunities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Offers</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOffers}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting seller response
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +${stats.thisMonthProfit.toLocaleString()} this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Matches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent AI Matches</CardTitle>
          <CardDescription>Latest profitable opportunities identified by AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentMatches.map((match) => (
              <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium">{match.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>Price: ${match.price.toLocaleString()}</span>
                    <span>AI Score: {match.aiScore}%</span>
                    <span>Ends: {new Date(match.endTime).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`${getStatusColor(match.status)} flex items-center gap-1`}>
                    {getStatusIcon(match.status)}
                    {match.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
