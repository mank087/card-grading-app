'use client';

/**
 * The One Piece-only half of Card Information.
 *
 * PORTED FROM `src/app/onepiece/[id]/CardDetailClient.tsx`:
 *
 *   3838-3870   Card Name, rendered bilingually
 *   3872-3880   Card Type (Leader / Character / Event / Stage)
 *   3882-3910   Color, one chip per slash-separated colour
 *   3912-3920   Power
 *   3922-3930   Cost (DON!!)
 *   3932-3940   Life
 *   3942-3950   Counter
 *   3952-3960   Attribute (Slash, Strike, Ranged, …)
 *   3962-3970   Sub types / affiliations
 *   3972-3980   Variant type
 *   3982-4000   the set's expansion code, printed under the shared Set row
 *   4011-4020   Rarity
 *   4021-4030   Artist
 *   4031-4046   Finish: the FOIL chip and its `foil_type`
 *   4048-4057   Language, only when it is not English
 *   4058-4067   Card layout (double-faced)
 *   4068-4088   Expansion Code and Promo
 *   4098-4118   Border and Frame
 *   4128-4146   Keywords
 *   4211-4247   the One Piece-only Special Features badges (parallel art,
 *               manga art, parallel manga, SP, alternate art) and 4295-4320
 *               (promo, foil) — exported separately below
 *
 * The rest of legacy's grid — Set, Card Number, Subset, Year, Rarity/variant,
 * Language and the DCM serial — is category-agnostic and is printed by the
 * shared `CardFacts`; the shared badges (subset, serial, rookie, autograph,
 * print finish, Variant, authentic) are `SpecialFeatures`' business.
 *
 * Copied, not improved: the fallbacks, the field order and the conditionals
 * are legacy's. `cardInfo` arrives from `buildCardInfo(card, 'onepiece')`,
 * which carries One Piece's JSON-first precedence and its frame-treatment
 * set-name rule. The emoji legacy prints inside the chips is dropped: V2
 * carries no emoji anywhere.
 *
 * This component is handed to the shell by the One Piece adapter through
 * `CardFacts`'s `categorySlot`. Nothing shared imports it.
 */

import type { ReactNode } from 'react';
import { splitBilingual } from '@/lib/cardDetail/bilingual';
import type { LegacyCardInfo } from '@/lib/cardDetail/cardInfo';

export interface OnePieceCardInfoProps {
  card: any;
  cardInfo: LegacyCardInfo;
}

/** One value, printed in Japanese with its English translation beneath it. */
function BilingualValue({ text }: { text: string | null | undefined }) {
  const parts = splitBilingual(text);
  if (!parts) return <>—</>;
  if (parts.jp && parts.en) {
    return (
      <>
        <span className="font-noto-sans-jp">{parts.jp}</span>
        <span className="cd-caption">{parts.en}</span>
      </>
    );
  }
  return <span className={parts.japanese ? 'font-noto-sans-jp' : undefined}>{parts.full}</span>;
}

/** Legacy 3886: the colour field is slash-separated ("Red/Green"). */
export function SlashChips({ value }: { value: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {value
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part, idx) => (
          <span key={`${part}-${idx}`} className="cd-tag">
            {part}
          </span>
        ))}
    </span>
  );
}

/** Legacy 4014: `parallel_manga` → "Parallel Manga". */
export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function OnePieceCardInfo({ card, cardInfo }: OnePieceCardInfoProps) {
  const c = card ?? {};

  const cardName = cardInfo.card_name || c.card_name;
  const color = cardInfo.op_card_color || c.op_card_color;
  const language = cardInfo.language || c.card_language || c.language;
  const showLanguage = !!language && language !== 'English';
  const keywords: string[] = Array.isArray(cardInfo.keywords)
    ? cardInfo.keywords
    : Array.isArray(c.keywords)
      ? c.keywords
      : [];

  /** Legacy prints 0 for Power/Cost/Life/Counter only when the value is set. */
  const present = (a: any, b: any) => (a !== undefined && a !== null ? a : b);

  const facts: Array<[string, ReactNode]> = [];
  if (cardInfo.op_card_type || c.op_card_type)
    facts.push(['Card type', cardInfo.op_card_type || c.op_card_type]);
  if (color) facts.push(['Color', <SlashChips value={String(color)} />]);
  if (cardInfo.op_card_power || c.op_card_power)
    facts.push(['Power', present(cardInfo.op_card_power, c.op_card_power)]);
  if (cardInfo.op_card_cost || c.op_card_cost)
    facts.push(['Cost (DON!!)', present(cardInfo.op_card_cost, c.op_card_cost)]);
  if (cardInfo.op_life || c.op_life) facts.push(['Life', present(cardInfo.op_life, c.op_life)]);
  if (cardInfo.op_counter || c.op_counter)
    facts.push(['Counter', present(cardInfo.op_counter, c.op_counter)]);
  if (cardInfo.op_attribute || c.op_attribute)
    facts.push(['Attribute', cardInfo.op_attribute || c.op_attribute]);
  if (cardInfo.op_sub_types || c.op_sub_types)
    facts.push(['Affiliations', cardInfo.op_sub_types || c.op_sub_types]);
  if (cardInfo.op_variant_type || c.op_variant_type)
    facts.push(['Variant', titleCase(String(cardInfo.op_variant_type || c.op_variant_type))]);
  if (cardInfo.expansion_code || c.expansion_code)
    facts.push([
      'Set code',
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textTransform: 'uppercase' }}>
        {cardInfo.expansion_code || c.expansion_code}
      </span>,
    ]);
  if (cardInfo.rarity_or_variant || c.rarity_description)
    facts.push(['Rarity', cardInfo.rarity_or_variant || c.rarity_description]);
  if (cardInfo.artist_name || c.artist_name)
    facts.push(['Artist', cardInfo.artist_name || c.artist_name]);
  if (c.is_foil) facts.push(['Finish', c.foil_type ? `Foil (${c.foil_type})` : 'Foil']);
  if (showLanguage) facts.push(['Language', language]);
  if (c.is_double_faced) facts.push(['Card layout', 'Double-faced']);
  if (cardInfo.is_promo || c.is_promo) facts.push(['Promo', 'Yes']);
  if (cardInfo.border_color || c.border_color)
    facts.push([
      'Border',
      <span style={{ textTransform: 'capitalize' }}>{cardInfo.border_color || c.border_color}</span>,
    ]);

  return (
    <>
      <dl className="cd-facts">
        {cardName && (
          <div>
            <dt>Card name</dt>
            <dd>
              <BilingualValue text={cardName} />
            </dd>
          </div>
        )}
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {keywords.length > 0 && (
        <>
          <p className="cd-eyebrow">Keywords</p>
          <ul className="cd-chip-list">
            {keywords.map((keyword, idx) => (
              <li key={`${keyword}-${idx}`}>{keyword}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default OnePieceCardInfo;

/* ── Special features: the One Piece-only badges ──────────────────────────
 *
 * PORTED FROM `src/app/onepiece/[id]/CardDetailClient.tsx` 4211-4247 and
 * 4295-4320, and the section's extra visibility terms from 4159-4163.
 *
 * Rendered inside the shared `SpecialFeatures` panel through the adapter's
 * `renderCategoryBadges` slot, so the shared badges (subset, serial, rookie,
 * autograph, print finish, Variant, authentic) are not repeated here.
 */

function Badge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cd-badge">
      <p className="cd-eyebrow">{label}</p>
      {children}
    </div>
  );
}

/** Legacy 4159-4163: the One Piece flags are reason enough to show the panel. */
export function hasOnePieceFeatures(card: any, cardInfo: LegacyCardInfo): boolean {
  return !!(
    card?.is_foil ||
    cardInfo.op_variant_type ||
    cardInfo.is_parallel ||
    cardInfo.is_manga_art ||
    cardInfo.is_alternate_art ||
    cardInfo.is_sp ||
    cardInfo.is_promo
  );
}

export function OnePieceFeatureBadges({
  card,
  cardInfo,
}: {
  card: any;
  cardInfo: LegacyCardInfo;
}) {
  const c = card ?? {};
  const variant: string = String(cardInfo.op_variant_type ?? '');
  const parallelManga = variant === 'parallel_manga';

  return (
    <>
      {(cardInfo.is_parallel || variant.includes('parallel')) && (
        <Badge label="Variant">Parallel art</Badge>
      )}
      {(cardInfo.is_manga_art || variant.includes('manga')) && !parallelManga && (
        <Badge label="Variant">Manga art</Badge>
      )}
      {parallelManga && <Badge label="Variant">Parallel manga</Badge>}
      {(cardInfo.is_sp || variant === 'sp') && <Badge label="Special">SP card</Badge>}
      {(cardInfo.is_alternate_art || variant === 'alternate_art') && (
        <Badge label="Variant">Alternate art</Badge>
      )}
      {(cardInfo.is_promo || c.is_promo) && <Badge label="Promo">Yes</Badge>}
      {c.is_foil && <Badge label="Foil">{c.foil_type || 'Foil'}</Badge>}
    </>
  );
}
