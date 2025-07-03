
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, RefreshCw, Clock, Wifi, WifiOff } from 'lucide-react';
import { useGoldPrices } from '@/hooks/useGoldPrices';
import { Button } from '@/components/ui/button';

export const MarketPrices = () => {
  const { prices, loading, error, apiStatus, lastUpdate, refetch } = useGoldPrices();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Market Prices...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Market Prices Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (change: number, isPercent: boolean = false) => {
    const sign = change >= 0 ? '+' : '';
    if (isPercent) {
      return `${sign}${change.toFixed(2)}%`;
    }
    return `${sign}${change.toFixed(2)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fresh':
      case 'cached':
        return <Wifi className="h-4 w-4 text-green-600" />;
      case 'stale-cache':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'fresh':
        return 'Real-time';
      case 'cached':
        return 'Live Data';
      case 'stale-cache':
        return 'Cached';
      case 'error':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh':
      case 'cached':
        return 'bg-green-100 text-green-800';
      case 'stale-cache':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            Live Market Prices
            <Badge variant="secondary" className={`${getStatusColor(apiStatus)} flex items-center gap-1`}>
              {getStatusIcon(apiStatus)}
              {getStatusText(apiStatus)}
            </Badge>
          </div>
          <Button onClick={refetch} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {prices.map((price) => (
            <div key={price.symbol} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{price.metal}</h3>
                <Badge variant={price.change >= 0 ? "default" : "destructive"}>
                  {price.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold">{formatPrice(price.price, price.currency)}</p>
                  <p className="text-sm text-gray-600">per troy ounce</p>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className={price.change >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatChange(price.change)} ({formatChange(price.changePercent, true)})
                  </span>
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <div>High: {formatPrice(price.high, price.currency)}</div>
                  <div>Low: {formatPrice(price.low, price.currency)}</div>
                </div>
                
                {price.priceGram24k && (
                  <div className="border-t pt-2 text-xs space-y-1">
                    <div>24k: {formatPrice(price.priceGram24k, price.currency)}/g</div>
                    {price.priceGram18k && <div>18k: {formatPrice(price.priceGram18k, price.currency)}/g</div>}
                    {price.priceGram14k && <div>14k: {formatPrice(price.priceGram14k, price.currency)}/g</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {lastUpdate && (
          <p className="text-xs text-gray-500 mt-4">
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
