'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PriceSourceChartProps {
  data: Array<{ source: string; count: number }>;
}

const SOURCE_COLORS: Record<string, string> = {
  'PriceCharting': '#8B5CF6',
  'eBay': '#3B82F6',
  'Scryfall': '#F59E0B',
  'Unpriced': '#D1D5DB',
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { source: string; count: number }; value: number }> }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100">
      <p className="font-semibold text-gray-900">{d.source}</p>
      <p className="text-sm text-gray-600">{d.count} card{d.count !== 1 ? 's' : ''}</p>
    </div>
  );
};

export default function PriceSourceChart({ data }: PriceSourceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No pricing data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="h-64 flex items-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="count"
            nameKey="source"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || '#6B7280'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string, entry: any) => {
              const item = data.find(d => d.source === value);
              const pct = item ? Math.round((item.count / total) * 100) : 0;
              return <span className="text-xs text-gray-600">{value} ({pct}%)</span>;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
