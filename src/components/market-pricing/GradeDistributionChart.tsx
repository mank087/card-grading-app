'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';

interface GradeDistributionChartProps {
  data: Array<{ grade: string; count: number }>;
}

function getGradeColor(grade: string): string {
  const num = parseFloat(grade);
  if (isNaN(num)) return '#9CA3AF'; // <5
  if (num >= 9.5) return '#16A34A'; // green
  if (num >= 9) return '#22C55E';
  if (num >= 8) return '#3B82F6'; // blue
  if (num >= 7) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { grade: string; count: number } }> }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg px-3 py-2 border border-gray-100">
      <p className="font-semibold text-gray-900">Grade {d.grade}</p>
      <p className="text-sm text-gray-600">{d.count} card{d.count !== 1 ? 's' : ''}</p>
    </div>
  );
};

export default function GradeDistributionChart({ data }: GradeDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No grade data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
          <XAxis
            dataKey="grade"
            tick={{ fontSize: 11, fill: '#6B7280' }}
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
          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
            {data.map((entry) => (
              <Cell key={entry.grade} fill={getGradeColor(entry.grade)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
