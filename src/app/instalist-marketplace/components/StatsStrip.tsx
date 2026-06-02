import type { MarketplaceStats } from '../types';

/**
 * Four KPI tiles at the top of the marketplace page.
 * Revenue is GROSS sale price (v1 spec). Phase 4 will add net.
 */
export default function StatsStrip({ stats }: { stats: MarketplaceStats | null }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Tile
        label="Active"
        value={stats?.activeCount ?? 0}
        sub="listings"
        accent="indigo"
      />
      <Tile
        label="Sold"
        value={stats?.soldCount ?? 0}
        sub="lifetime"
        accent="emerald"
      />
      <Tile
        label="Ended"
        value={stats?.endedCount ?? 0}
        sub="unsold"
        accent="amber"
      />
      <Tile
        label="Revenue"
        value={formatCurrency(stats?.grossRevenue ?? 0, stats?.currency ?? 'USD')}
        sub="gross"
        accent="purple"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub: string;
  accent: 'indigo' | 'emerald' | 'amber' | 'purple';
}) {
  const colors: Record<typeof accent, string> = {
    indigo: 'border-indigo-200 bg-indigo-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    purple: 'border-purple-200 bg-purple-50',
  };
  const text: Record<typeof accent, string> = {
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
  };
  return (
    <div className={`rounded-xl border ${colors[accent]} px-5 py-4`}>
      <p className={`text-xs font-bold uppercase tracking-wider ${text[accent]}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
