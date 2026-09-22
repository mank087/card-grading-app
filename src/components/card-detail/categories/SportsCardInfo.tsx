'use client';

/**
 * The sports-only half of Card Information.
 *
 * PORTED FROM `src/app/sports/[id]/CardDetailClient.tsx`:
 *
 *   3839-3841   Manufacturer, with legacy's "Unknown" fallback
 *   3847-3850   Sport/Category, with legacy's "N/A" fallback
 *   3853-3860   Team, shown only when the record carries one
 *   3861-3869   Parallel/Insert, shown only when the record carries one
 *   3877-3890   "Card Back Description" — the quoted card-back prose and its
 *               "— From card back" attribution
 *
 * The rest of legacy's grid — Player/Character (3831-3833), Set Name
 * (3835-3837), Year (3842-3845), Card Number (3846-3848) and Subset/Insert
 * (3870-3876) — is category-agnostic and is printed by the shared `CardFacts`
 * (and, for the player name, by the hero). The relic/parallel BADGES
 * (3892-4085) are `SpecialFeatures`' business and reach it through the sports
 * adapter's `renderCategoryBadges` / `renderCategoryVariantBadge`.
 *
 * Copied, not improved: the fallback strings, the field order and the
 * conditionals are legacy's. `cardInfo` arrives from `buildCardInfo(card,
 * 'sports')`, which carries sports' JSON-first precedence.
 *
 * This component is handed to the shell by the sports adapter through
 * `CardFacts`'s `categorySlot`. Nothing shared imports it.
 */

import type { ReactNode } from 'react';
import type { LegacyCardInfo } from '@/lib/cardDetail/cardInfo';

export interface SportsCardInfoProps {
  cardInfo: LegacyCardInfo;
}

export function SportsCardInfo({ cardInfo }: SportsCardInfoProps) {
  /** Legacy's own fallbacks, field for field. */
  const facts: Array<[string, string | null]> = [
    ['Manufacturer', cardInfo.manufacturer || 'Unknown'],
    ['Sport / category', cardInfo.sport_or_category || 'N/A'],
    // The two the legacy grid omits entirely when the record is silent.
    ...(cardInfo.team ? ([['Team', cardInfo.team]] as Array<[string, string]>) : []),
    ...(cardInfo.parallel_type
      ? ([['Parallel / insert', cardInfo.parallel_type]] as Array<[string, string]>)
      : []),
  ];

  const cardBackText = cardInfo.card_back_text;

  return (
    <>
      <dl className="cd-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {cardBackText && (
        <div className="cd-card-text">
          <div className="cd-panel-heading">
            <h3>Card description</h3>
          </div>
          <p className="cd-finding-prose" style={{ fontStyle: 'italic' }}>
            &ldquo;{cardBackText}&rdquo;
          </p>
          <p className="cd-caption">— From card back</p>
        </div>
      )}
    </>
  );
}

export default SportsCardInfo;

/* ── Special features: the sports-only badges ─────────────────────────────
 *
 * PORTED FROM `src/app/sports/[id]/CardDetailClient.tsx`:
 *   3954-3963   Memorabilia
 *   4022-4085   the eleven relic/parallel flags from the manual edit
 *   3974-4013   the PARALLEL badge and its generic-tier filter
 *   3892        the section's extra visibility terms
 *
 * They are rendered inside the shared `SpecialFeatures` panel through the
 * adapter's `renderCategoryBadges` / `renderCategoryVariantBadge` slots, so
 * the shared badges (subset, serial, rookie, autograph, print finish,
 * authentic) are not duplicated here. The emoji legacy prints inside each
 * badge is dropped: V2's badge grid carries no emoji anywhere.
 */

/** The shared panel's badge shape (`SpecialFeatures.Badge`), repeated locally. */
function Badge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cd-badge">
      <p className="cd-eyebrow">{label}</p>
      {children}
    </div>
  );
}

/** Legacy 3892: the sports flags are reason enough to show the panel. */
export function hasSportsFeatures(cardInfo: LegacyCardInfo): boolean {
  return !!(
    cardInfo.is_refractor ||
    cardInfo.is_numbered ||
    cardInfo.is_patch ||
    cardInfo.is_jersey ||
    cardInfo.is_game_used ||
    cardInfo.is_short_print ||
    cardInfo.is_variation ||
    cardInfo.is_case_hit ||
    cardInfo.first_print_rookie ||
    cardInfo.is_on_card_auto ||
    cardInfo.is_sticker_auto
  );
}

/** The flags, in legacy's order and with legacy's labels. */
const SPORTS_FLAGS: Array<[keyof LegacyCardInfo, string]> = [
  ['first_print_rookie', '1st Bowman'],
  ['is_on_card_auto', 'On-card auto'],
  ['is_sticker_auto', 'Sticker auto'],
  ['is_refractor', 'Refractor / Prizm'],
  ['is_numbered', 'Numbered'],
  ['is_patch', 'Patch card'],
  ['is_jersey', 'Jersey card'],
  ['is_game_used', 'Game used'],
  ['is_short_print', 'Short print'],
  ['is_variation', 'Variation'],
  ['is_case_hit', 'Case hit / 1 of 1'],
];

export function SportsFeatureBadges({
  cardInfo,
  dvgGrading,
}: {
  cardInfo: LegacyCardInfo;
  dvgGrading: any;
}) {
  const memorabilia =
    cardInfo.memorabilia || dvgGrading?.rarity_features?.memorabilia?.present;
  const memorabiliaType = dvgGrading?.rarity_features?.memorabilia?.type || 'Yes';

  return (
    <>
      {memorabilia && <Badge label="Memorabilia">{memorabiliaType}</Badge>}
      {SPORTS_FLAGS.filter(([key]) => cardInfo[key]).map(([key, label]) => (
        <Badge key={String(key)} label={label}>
          Yes
        </Badge>
      ))}
    </>
  );
}

/**
 * Legacy 3974-4013. The PARALLEL name, not the classification tier: the
 * actual colour first, then the insert name, then v3.3's alternative field,
 * and only then `rarity_or_variant` — and that one only when it is not one of
 * the generic tiers the grader also puts in that column.
 */
const GENERIC_VARIANTS = [
  'base', 'base_common', 'common', 'standard', 'regular',
  'insert', 'parallel', 'modern_parallel', 'parallel_variant',
  'sp', 'ssp', 'autographed', 'autograph', 'auto',
  'rookie', 'rc', 'memorabilia', 'relic', 'patch',
];

export function SportsParallelBadge({ cardInfo }: { cardInfo: LegacyCardInfo }) {
  let displayValue: string | null =
    cardInfo.parallel_type || cardInfo.subset || cardInfo.subset_insert_name || null;

  if (!displayValue && cardInfo.rarity_or_variant) {
    const variant = String(cardInfo.rarity_or_variant).toLowerCase();
    if (!GENERIC_VARIANTS.includes(variant)) displayValue = cardInfo.rarity_or_variant;
  }

  if (!displayValue) return null;

  const formatted = String(displayValue)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  return <Badge label="Parallel">{formatted}</Badge>;
}
