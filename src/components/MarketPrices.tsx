
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useGoldPrices } from '@/hooks/useGoldPrices';
import { Button } from '@/components/ui/button';

export const MarketPrices = () => {
  const { prices, loading, error, refetch } = useGoldPrices();

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

  const formatChange = (change: number | undefined, isPercent: boolean = false) => {
    if (change === undefined || change === null) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    if (isPercent) {
      return `${sign}${change.toFixed(2)}%`;
    }
    return `${sign}${change.toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Live Market Prices
          <Button onClick={refetch} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {prices.map((price) => {
            const hasChange = price.change !== undefined && price.change !== null && price.change !== 0;
            const isPositive = hasChange && price.change >= 0;

            return (
            <div key={price.symbol} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{price.metal}</h3>
                {hasChange && (
                  <Badge variant={isPositive ? "default" : "destructive"}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold">{formatPrice(price.price, price.currency)}</p>
                  <p className="text-sm text-gray-600">per troy ounce</p>
                </div>

                {hasChange && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className={isPositive ? "text-green-600" : "text-red-600"}>
                      {formatChange(price.change)} ({formatChange(price.changePercent, true)})
                    </span>
                  </div>
                )}

                <div className="text-xs text-gray-500 space-y-1">
                  {price.high > 0 && <div>High: {formatPrice(price.high, price.currency)}</div>}
                  {price.low > 0 && <div>Low: {formatPrice(price.low, price.currency)}</div>}
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
            );
          })}
        </div>
        
        {prices.length > 0 && (
          <p className="text-xs text-gray-500 mt-4">
            Last updated: {new Date(prices[0].lastUpdated).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
