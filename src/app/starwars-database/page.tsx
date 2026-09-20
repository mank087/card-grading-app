import { permanentRedirect } from 'next/navigation';

/**
 * The internal Star Wars card catalog was retired in September 2026. Star Wars
 * cards are graded under Other / Star Wars and identified from the photos.
 *
 * A PERMANENT redirect, because this page was public and indexed: a temporary
 * one tells search engines to keep the old URL, and they would keep sending
 * people to a page that no longer exists.
 */
export default function RetiredStarWarsCatalog(): never {
  permanentRedirect('/card-grading');
}
