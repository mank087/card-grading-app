'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';

interface PortfolioHistoryChartProps {
  data: Array<{ date: string; totalValue: number }>;
}

function formatCurrency(value: number): string {
  if (value >= 10000) return `$${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.[0] || !label) return null;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100">
      <p className="text-xs text-gray-500">{formatDate(label)}</p>
      <p className="font-semibold text-gray-900">
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
};

export default function PortfolioHistoryChart({ data }: PortfolioHistoryChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        {data && data.length === 1
          ? 'Need at least two snapshots to show trends. Check back next week!'
          : 'No historical data yet. Portfolio history builds automatically with weekly price snapshots.'}
      </div>
    );
  }

  // Calculate change
  const firstValue = data[0].totalValue;
  const lastValue = data[data.length - 1].totalValue;
  const change = lastValue - firstValue;
  const changePercent = firstValue > 0 ? ((change / firstValue) * 100) : 0;
  const isUp = change >= 0;

  return (
    <div>
      {/* Change summary */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-sm font-bold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
          {isUp ? '+' : ''}{changePercent.toFixed(1)}%
        </span>
        <span className="text-sm text-gray-500">
          ({isUp ? '+' : ''}${change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          since {formatDate(data[0].date)}
        </span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isUp ? '#8B5CF6' : '#EF4444'} stopOpacity={0.2} />
                <stop offset="95%" stopColor={isUp ? '#8B5CF6' : '#EF4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="totalValue"
              stroke={isUp ? '#8B5CF6' : '#EF4444'}
              strokeWidth={2}
              fill="url(#portfolioGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
