'use client';

import { NOT_STANDARD_CARD_LABEL, isNonStandardItemType, nonStandardExplanation } from '@/lib/identification/itemType';

/**
 * Owner policy (Sept 17 2026): an item that is not a standard trading card is
 * graded, carries this label, and shows no market price. Shown to everyone,
 * owner and public alike: the label is part of what the grade means.
 * Renders nothing for a standard card (item_type null, absent or 'trading_card').
 */
export default function NotStandardCardNotice({ card, className = '' }: { card: { item_type?: string | null } | null | undefined; className?: string }) {
  const itemType = card?.item_type;
  if (!isNonStandardItemType(itemType)) return null;
  return (
    <div className={`rounded-xl border-2 border-slate-300 bg-slate-50 p-4 ${className}`} role="note">
      <p className="text-sm font-bold text-slate-900">{NOT_STANDARD_CARD_LABEL}</p>
      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{nonStandardExplanation(itemType)}</p>
    </div>
  );
}

/** Compact tag for lists and tiles. */
export function NotStandardCardTag({ card }: { card: { item_type?: string | null } | null | undefined }) {
  if (!isNonStandardItemType(card?.item_type)) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300" title={nonStandardExplanation(card?.item_type) || undefined}>
      Not a standard card
    </span>
  );
}
