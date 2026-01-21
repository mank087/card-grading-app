'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface PriceDistributionChartProps {
  prices: number[];
  lowestPrice?: number;
  medianPrice?: number;
  highestPrice?: number;
  listingCount: number;
  height?: number;
  onPriceRangeSelect?: (range: 'lowest' | 'median' | 'highest' | 'all') => void;
  selectedRange?: 'lowest' | 'median' | 'highest' | 'all';
}

/**
 * Format price for display
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Create histogram bucket data from prices
 */
function createHistogramData(
  prices: number[],
  lowest: number,
  highest: number,
  lowerThird: number,
  upperThird: number
) {
  if (prices.length === 0) return [];

  const range = highest - lowest;

  // Determine appropriate bucket size based on price range
  let bucketSize: number;
  if (range <= 20) {
    bucketSize = 2;
  } else if (range <= 50) {
    bucketSize = 5;
  } else if (range <= 100) {
    bucketSize = 10;
  } else if (range <= 500) {
    bucketSize = 25;
  } else if (range <= 1000) {
    bucketSize = 50;
  } else {
    bucketSize = 100;
  }

  // Calculate bucket boundaries
  const bucketStart = Math.floor(lowest / bucketSize) * bucketSize;
  const bucketEnd = Math.ceil(highest / bucketSize) * bucketSize;
  const numBuckets = Math.ceil((bucketEnd - bucketStart) / bucketSize);

  // Limit to reasonable number of buckets (max 12)
  const maxBuckets = 12;
  if (numBuckets > maxBuckets) {
    bucketSize = Math.ceil((bucketEnd - bucketStart) / maxBuckets);
  }

  // Create buckets
  const buckets: {
    range: string;
    rangeStart: number;
    rangeEnd: number;
    count: number;
    priceCategory: 'low' | 'mid' | 'high';
  }[] = [];

  let currentStart = bucketStart;
  while (currentStart < bucketEnd) {
    const currentEnd = currentStart + bucketSize;
    const midpoint = (currentStart + currentEnd) / 2;

    // Determine which price category this bucket falls into
    let priceCategory: 'low' | 'mid' | 'high';
    if (midpoint <= lowerThird) {
      priceCategory = 'low';
    } else if (midpoint <= upperThird) {
      priceCategory = 'mid';
    } else {
      priceCategory = 'high';
    }

    buckets.push({
      range: `$${currentStart}-${currentEnd}`,
      rangeStart: currentStart,
      rangeEnd: currentEnd,
      count: 0,
      priceCategory,
    });
    currentStart = currentEnd;
  }

  // Count prices in each bucket
  prices.forEach(price => {
    const bucketIndex = buckets.findIndex(
      b => price >= b.rangeStart && price < b.rangeEnd
    );
    if (bucketIndex !== -1) {
      buckets[bucketIndex].count++;
    } else if (price === highest) {
      // Handle edge case where price equals the highest bucket end
      buckets[buckets.length - 1].count++;
    }
  });

  return buckets;
}

/**
 * Custom tooltip for histogram bars
 */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const categoryColors = {
      low: 'text-green-600',
      mid: 'text-blue-600',
      high: 'text-purple-600',
    };
    const categoryLabels = {
      low: 'Low Price Range',
      mid: 'Mid Price Range',
      high: 'High Price Range',
    };

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2">
        <p className="text-sm font-semibold text-gray-800">{data.range}</p>
        <p className={`text-xs ${categoryColors[data.priceCategory as keyof typeof categoryColors]}`}>
          {categoryLabels[data.priceCategory as keyof typeof categoryLabels]}
        </p>
        <p className="text-sm font-bold mt-1">
          {data.count} listing{data.count !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
}

export function PriceDistributionChart({
  prices,
  lowestPrice,
  medianPrice,
  highestPrice,
  listingCount,
  height = 140,
  onPriceRangeSelect,
  selectedRange = 'all',
}: PriceDistributionChartProps) {
  if (prices.length === 0 || !lowestPrice || !medianPrice || !highestPrice) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        No price data available
      </div>
    );
  }

  // Calculate price range boundaries for filtering
  const priceRange = highestPrice - lowestPrice;
  const lowerThird = lowestPrice + (priceRange / 3);
  const upperThird = lowestPrice + (2 * priceRange / 3);

  const data = createHistogramData(prices, lowestPrice, highestPrice, lowerThird, upperThird);

  // Count listings in each range
  const lowCount = prices.filter(p => p <= lowerThird).length;
  const midCount = prices.filter(p => p > lowerThird && p <= upperThird).length;
  const highCount = prices.filter(p => p > upperThird).length;

  // Colors for each category
  const categoryColors = {
    low: '#22c55e',    // green-500
    mid: '#3b82f6',    // blue-500
    high: '#a855f7',   // purple-500
  };

  // Dimmed colors when another range is selected
  const dimmedColor = '#e5e7eb'; // gray-200

  const getBarColor = (category: 'low' | 'mid' | 'high') => {
    if (selectedRange === 'all') {
      return categoryColors[category];
    }
    if (
      (selectedRange === 'lowest' && category === 'low') ||
      (selectedRange === 'median' && category === 'mid') ||
      (selectedRange === 'highest' && category === 'high')
    ) {
      return categoryColors[category];
    }
    return dimmedColor;
  };

  // Find max count for Y-axis domain
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">Price Distribution</h4>
        <span className="text-xs text-gray-500">{listingCount} listings</span>
      </div>

      {/* Interactive Price Range Buttons */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <button
          onClick={() => onPriceRangeSelect?.('all')}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedRange === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({listingCount})
        </button>
        <button
          onClick={() => onPriceRangeSelect?.('lowest')}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedRange === 'lowest'
              ? 'bg-green-600 text-white'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          Low ({lowCount})
        </button>
        <button
          onClick={() => onPriceRangeSelect?.('median')}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedRange === 'median'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          Mid ({midCount})
        </button>
        <button
          onClick={() => onPriceRangeSelect?.('highest')}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedRange === 'highest'
              ? 'bg-purple-600 text-white'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          High ({highCount})
        </button>
      </div>

      {/* Histogram Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxCount + 1]}
              allowDecimals={false}
              label={{
                value: 'Listings',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 10, fill: '#9ca3af' }
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.priceCategory)}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Price Labels */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="text-center">
          <p className="text-xs text-gray-500">Lowest</p>
          <p className="text-sm font-semibold text-green-600">{formatPrice(lowestPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Median</p>
          <p className="text-sm font-semibold text-blue-600">{formatPrice(medianPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Highest</p>
          <p className="text-sm font-semibold text-purple-600">{formatPrice(highestPrice)}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-2">
        Tap price ranges above to filter listings
      </p>
    </div>
  );
}
