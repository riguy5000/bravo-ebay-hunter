import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { usePriceHistory } from '@/hooks/usePriceHistory';

const METAL_COLORS: Record<string, string> = {
  XAU: '#FFD700', // Gold
  XAG: '#C0C0C0', // Silver
  XPT: '#E5E4E2', // Platinum
  XPD: '#CED0DD', // Palladium
};

const METAL_STROKE_COLORS: Record<string, string> = {
  XAU: '#B8860B', // Darker gold for line
  XAG: '#808080', // Gray for silver
  XPT: '#71797E', // Steel gray for platinum
  XPD: '#9090A0', // Bluish gray for palladium
};

interface PriceHistoryChartProps {
  defaultDays?: number;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  defaultDays = 30
}) => {
  const [days, setDays] = useState(defaultDays);
  const [priceType, setPriceType] = useState<'oz' | 'gram'>('oz');
  const { history, loading, error, refetch } = usePriceHistory(days);

  const formatPrice = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getChangeInfo = (data: { price: number }[]) => {
    if (data.length < 2) return null;
    const first = data[0].price;
    const last = data[data.length - 1].price;
    const change = last - first;
    const changePercent = ((change / first) * 100);
    return {
      change,
      changePercent,
      isPositive: change >= 0
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Price History...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Price History Error</CardTitle>
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

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            No price history data yet. History will be recorded daily as the app fetches metal prices.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Metal Price History</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <Button
                  key={d}
                  variant={days === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDays(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
            <Button onClick={refetch} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="XAU" className="w-full">
          <TabsList className="mb-4">
            {history.map((metal) => (
              <TabsTrigger key={metal.symbol} value={metal.symbol}>
                {metal.metal}
              </TabsTrigger>
            ))}
          </TabsList>

          {history.map((metal) => {
            const changeInfo = getChangeInfo(metal.data);

            return (
              <TabsContent key={metal.symbol} value={metal.symbol}>
                {/* Price type toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show price per:</span>
                    <div className="flex gap-1">
                      <Button
                        variant={priceType === 'oz' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPriceType('oz')}
                      >
                        Troy Oz
                      </Button>
                      <Button
                        variant={priceType === 'gram' ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPriceType('gram')}
                      >
                        Gram (14k)
                      </Button>
                    </div>
                  </div>

                  {changeInfo && (
                    <Badge
                      variant={changeInfo.isPositive ? "default" : "destructive"}
                      className="flex items-center gap-1"
                    >
                      {changeInfo.isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {changeInfo.isPositive ? '+' : ''}
                      {changeInfo.changePercent.toFixed(2)}% ({days} days)
                    </Badge>
                  )}
                </div>

                {/* Chart */}
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={metal.data}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        stroke="#888"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="#888"
                        tickFormatter={(value) =>
                          priceType === 'oz'
                            ? `$${value.toLocaleString()}`
                            : `$${value.toFixed(2)}`
                        }
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatPrice(value),
                          priceType === 'oz' ? 'Price/oz' : 'Price/g (14k)'
                        ]}
                        labelStyle={{ fontWeight: 'bold' }}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #ccc',
                          borderRadius: '8px',
                          padding: '10px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey={priceType === 'oz' ? 'price' : 'priceGram14k'}
                        stroke={METAL_STROKE_COLORS[metal.symbol] || '#8884d8'}
                        strokeWidth={2}
                        dot={metal.data.length <= 30}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Start</p>
                    <p className="font-semibold">
                      {formatPrice(
                        priceType === 'oz'
                          ? metal.data[0]?.price || 0
                          : metal.data[0]?.priceGram14k || 0
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Current</p>
                    <p className="font-semibold">
                      {formatPrice(
                        priceType === 'oz'
                          ? metal.data[metal.data.length - 1]?.price || 0
                          : metal.data[metal.data.length - 1]?.priceGram14k || 0
                      )}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Change</p>
                    <p className={`font-semibold ${
                      changeInfo?.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {changeInfo
                        ? `${changeInfo.isPositive ? '+' : ''}${formatPrice(
                            priceType === 'oz'
                              ? changeInfo.change
                              : changeInfo.change / 31.1035 * (14/24)
                          )}`
                        : '-'}
                    </p>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
};
