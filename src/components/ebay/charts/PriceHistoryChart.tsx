'use client';

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

interface PriceHistoryDataPoint {
  recorded_at: string;
  lowest_price: number | null;
  median_price: number | null;
  highest_price: number | null;
  average_price: number | null;
  listing_count: number;
}

interface PriceHistoryChartProps {
  data: PriceHistoryDataPoint[];
  height?: number;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format price for display
 */
function formatPrice(price: number | null): string {
  if (price === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Custom tooltip showing all three prices and listing count
 */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[140px]">
        <p className="text-xs font-medium text-gray-700 mb-2 border-b pb-1">{data.date}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Highest
            </span>
            <span className="text-xs font-semibold text-purple-600">{formatPrice(data.highest_price)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Median
            </span>
            <span className="text-xs font-semibold text-blue-600">{formatPrice(data.median_price)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Lowest
            </span>
            <span className="text-xs font-semibold text-green-600">{formatPrice(data.lowest_price)}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t">
          <p className="text-xs text-gray-400 text-center">
            {data.listing_count} listing{data.listing_count !== 1 ? 's' : ''} tracked
          </p>
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Custom legend
 */
function CustomLegend() {
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <span className="w-3 h-0.5 bg-purple-500 rounded"></span>
        Highest
      </span>
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <span className="w-3 h-0.5 bg-blue-500 rounded"></span>
        Median
      </span>
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <span className="w-3 h-0.5 bg-green-500 rounded"></span>
        Lowest
      </span>
    </div>
  );
}

export function PriceHistoryChart({
  data,
  height = 180,
}: PriceHistoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No historical data yet
      </div>
    );
  }

  // Sort by date ascending for proper chart display
  const sortedData = [...data]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map(d => ({
      ...d,
      date: formatDate(d.recorded_at),
    }));

  // Calculate trend based on median
  const firstMedian = sortedData[0]?.median_price;
  const lastMedian = sortedData[sortedData.length - 1]?.median_price;
  const trendPercent = firstMedian && lastMedian
    ? ((lastMedian - firstMedian) / firstMedian * 100).toFixed(1)
    : null;
  const trendUp = trendPercent && parseFloat(trendPercent) > 0;
  const trendDown = trendPercent && parseFloat(trendPercent) < 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Price History</h4>
        {trendPercent && (
          <span className={`text-xs font-medium flex items-center gap-1 ${
            trendUp ? 'text-green-600' : trendDown ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trendUp && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
            {trendDown && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {trendUp ? '+' : ''}{trendPercent}% median
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={sortedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="highest_price"
            name="Highest"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ fill: '#a855f7', strokeWidth: 0, r: 3 }}
            activeDot={{ fill: '#a855f7', strokeWidth: 0, r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="median_price"
            name="Median"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
            activeDot={{ fill: '#3b82f6', strokeWidth: 0, r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="lowest_price"
            name="Lowest"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
            activeDot={{ fill: '#22c55e', strokeWidth: 0, r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <CustomLegend />
      <p className="text-xs text-gray-400 text-center mt-1">
        {sortedData.length} week{sortedData.length !== 1 ? 's' : ''} of data • Tap points for details
      </p>
    </div>
  );
}
