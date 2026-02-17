'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface CategoryData {
  category: string;
  count: number;
  value: number;
  percentage: number;
}

interface CategoryBreakdownChartProps {
  data: CategoryData[];
}

// Categories come from DB as: Pokemon, MTG, Lorcana, One Piece, Other,
// or sport names: Football, Baseball, Basketball, Hockey, Soccer, Wrestling
const CATEGORY_COLORS: Record<string, string> = {
  'Pokemon': '#EF4444',
  'Football': '#3B82F6',
  'Baseball': '#10B981',
  'Basketball': '#F97316',
  'Hockey': '#06B6D4',
  'Soccer': '#22C55E',
  'Wrestling': '#A855F7',
  'Sports': '#3B82F6',
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

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryData }> }) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100">
      <p className="font-semibold text-gray-900">{data.category}</p>
      <p className="text-sm text-gray-600">{data.count} cards &middot; ${data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <p className="text-sm text-gray-500">{data.percentage}% of portfolio</p>
    </div>
  );
};

export default function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No category data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as any}
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
            dataKey="category"
            width={80}
            tick={{ fontSize: 12, fill: '#374151' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry) => (
              <Cell
                key={entry.category}
                fill={CATEGORY_COLORS[entry.category] || '#6B7280'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
