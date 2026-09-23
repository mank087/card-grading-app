'use client';

/**
 * The Pokemon-only half of Card Information.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx`; the sports client
 * has none of it:
 *
 *   3841-3891   the identification-confidence banner — MOVED to
 *               CardIdentityNotice under the card name (review Sept 23)
 *   3893-3928   Card Name, rendered bilingually
 *   3930-3968   the "(Era)" marker when the set name is really a set era
 *   4002-4062   Type, Stage and HP
 *   4093-4222   Card Text: the front abilities/attacks block and the Pokedex
 *               entry, each split into Japanese and English lines
 *
 * The rest of legacy's Card Information grid — set, year, card number,
 * rarity, subset — is category-agnostic and lives in the shared `CardFacts`,
 * which is where sports, mtg and the others will read it from too.
 *
 * This component is handed to the shell by the Pokemon adapter through
 * `CardFacts`'s `categorySlot`. Nothing shared imports it.
 */

import { splitBilingual, splitBilingualLines } from '@/lib/cardDetail/bilingual';
import type { LegacyCardInfo } from '@/lib/cardDetail/cardInfo';

export interface PokemonCardInfoProps {
  card: any;
  cardInfo: LegacyCardInfo;
  currentUserId: string | null | undefined;
  isOwner: boolean;
  onEdited: () => void;
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

function CardTextBlock({ title, text }: { title: string; text: string }) {
  const lines = splitBilingualLines(text);
  if (lines?.japanese && lines.jpLines.length > 0 && lines.enLines.length > 0) {
    return (
      <div>
        <p className="cd-eyebrow">{title}</p>
        <div className="cd-two-col">
          <div>
            <p className="cd-caption">Japanese</p>
            <p className="cd-finding-prose font-noto-sans-jp" style={{ whiteSpace: 'pre-line' }}>
              {lines.jpLines.join('\n')}
            </p>
          </div>
          <div>
            <p className="cd-caption">English translation</p>
            <p className="cd-finding-prose" style={{ whiteSpace: 'pre-line' }}>
              {lines.enLines.join('\n')}
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (lines?.japanese) {
    return (
      <div>
        <p className="cd-eyebrow">{title}</p>
        <p className="cd-finding-prose font-noto-sans-jp" style={{ whiteSpace: 'pre-line' }}>
          {text}
        </p>
        <p className="cd-caption">English translation not available.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="cd-eyebrow">{title}</p>
      <p className="cd-finding-prose" style={{ whiteSpace: 'pre-line' }}>
        {text}
      </p>
    </div>
  );
}

export function PokemonCardInfo({
  card,
  cardInfo,
  currentUserId,
  isOwner,
  onEdited,
}: PokemonCardInfoProps) {

  const cardName =
    cardInfo.card_name ||
    cardInfo.player_or_character ||
    card?.pokemon_featured ||
    card?.featured ||
    'Unknown';
  // Legacy prints "(Era)" when the set name is only known as an era (3934).
  const setIsEra = !card?.card_set && !!cardInfo.set_era && !cardInfo.set_name;

  const extras: Array<[string, any]> = [
    ['Type', cardInfo.pokemon_type || card?.pokemon_type],
    ['Stage', cardInfo.pokemon_stage || card?.pokemon_stage],
    ['HP', cardInfo.hp || card?.hp],
  ];
  const presentExtras = extras.filter(([, value]) => !!value);

  const frontText = cardInfo.card_front_text;
  const backText = cardInfo.card_back_text;
  const anyCardText = !!(frontText || backText);
  const japaneseCard =
    splitBilingual(frontText)?.japanese || splitBilingual(backText)?.japanese || false;

  return (
    <>
      {/* The identification-confidence notice moved under the card name
          (CardIdentityNotice) so it stays visible when card facts collapse. */}

      <dl className="cd-facts">
        <div>
          <dt>Card name</dt>
          <dd>
            <BilingualValue text={cardName} />
          </dd>
        </div>
        {setIsEra && (
          <div>
            <dt>Set era</dt>
            <dd>
              <BilingualValue text={cardInfo.set_era} />
            </dd>
          </div>
        )}
        {presentExtras.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <BilingualValue text={String(value)} />
            </dd>
          </div>
        ))}
      </dl>

      {anyCardText && (
        <div className="cd-card-text">
          <div className="cd-panel-heading">
            <h3>Card text</h3>
            {japaneseCard && <span className="cd-tag">Japanese card</span>}
          </div>
          {frontText && (
            <CardTextBlock title="Card front — abilities &amp; attacks" text={frontText} />
          )}
          {backText && <CardTextBlock title="Pokedex entry" text={backText} />}
        </div>
      )}
    </>
  );
}

export default PokemonCardInfo;
