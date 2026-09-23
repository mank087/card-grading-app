/**
 * Is there reason to doubt this card's identity?
 *
 * Today the only stored signal is `pokemon_api_confidence`, written when a
 * Pokémon card is matched against the card database: 'low' means the match
 * was poor, 'medium' that it was only partly confirmed. Other categories have
 * no equivalent column yet, so they return null — extend this function, not
 * the callers, when one arrives.
 *
 * It lived deep in the Pokémon card facts ("Card identification uncertain"),
 * below the grade, the value and the holders, which is where an owner about to
 * list the card was least likely to see it. The page now shows it under the
 * card name (CardIdentityNotice), and it must stay visible when card facts are
 * collapsed.
 */

export type IdentityConcern = 'low' | 'medium';

export function readIdentityConcern(card: any): IdentityConcern | null {
  const raw = card?.pokemon_api_confidence;
  if (raw === 'low' || raw === 'medium') return raw;
  return null;
}

/** Title and one line for the notice. Plain, and never stronger than the signal. */
export function identityConcernCopy(concern: IdentityConcern): { title: string; line: string } {
  return concern === 'low'
    ? {
        title: 'Card identification may be incorrect',
        line: 'The set, year or card number shown may not match this card.',
      }
    : {
        title: 'Card identification uncertain',
        line: 'Some card details may need checking.',
      };
}
