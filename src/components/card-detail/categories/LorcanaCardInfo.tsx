'use client';

/**
 * The Lorcana-only half of Card Information.
 *
 * PORTED FROM `src/app/lorcana/[id]/CardDetailClient.tsx`:
 *
 *   3895-3926   Card Name, rendered bilingually
 *   3928-3953   Ink Color, with its six-colour badge
 *   3955-3963   Card Type
 *   3965-3974   Character Version
 *   3975-3984   Ink Cost
 *   3985-3994   Strength
 *   3995-4004   Willpower
 *   4005-4014   Lore Value
 *   4015-4023   Inkwell
 *   4024-4042   the set's expansion code, printed under the shared Set row
 *   4043-4052   Collector Number  (shared `CardFacts` prints it too — see below)
 *   4053-4062   Rarity
 *   4063-4072   Artist
 *   4073-4091   Enchanted and Foil
 *   4093-4102   Language, only when it is not English
 *   4103-4112   Franchise
 *   4113-4130   Classifications
 *   4130-4147   Abilities
 *   4148-4160   Flavor Text
 *
 * The rest of legacy's grid — Set, Subset, Year, Card number, Rarity/variant,
 * Language and the DCM serial — is category-agnostic and is printed by the
 * shared `CardFacts`. Lorcana adds no badges to Special features: its list
 * (4162-4256) is the shared one exactly, Variant included.
 *
 * Copied, not improved: the fallbacks, the field order and the conditionals
 * are legacy's. `cardInfo` arrives from `buildCardInfo(card, 'lorcana')`,
 * which carries Lorcana's DATABASE-COLUMN-FIRST precedence. The emoji legacy
 * prints inside the ink badge is dropped: V2 carries no emoji anywhere.
 *
 * This component is handed to the shell by the Lorcana adapter through
 * `CardFacts`'s `categorySlot`. Nothing shared imports it.
 */

import type { ReactNode } from 'react';
import { splitBilingual } from '@/lib/cardDetail/bilingual';
import type { LegacyCardInfo } from '@/lib/cardDetail/cardInfo';

export interface LorcanaCardInfoProps {
  card: any;
  cardInfo: LegacyCardInfo;
}

/** Legacy's six inks (3936-3942). The emoji is dropped; the name stays. */
const INK_COLORS = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

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

function asList(a: unknown, b: unknown): string[] {
  if (Array.isArray(a)) return a as string[];
  if (Array.isArray(b)) return b as string[];
  return [];
}

export function LorcanaCardInfo({ card, cardInfo }: LorcanaCardInfoProps) {
  const c = card ?? {};

  const cardName = cardInfo.card_name || c.card_name;
  const inkColor = cardInfo.ink_color || c.ink_color;
  const language = cardInfo.language || c.language;
  const showLanguage = !!language && language !== 'English';
  // Legacy shows Foil only when the card is not already marked Enchanted (4083).
  const enchanted = !!(cardInfo.is_enchanted || c.is_enchanted);
  const foil = !!(cardInfo.is_foil || c.is_foil) && !c.is_enchanted;
  const classifications = asList(cardInfo.classifications, c.classifications);
  const abilities = asList(cardInfo.abilities, c.abilities);
  const flavorText = cardInfo.flavor_text || c.flavor_text;

  const facts: Array<[string, ReactNode]> = [];
  if (inkColor)
    facts.push([
      'Ink colour',
      <span className="cd-tag" title={INK_COLORS.includes(inkColor) ? inkColor : undefined}>
        {inkColor}
      </span>,
    ]);
  if (cardInfo.lorcana_card_type || c.lorcana_card_type)
    facts.push(['Card type', cardInfo.lorcana_card_type || c.lorcana_card_type]);
  if (cardInfo.character_version || c.character_version)
    facts.push(['Character version', cardInfo.character_version || c.character_version]);
  if (cardInfo.ink_cost || c.ink_cost) facts.push(['Ink cost', cardInfo.ink_cost || c.ink_cost]);
  if (cardInfo.strength || c.strength) facts.push(['Strength', cardInfo.strength || c.strength]);
  if (cardInfo.willpower || c.willpower) facts.push(['Willpower', cardInfo.willpower || c.willpower]);
  if (cardInfo.lore_value || c.lore_value) facts.push(['Lore', cardInfo.lore_value || c.lore_value]);
  if (cardInfo.inkwell || c.inkwell) facts.push(['Inkwell', 'Yes']);
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
  if (enchanted) facts.push(['Enchanted', 'Yes']);
  if (foil) facts.push(['Finish', 'Foil']);
  if (showLanguage) facts.push(['Language', language]);
  if (cardInfo.franchise || c.franchise)
    facts.push(['Franchise', cardInfo.franchise || c.franchise]);

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

      {classifications.length > 0 && (
        <>
          <p className="cd-eyebrow">Classifications</p>
          <ul className="cd-chip-list">
            {classifications.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {abilities.length > 0 && (
        <>
          <p className="cd-eyebrow">Abilities</p>
          <ul className="cd-chip-list">
            {abilities.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {flavorText && (
        <div className="cd-card-text">
          <div className="cd-panel-heading">
            <h3>Flavor text</h3>
          </div>
          <p className="cd-finding-prose" style={{ fontStyle: 'italic' }}>
            &ldquo;{flavorText}&rdquo;
          </p>
        </div>
      )}
    </>
  );
}

export default LorcanaCardInfo;
