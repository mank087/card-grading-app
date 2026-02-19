'use client';

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ZAxis } from 'recharts';

interface GradeVsValueChartProps {
  data: Array<{ grade: number; value: number; name: string; cardPath: string }>;
}

function formatCurrency(value: number): string {
  if (value >= 10000) return `$${(value / 1000).toFixed(0)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { grade: number; value: number; name: string } }> }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100 max-w-xs">
      <p className="font-semibold text-gray-900 truncate">{d.name}</p>
      <p className="text-sm text-gray-600">Grade: {d.grade}</p>
      <p className="text-sm text-gray-600">Value: ${d.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
    </div>
  );
};

export default function GradeVsValueChart({ data }: GradeVsValueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data available for grade vs value analysis
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, left: -5, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            type="number"
            dataKey="grade"
            name="Grade"
            domain={[4, 10.5]}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Grade', position: 'insideBottomRight', offset: -5, style: { fontSize: 11, fill: '#9CA3AF' } }}
          />
          <YAxis
            type="number"
            dataKey="value"
            name="Value"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Value', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: 11, fill: '#9CA3AF' } }}
          />
          <ZAxis range={[30, 30]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            data={data}
            fill="#8B5CF6"
            fillOpacity={0.6}
            stroke="#7C3AED"
            strokeWidth={1}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
