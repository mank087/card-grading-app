'use client';

/**
 * The MTG-only half of Card Information.
 *
 * PORTED FROM `src/app/mtg/[id]/CardDetailClient.tsx`:
 *
 *   3888-3928   Card Name, with the Universes Beyond / Secret Lair crossover
 *               `flavor_name` above the canonical name, and the bilingual split
 *   3931-3940   Mana Cost
 *   3942-3951   Type (the type line)
 *   3953-3962   Creature Type
 *   3964-3973   Power / Toughness
 *   3975-4004   Color Identity, one chip per WUBRGC letter
 *   4006-4022   the set's expansion code, printed under the shared Set row
 *   4033-4042   Rarity — and 4137-4146, the `mtg_rarity` Scryfall fallback
 *   4044-4053   Artist
 *   4052-4067   Finish: the FOIL chip and its `foil_type`
 *   4069-4076   Language, only when it is not English
 *   4078-4087   Double-faced layout
 *   4089-4136   the three Scryfall fallbacks (mana cost, type line, colours)
 *   4147-4156   Set Code, the Scryfall fallback for the expansion code
 *   4158-4167   Promo
 *   4179-4196   Border and Frame
 *   4198-4226   Keywords
 *   4227-4242   the Scryfall database link
 *   4318-4343   the MTG-only Special Features badges (foil, rarity,
 *               double-faced, extended art, showcase, borderless, retro frame,
 *               full art, foil type) — exported separately below
 *   4443-4458   "Card Text": the rules and flavour text
 *
 * The rest of legacy's grid — Set, Card Number, Subset, Year, Language and the
 * Rarity/variant row — is category-agnostic and is printed by the shared
 * `CardFacts`. The shared badges (subset, serial, rookie, autograph, print
 * finish, variant, authentic) are `SpecialFeatures`' business.
 *
 * Copied, not improved: the fallbacks, the field order and the conditionals
 * are legacy's. `cardInfo` arrives from `buildCardInfo(card, 'mtg')`, which
 * carries MTG's JSON-first precedence and its frame-treatment set-name rule.
 * The emoji legacy prints inside the chips is dropped: V2's badge grid carries
 * no emoji anywhere.
 *
 * This component is handed to the shell by the MTG adapter through
 * `CardFacts`'s `categorySlot`. Nothing shared imports it.
 */

import type { ReactNode } from 'react';
import type { LegacyCardInfo } from '@/lib/cardDetail/cardInfo';

export interface MtgCardInfoProps {
  card: any;
  cardInfo: LegacyCardInfo;
}

/** Legacy's own colour names (3983-3990). V2 prints the letter and the name. */
const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

function ColorChips({ letters }: { letters: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {letters.map((letter, idx) => (
        <span key={`${letter}-${idx}`} className="cd-tag" title={COLOR_NAMES[letter] ?? letter}>
          {letter}
        </span>
      ))}
    </span>
  );
}

/** Legacy 4141: the only rarity value it rewrites. */
function formatMtgRarity(rarity: string): string {
  return rarity === 'mythic' ? 'Mythic Rare' : rarity;
}

export function MtgCardInfo({ card, cardInfo }: MtgCardInfoProps) {
  const c = card ?? {};

  const cardName = cardInfo.card_name || c.card_name;
  const flavorName = cardInfo.flavor_name;
  const crossover = !!(flavorName && flavorName !== cardName);
  const japanese = typeof cardName === 'string' && /[぀-ゟ゠-ヿ一-龯]/.test(cardName);
  let jpPart: string | null = null;
  let enPart: string | null = null;
  if (japanese && !crossover) {
    const parts = String(cardName).split(/[/()（）]/);
    jpPart = parts.find((p) => /[぀-ゟ゠-ヿ一-龯]/.test(p))?.trim() ?? null;
    enPart = parts.find((p) => p.trim() && !/[぀-ゟ゠-ヿ一-龯]/.test(p))?.trim() ?? null;
  }

  // Legacy prints the cardInfo value first and the Scryfall column only as a
  // fallback, each in its own block (3931/4089, 3942/4099, 3975/4109).
  const manaCost = cardInfo.mana_cost || c.mana_cost || (!cardInfo.mana_cost ? c.mtg_mana_cost : null);
  const typeLine =
    cardInfo.mtg_card_type || c.mtg_card_type || (!cardInfo.mtg_card_type ? c.mtg_type_line : null);
  const identityLetters =
    typeof (cardInfo.color_identity || c.color_identity) === 'string'
      ? String(cardInfo.color_identity || c.color_identity).split('')
      : [];
  const scryfallColors: string[] =
    identityLetters.length === 0 && Array.isArray(c.mtg_colors) ? c.mtg_colors : [];
  const rarity =
    cardInfo.rarity_or_variant ||
    c.rarity_description ||
    (c.mtg_rarity ? formatMtgRarity(c.mtg_rarity) : null);
  const expansionCode = cardInfo.expansion_code || c.expansion_code || c.mtg_set_code || null;
  const language = cardInfo.language || c.card_language || c.language;
  const showLanguage = !!language && language !== 'English';
  const doubleFaced = !!(cardInfo.is_double_faced || c.is_double_faced);
  const keywords: string[] = Array.isArray(cardInfo.keywords)
    ? cardInfo.keywords
    : Array.isArray(c.keywords)
      ? c.keywords
      : [];
  const scryfallId = c.scryfall_id || c.conversational_card_info?.scryfall_id || null;

  const facts: Array<[string, ReactNode]> = [];
  if (manaCost) facts.push(['Mana cost', <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{manaCost}</span>]);
  if (typeLine) facts.push(['Type', typeLine]);
  if (cardInfo.creature_type || c.creature_type)
    facts.push(['Creature type', cardInfo.creature_type || c.creature_type]);
  if (cardInfo.power_toughness || c.power_toughness)
    facts.push(['Power / toughness', cardInfo.power_toughness || c.power_toughness]);
  if (identityLetters.length > 0)
    facts.push(['Color identity', <ColorChips letters={identityLetters} />]);
  else if (scryfallColors.length > 0)
    facts.push(['Colors', <ColorChips letters={scryfallColors} />]);
  if (expansionCode) facts.push(['Set code', <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textTransform: 'uppercase' }}>{expansionCode}</span>]);
  if (rarity) facts.push(['Rarity', <span style={{ textTransform: 'capitalize' }}>{rarity}</span>]);
  if (cardInfo.artist_name || c.artist_name)
    facts.push(['Artist', cardInfo.artist_name || c.artist_name]);
  if (c.is_foil)
    facts.push(['Finish', c.foil_type ? `Foil (${c.foil_type})` : 'Foil']);
  if (showLanguage) facts.push(['Language', language]);
  if (doubleFaced) facts.push(['Card layout', 'Double-faced']);
  if (cardInfo.is_promo || c.is_promo) facts.push(['Promo', 'Yes']);
  if (cardInfo.border_color || c.border_color)
    facts.push([
      'Border',
      <span style={{ textTransform: 'capitalize' }}>{cardInfo.border_color || c.border_color}</span>,
    ]);
  if (cardInfo.frame_version || c.frame_version)
    facts.push(['Frame', cardInfo.frame_version || c.frame_version]);

  return (
    <>
      <dl className="cd-facts">
        {cardName && (
          <div>
            <dt>Card name</dt>
            <dd>
              {crossover ? (
                <>
                  <span>{flavorName}</span>
                  <span className="cd-caption">({cardName})</span>
                </>
              ) : jpPart && enPart ? (
                <>
                  <span className="font-noto-sans-jp">{jpPart}</span>
                  <span className="cd-caption">{enPart}</span>
                </>
              ) : (
                <span className={japanese ? 'font-noto-sans-jp' : undefined}>{cardName}</span>
              )}
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

      {scryfallId && (
        <p className="cd-caption" style={{ marginTop: 12 }}>
          <a
            className="cd-quiet"
            href={`https://scryfall.com/card/${scryfallId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Scryfall — this card in the database
          </a>
        </p>
      )}

      {cardInfo.card_front_text && (
        <div className="cd-card-text">
          <div className="cd-panel-heading">
            <h3>Card text</h3>
          </div>
          <p className="cd-finding-prose" style={{ whiteSpace: 'pre-line' }}>
            {cardInfo.card_front_text}
          </p>
        </div>
      )}
    </>
  );
}

export default MtgCardInfo;

/* ── Special features: the MTG-only badges ────────────────────────────────
 *
 * PORTED FROM `src/app/mtg/[id]/CardDetailClient.tsx` 4265-4343, and the
 * section's extra visibility terms from 4254-4260.
 *
 * Rendered inside the shared `SpecialFeatures` panel through the adapter's
 * `renderCategoryBadges` slot, so the shared badges (subset, serial, rookie,
 * autograph, print finish, variant, authentic) are not repeated here.
 */

function Badge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cd-badge">
      <p className="cd-eyebrow">{label}</p>
      {children}
    </div>
  );
}

/** Legacy 4254-4260: the MTG flags are reason enough to show the panel. */
export function hasMtgFeatures(card: any, cardInfo: LegacyCardInfo): boolean {
  const c = card ?? {};
  return !!(
    c.is_foil ||
    c.is_double_faced ||
    c.mtg_rarity ||
    cardInfo.is_extended_art ||
    cardInfo.is_showcase ||
    cardInfo.is_borderless ||
    cardInfo.is_retro_frame ||
    cardInfo.is_full_art_mtg ||
    cardInfo.is_promo
  );
}

const MTG_FLAGS: Array<[keyof LegacyCardInfo, string]> = [
  ['is_extended_art', 'Extended art'],
  ['is_showcase', 'Showcase'],
  ['is_borderless', 'Borderless'],
  ['is_retro_frame', 'Retro frame'],
  ['is_full_art_mtg', 'Full art'],
];

export function MtgFeatureBadges({
  card,
  cardInfo,
}: {
  card: any;
  cardInfo: LegacyCardInfo;
}) {
  const c = card ?? {};
  return (
    <>
      {c.is_foil && <Badge label="Foil">{c.foil_type || 'Foil'}</Badge>}
      {c.mtg_rarity && (
        <Badge label="Rarity">
          <span style={{ textTransform: 'capitalize' }}>{formatMtgRarity(c.mtg_rarity)}</span>
        </Badge>
      )}
      {c.is_double_faced && <Badge label="Card layout">Double-faced</Badge>}
      {MTG_FLAGS.filter(([key]) => cardInfo[key]).map(([key, label]) => (
        <Badge key={String(key)} label={label}>
          Yes
        </Badge>
      ))}
      {cardInfo.foil_type && cardInfo.foil_type !== 'Standard Foil' && (
        <Badge label="Foil type">
          <span style={{ textTransform: 'capitalize' }}>{cardInfo.foil_type}</span>
        </Badge>
      )}
    </>
  );
}
