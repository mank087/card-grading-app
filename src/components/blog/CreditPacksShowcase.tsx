'use client';

/**
 * Credit pack cards for blog embeds. Same layout as the Why DCM pricing
 * grid, same numbers as checkout (both read @/lib/creditPackages), so a
 * price change never leaves a post quoting a stale figure.
 */

import Link from 'next/link';
import { pricingTiers, VIP_PACKAGE } from '@/lib/creditPackages';

interface Card {
  name: string;
  price: string;
  credits: string;
  perGrade: string;
  bonus: string;
  popular: boolean;
}

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

export default function CreditPacksShowcase() {
  const cards: Card[] = [
    {
      name: VIP_PACKAGE.name,
      price: money(VIP_PACKAGE.price),
      credits: String(VIP_PACKAGE.credits),
      perGrade: `$${VIP_PACKAGE.perGradeCost.toFixed(2)}`,
      bonus: 'Lowest cost per grade',
      popular: true,
    },
    ...pricingTiers.map(t => ({
      name: t.name,
      price: money(t.price),
      credits: String(t.credits),
      perGrade: `$${t.perGradeCost.toFixed(2)}`,
      bonus: `+${t.bonusCredits} bonus on first purchase`,
      popular: false,
    })),
  ];

  return (
    <span className="not-prose block my-8">
      <span className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(tier => (
          <span
            key={tier.name}
            className={`block bg-white rounded-2xl shadow-lg border-2 p-5 text-center relative ${
              tier.popular ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                Best Value
              </span>
            )}
            <span className="block font-bold text-gray-900 text-lg mb-1">{tier.name}</span>
            <span className="block text-3xl font-bold text-gray-900 mb-1">{tier.price}</span>
            <span className="block text-gray-500 text-sm mb-3">
              {tier.credits} credit{tier.credits !== '1' ? 's' : ''} &middot; {tier.perGrade}/grade
            </span>
            <span className="block text-green-600 text-sm font-medium">{tier.bonus}</span>
          </span>
        ))}
      </span>
      <span className="block text-center mt-5">
        <Link
          href="/credits"
          className="inline-block bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors no-underline"
        >
          See all credit packs
        </Link>
        <span className="block text-gray-500 text-sm mt-3">
          Credits never expire. New accounts start with two free grades.
        </span>
      </span>
    </span>
  );
}
