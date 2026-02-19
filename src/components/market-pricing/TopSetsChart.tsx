'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';

interface TopSetsChartProps {
  data: Array<{ set: string; category: string; value: number; count: number }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Pokemon': '#EF4444',
  'Football': '#3B82F6',
  'Baseball': '#10B981',
  'Basketball': '#F97316',
  'Hockey': '#06B6D4',
  'Soccer': '#22C55E',
  'Wrestling': '#A855F7',
  'MTG': '#8B5CF6',
  'Lorcana': '#6366F1',
  'One Piece': '#E11D48',
  'Other': '#6B7280',
};

function formatCurrency(value: number): string {
  if (value >= 10000) return `$${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function truncateLabel(label: string, maxLen: number = 18): string {
  return label.length > maxLen ? label.substring(0, maxLen - 1) + '...' : label;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { set: string; category: string; value: number; count: number } }> }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100">
      <p className="font-semibold text-gray-900">{d.set}</p>
      <p className="text-sm text-gray-600">${d.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      <p className="text-sm text-gray-500">{d.count} card{d.count !== 1 ? 's' : ''} &middot; {d.category}</p>
    </div>
  );
};

export default function TopSetsChart({ data }: TopSetsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No set data available
      </div>
    );
  }

  const chartData = data.map(d => ({ ...d, displaySet: truncateLabel(d.set) }));
  const chartHeight = Math.max(240, data.length * 36);

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
          <XAxis
            type="number"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="displaySet"
            width={120}
            tick={{ fontSize: 11, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
            {chartData.map((entry) => (
              <Cell
                key={entry.set}
                fill={CATEGORY_COLORS[entry.category] || '#6B7280'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
