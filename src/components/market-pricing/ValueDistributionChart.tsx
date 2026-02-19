'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';

interface ValueDistributionChartProps {
  data: Array<{ label: string; count: number }>;
}

const BUCKET_COLORS = [
  '#D1D5DB', // $0 - gray
  '#93C5FD', // $0-10
  '#60A5FA', // $10-25
  '#3B82F6', // $25-50
  '#8B5CF6', // $50-100
  '#A855F7', // $100-250
  '#EC4899', // $250-500
  '#EF4444', // $500+
];

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; count: number } }> }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100">
      <p className="font-semibold text-gray-900">{d.label}</p>
      <p className="text-sm text-gray-600">{d.count} card{d.count !== 1 ? 's' : ''}</p>
    </div>
  );
};

export default function ValueDistributionChart({ data }: ValueDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No value data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={BUCKET_COLORS[index % BUCKET_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
