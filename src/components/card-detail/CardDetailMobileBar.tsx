'use client';

/**
 * The fixed action bar below 760px (review finding 4).
 *
 * It used to SCROLL. "Download label" scrolled to the download component and
 * focused whichever button happened to be first inside it; "InstaList"
 * scrolled to the panel. Both named an action and performed a navigation, and
 * the focus target was whatever the menu's markup order made it.
 *
 * Now each button performs the action of the state it is in, in one tap:
 *   Download label  -> opens the existing download menu where the reader is,
 *                      as a bottom sheet (DownloadReportButton's additive
 *                      `openLabelsSignal` + `sheetOnMobile`).
 *   InstaList       -> the InstaList state's own action: open the listing,
 *                      open the connect-or-create flow, or check again.
 *
 * Extracted from `CardDetailShell` so the shell stays composition only.
 */

import type { InstaListState } from './useInstaListStatus';

export interface CardDetailMobileBarProps {
  /** Opens the existing download menu in place. */
  onOpenDownloads: () => void;
  /** Null when the card is sold or the viewer is not the owner. */
  instaList: {
    state: InstaListState;
    listingUrl: string | null | undefined;
    onAct: () => void;
  } | null;
}

/** What the InstaList button says, and whether it can be pressed yet. */
function instaListLabel(state: InstaListState): { text: string; disabled: boolean } {
  switch (state) {
    case 'checking':
      return { text: 'Checking listing…', disabled: true };
    case 'listed':
      return { text: 'View eBay listing', disabled: false };
    case 'unlisted':
      return { text: 'List on eBay', disabled: false };
    case 'unverified':
      return { text: 'Check eBay listing', disabled: false };
    default:
      return { text: 'InstaList', disabled: true };
  }
}

export function CardDetailMobileBar({ onOpenDownloads, instaList }: CardDetailMobileBarProps) {
  const insta = instaList ? instaListLabel(instaList.state) : null;

  return (
    <div className="cd-mobile-bar">
      <button
        type="button"
        className="dcm-button dcm-button--primary"
        onClick={onOpenDownloads}
      >
        Download label
      </button>
      {instaList && insta && (
        <button
          type="button"
          className="dcm-button dcm-button--secondary"
          onClick={instaList.onAct}
          disabled={insta.disabled}
          aria-live="polite"
        >
          {insta.text}
        </button>
      )}
    </div>
  );
}

export default CardDetailMobileBar;
