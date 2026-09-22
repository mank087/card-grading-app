'use client';

/**
 * The Yu-Gi-Oh-only half of Card Information.
 *
 * PORTED FROM `src/app/yugioh/[id]/CardDetailClient.tsx`:
 *
 *   3876-3908   Card Name, rendered bilingually
 *   3910-3918   Card Type
 *   3920-3948   Attribute, one chip per slash-separated value
 *   3950-3958   ATK
 *   3960-3968   DEF
 *   3970-3978   Level / Rank
 *   3980-3987   Pendulum scale
 *   3989-3998   Type / race
 *   4000-4008   Archetype
 *   4010-4018   Frame type
 *   4020-4038   the set's expansion code, printed under the shared Set row
 *   4049-4058   Rarity
 *   4059-4068   Artist
 *   4069-4084   Finish: the FOIL chip and its `foil_type`
 *   4086-4095   Language, only when it is not English
 *   4096-4105   Card layout (double-faced)
 *   4106-4126   Expansion Code and Promo
 *   4136-4156   Border and Frame
 *   4166-4184   Keywords
 *   4211-4251   the Yu-Gi-Oh-only Special Features badges — exported below
 *
 * The rest of legacy's grid is category-agnostic and is printed by the shared
 * `CardFacts`; the shared badges are `SpecialFeatures`' business.
 *
 * THE LABELS ARE THE ONE THING NOT COPIED, and the reason is in the legacy
 * file. `src/app/yugioh/[id]/CardDetailClient.tsx` is a copy of the One Piece
 * client — its own header comment still reads "🏴‍☠️ ONE PIECE CARD INFO" —
 * and the LABELS were never changed with the fields. The frozen page prints
 * ATK under "Power", DEF under "Cost (DON!!)", Level under "Life" and
 * Pendulum scale under "Counter" on every Yu-Gi-Oh card. Reproducing that
 * would be shipping a known-wrong label into the new page, so V2 prints the
 * Yu-Gi-Oh names. The SOURCES, the fallbacks and the conditionals are
 * legacy's, unchanged — only the four words differ. Recorded in the parity
 * doc; the frozen page is not touched.
 *
 * This component is handed to the shell by the Yu-Gi-Oh adapter through
 * `CardFacts`'s `categorySlot`. Nothing shared imports it.
 */

import type { ReactNode } from 'react';
import { splitBilingual } from '@/lib/cardDetail/bilingual';
import { SlashChips, titleCase } from './OnePieceCardInfo';
import type { LegacyCardInfo } from '@/lib/cardDetail/cardInfo';

export interface YugiohCardInfoProps {
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

export function YugiohCardInfo({ card, cardInfo }: YugiohCardInfoProps) {
  const c = card ?? {};

  const cardName = cardInfo.card_name || c.card_name;
  const attribute = cardInfo.ygo_attribute || c.ygo_attribute;
  const language = cardInfo.language || c.card_language || c.language;
  const showLanguage = !!language && language !== 'English';
  const keywords: string[] = Array.isArray(cardInfo.keywords)
    ? cardInfo.keywords
    : Array.isArray(c.keywords)
      ? c.keywords
      : [];

  /** Legacy tests DEF / level / scale for `!== undefined && !== null`, so a 0
   *  prints; ATK uses a truthy test, so a 0 ATK does not. Both kept. */
  const nn = (a: any, b: any) =>
    a !== undefined && a !== null ? a : b !== undefined && b !== null ? b : null;

  const facts: Array<[string, ReactNode]> = [];
  if (cardInfo.ygo_card_type || c.ygo_card_type)
    facts.push(['Card type', cardInfo.ygo_card_type || c.ygo_card_type]);
  if (attribute) facts.push(['Attribute', <SlashChips value={String(attribute)} />]);
  if (cardInfo.ygo_atk || c.ygo_atk) facts.push(['ATK', nn(cardInfo.ygo_atk, c.ygo_atk)]);
  if (nn(cardInfo.ygo_def, c.ygo_def) !== null)
    facts.push(['DEF', nn(cardInfo.ygo_def, c.ygo_def)]);
  if (nn(cardInfo.ygo_level, c.ygo_level) !== null)
    facts.push(['Level / rank', nn(cardInfo.ygo_level, c.ygo_level)]);
  if (nn(cardInfo.ygo_scale, c.ygo_scale) !== null)
    facts.push(['Pendulum scale', nn(cardInfo.ygo_scale, c.ygo_scale)]);
  if (cardInfo.ygo_race || c.ygo_race) facts.push(['Type', cardInfo.ygo_race || c.ygo_race]);
  if (cardInfo.ygo_archetype || c.ygo_archetype)
    facts.push(['Archetype', cardInfo.ygo_archetype || c.ygo_archetype]);
  if (cardInfo.ygo_frame_type || c.ygo_frame_type)
    facts.push(['Frame', titleCase(String(cardInfo.ygo_frame_type || c.ygo_frame_type))]);
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

export default YugiohCardInfo;

/* ── Special features: the Yu-Gi-Oh-only badges ───────────────────────────
 *
 * PORTED FROM `src/app/yugioh/[id]/CardDetailClient.tsx` 4211-4251 and the
 * promo/foil pair at the end of the grid, with the section's extra visibility
 * terms from 4198-4202.
 *
 * The five variant badges are the One Piece ones with `ygo_frame_type` in
 * place of `op_variant_type` — the legacy file is a copy. Rendered inside the
 * shared `SpecialFeatures` panel through `renderCategoryBadges`.
 */

function Badge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cd-badge">
      <p className="cd-eyebrow">{label}</p>
      {children}
    </div>
  );
}

/** Legacy 4198-4202. */
export function hasYugiohFeatures(card: any, cardInfo: LegacyCardInfo): boolean {
  return !!(
    card?.is_foil ||
    cardInfo.ygo_frame_type ||
    cardInfo.is_parallel ||
    cardInfo.is_manga_art ||
    cardInfo.is_alternate_art ||
    cardInfo.is_sp ||
    cardInfo.is_promo
  );
}

export function YugiohFeatureBadges({
  card,
  cardInfo,
}: {
  card: any;
  cardInfo: LegacyCardInfo;
}) {
  const c = card ?? {};
  const frame: string = String(cardInfo.ygo_frame_type ?? '');
  const parallelManga = frame === 'parallel_manga';

  return (
    <>
      {(cardInfo.is_parallel || frame.includes('parallel')) && (
        <Badge label="Variant">Parallel art</Badge>
      )}
      {(cardInfo.is_manga_art || frame.includes('manga')) && !parallelManga && (
        <Badge label="Variant">Manga art</Badge>
      )}
      {parallelManga && <Badge label="Variant">Parallel manga</Badge>}
      {(cardInfo.is_sp || frame === 'sp') && <Badge label="Special">SP card</Badge>}
      {(cardInfo.is_alternate_art || frame === 'alternate_art') && (
        <Badge label="Variant">Alternate art</Badge>
      )}
      {(cardInfo.is_promo || c.is_promo) && <Badge label="Promo">Yes</Badge>}
      {c.is_foil && <Badge label="Foil">{c.foil_type || 'Foil'}</Badge>}
    </>
  );
}
