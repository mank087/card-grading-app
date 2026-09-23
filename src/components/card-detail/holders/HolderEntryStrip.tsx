'use client';

/**
 * "See it in a holder" — the compact entry strip under the hero's label
 * showcase (review item B, built the approved way).
 *
 * The hero keeps its label-above-the-card composition and the holders stay in
 * the Overview band, so the multi-holder capability was a scroll and a read
 * away. This is the pointer to it: three small buttons that take the reader
 * straight to that holder's card, activate the section it lives in and
 * highlight it on arrival.
 *
 * It is not a selector and holds no state — the hero still depends on no
 * holder.
 *
 * PHONES (≤760px, Sept 23 review S4): the three buttons collapse into ONE
 * "Preview holders" link that opens Overview at the holder band. Both forms
 * are rendered and CSS shows one; desktop keeps the three.
 */

import { CARD_HOLDERS, HOLDER_NAMES, type CardHolderId } from '@/lib/cardDetail/holderSupport';

export interface HolderEntryStripProps {
  onGoToHolder: (holder: CardHolderId) => void;
  /** The phone form's single link: Overview, scrolled to the holder band. */
  onGoToBand?: () => void;
}

export function HolderEntryStrip({ onGoToHolder, onGoToBand }: HolderEntryStripProps) {
  return (
    <div className="cd-holder-entry" data-has-band-link={onGoToBand ? 'true' : undefined}>
      {onGoToBand && (
        <button type="button" className="cd-quiet cd-holder-entry-all" onClick={onGoToBand}>
          Preview holders
        </button>
      )}
      <p className="cd-eyebrow cd-holder-entry-eyebrow" id="cd-holder-entry-label">
        See it in a holder
      </p>
      <div className="cd-holder-entry-row" role="group" aria-labelledby="cd-holder-entry-label">
        {CARD_HOLDERS.map((holder) => (
          <button
            key={holder}
            type="button"
            className="cd-holder-entry-button"
            onClick={() => onGoToHolder(holder)}
          >
            <span className="cd-holder-entry-thumb" data-holder={holder} aria-hidden="true" />
            <span>{HOLDER_NAMES[holder]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default HolderEntryStrip;
