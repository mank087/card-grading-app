'use client';

/**
 * Horizontal price-by-grade bar chart for the public org card page.
 * Split out so Recharts loads lazily (next/dynamic) instead of shipping in
 * the initial bundle of an SEO-facing page. The store's own grade bar takes
 * the brand color; mail-away grades stay emerald, raw stays amber — the same
 * encoding the consumer chart uses.
 */

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartRow {
  grade: string;
  price: number;
  label: string;
  /** This card's own grade — drawn in the grading brand's color. */
  isSelf?: boolean;
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function PriceByGradeChart({ data, brand }: { data: ChartRow[]; brand: string }) {
  if (!data || data.length === 0) return null;

  // Labels carry the grading brand's name ("Apex 9"), which can be wider than
  // the old fixed 70px axis — size it to the longest label so nothing clips.
  const longest = data.reduce((max, row) => Math.max(max, row.label.length), 0);
  const axisWidth = Math.min(140, Math.max(70, longest * 6.5 + 10));

  return (
    <div style={{ height: Math.max(180, data.length * 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value: number) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: '#374151' }}
            tickLine={false}
            axisLine={false}
            width={axisWidth}
          />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as ChartRow;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                  <p className="font-semibold text-gray-800">{row.label}</p>
                  <p className="text-gray-600">{usd(row.price)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="price" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isSelf ? brand : entry.grade === 'Raw' ? '#f59e0b' : '#10b981'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
