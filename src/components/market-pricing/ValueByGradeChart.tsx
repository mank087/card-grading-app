'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ValueByGradeChartProps {
  data: Array<{ grade: string; totalValue: number; avgValue: number; count: number }>;
}

function formatCurrency(value: number): string {
  if (value >= 10000) return `$${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { grade: string; totalValue: number; avgValue: number; count: number } }> }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100">
      <p className="font-semibold text-gray-900">Grade {d.grade}</p>
      <p className="text-sm text-gray-600">Total: ${d.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      <p className="text-sm text-gray-600">Avg: ${d.avgValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      <p className="text-sm text-gray-500">{d.count} card{d.count !== 1 ? 's' : ''}</p>
    </div>
  );
};

export default function ValueByGradeChart({ data }: ValueByGradeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No grade value data available
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
          <XAxis
            dataKey="grade"
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          <Bar dataKey="totalValue" name="Total Value" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="avgValue" name="Avg Value" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
