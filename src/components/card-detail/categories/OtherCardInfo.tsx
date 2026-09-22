'use client';

/**
 * The "Other"-only half of Card Information.
 *
 * PORTED FROM `src/app/other/[id]/CardDetailClient.tsx`:
 *
 *   3832-3864   Card Name, rendered bilingually
 *   3866-3891   Ink Color, 3892-3900 Card Type, 3902-3910 Character Version,
 *               3912-3920 Ink Cost, 3922-3930 Strength, 3932-3941 Willpower
 *               — the Lorcana leftovers, see below
 *   3943-3956   Set Name  (the shared `CardFacts` prints it)
 *   3957-3965   Card Number  (the shared `CardFacts` prints it)
 *   3967-3975   Manufacturer
 *   3977-3985   Card Date → "Year/Date"
 *   3987-4003   Autographed and Memorabilia, each shown only when true
 *   4005-4013   Special Features
 *   4015-4023   Language, only when it is not English
 *   4025-4033   Front Text
 *   4035-4043   Back Text
 *   4045-4056   Flavor Text
 *
 * 'Other' is the thinnest of the eight: no set code, no artist, no rarity
 * block of its own, no keywords, and no category badges at all — its Special
 * Features list (4058-4160) is the shared Pokemon one exactly.
 *
 * THE LORCANA LEFTOVERS. The six fields above read `cardInfo.ink_color`,
 * `cardInfo.lorcana_card_type`, `cardInfo.character_version`,
 * `cardInfo.ink_cost`, `cardInfo.strength` and `cardInfo.willpower` — keys
 * `buildCardInfo(card, 'other')` never fills, because the 'other' chain does
 * not define them. Each falls through to the matching `cards.<column>`, which
 * IS a real column, so the block CAN fire on a row that carries Lorcana data
 * under the Other category. They are reproduced here, reading the columns, so
 * such a row prints on V2 exactly what it prints on the frozen page.
 *
 * Copied, not improved: the fallbacks, the field order and the conditionals
 * are legacy's. The emoji legacy prints inside the ink badge is dropped: V2
 * carries no emoji anywhere.
 *
 * This component is handed to the shell by the Other adapter through
 * `CardFacts`'s `categorySlot`. Nothing shared imports it.
 */

import type { ReactNode } from 'react';
import { splitBilingual } from '@/lib/cardDetail/bilingual';
import type { LegacyCardInfo } from '@/lib/cardDetail/cardInfo';

export interface OtherCardInfoProps {
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

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="cd-eyebrow">{title}</p>
      <p className="cd-finding-prose" style={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </p>
    </div>
  );
}

export function OtherCardInfo({ card, cardInfo }: OtherCardInfoProps) {
  const c = card ?? {};

  const cardName = cardInfo.card_name || c.card_name;
  const language = cardInfo.language || c.language;
  const showLanguage = !!language && language !== 'English';

  /** Legacy's own test at 3988 and 3996. */
  const yes = (a: any, b: any) =>
    a === true || a === 'Yes' || a === 'yes' || b === true;

  const facts: Array<[string, ReactNode]> = [];
  // The Lorcana leftovers, in legacy's order.
  if (cardInfo.ink_color || c.ink_color)
    facts.push(['Ink colour', <span className="cd-tag">{cardInfo.ink_color || c.ink_color}</span>]);
  if (cardInfo.lorcana_card_type || c.lorcana_card_type)
    facts.push(['Card type', cardInfo.lorcana_card_type || c.lorcana_card_type]);
  if (cardInfo.character_version || c.character_version)
    facts.push(['Character version', cardInfo.character_version || c.character_version]);
  if (cardInfo.ink_cost || c.ink_cost) facts.push(['Ink cost', cardInfo.ink_cost || c.ink_cost]);
  if (cardInfo.strength || c.strength) facts.push(['Strength', cardInfo.strength || c.strength]);
  if (cardInfo.willpower || c.willpower) facts.push(['Willpower', cardInfo.willpower || c.willpower]);

  if (cardInfo.manufacturer || c.manufacturer)
    facts.push(['Manufacturer', cardInfo.manufacturer || c.manufacturer]);
  if (cardInfo.card_date || c.card_date)
    facts.push(['Year / date', cardInfo.card_date || c.card_date]);
  if (yes(cardInfo.autographed, c.autographed)) facts.push(['Autographed', 'Yes']);
  if (yes(cardInfo.memorabilia, c.memorabilia)) facts.push(['Memorabilia', 'Yes']);
  if (cardInfo.special_features || c.special_features)
    facts.push(['Special features', cardInfo.special_features || c.special_features]);
  if (showLanguage) facts.push(['Language', language]);

  const frontText = cardInfo.front_text || c.front_text;
  const backText = cardInfo.back_text || c.back_text;
  const flavorText = cardInfo.flavor_text || c.flavor_text;
  const anyText = !!(frontText || backText || flavorText);

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

      {anyText && (
        <div className="cd-card-text">
          <div className="cd-panel-heading">
            <h3>Card text</h3>
          </div>
          {frontText && <TextBlock title="Front text" text={frontText} />}
          {backText && <TextBlock title="Back text" text={backText} />}
          {flavorText && (
            <div>
              <p className="cd-eyebrow">Flavor text</p>
              <p className="cd-finding-prose" style={{ fontStyle: 'italic' }}>
                &ldquo;{flavorText}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default OtherCardInfo;
