'use client';

/**
 * Special features, additional feature tags, and the card description.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 4224-4388
 * [sports 4131-4295 — same block, plus eleven sports-only relic/parallel flags
 * the sports adapter will add through `extraBadges`]:
 *
 *   4233-4237   subset / insert
 *   4240-4255   the print-run serial, filtered by `hasPrintRunSerial`
 *   4258-4263   rookie / first
 *   4266-4292   autograph, its type, its authentication markers, and the
 *               "no on-card authentication detected" footnote
 *   4295-4302   print finish
 *   4305-4310   variant
 *   4313-4322   authentic / unlicensed
 *   4326-4340   additional feature tags
 *   4344-4388   the card description block (`dvg_grading.card_text_blocks`)
 *
 * The section's visibility condition (4225) is legacy's and is reproduced
 * unchanged, including the `cardInfo.memorabilia` term that is true for almost
 * every row — see the report.
 */

import type { ReactNode } from 'react';
import {
  hasAutograph,
  hasPrintRunSerial,
  isRookieOrFirst,
  type LegacyCardInfo,
} from '@/lib/cardDetail/cardInfo';

export interface SpecialFeaturesProps {
  card: any;
  cardInfo: LegacyCardInfo;
  dvgGrading: any;
  /** Category-specific badges, appended after the shared ones. */
  extraBadges?: ReactNode;
  /**
   * Replaces the shared "Variant" badge. Categories do not agree on what that
   * slot says: Pokemon prints `rarity_or_variant` straight (4305-4310), while
   * sports prints a PARALLEL name chosen from four fields and filtered against
   * a list of generic tiers (sports 3974-4013). An adapter that owns the slot
   * passes its own node here — or `null` to draw nothing there at all.
   * Omitted (undefined): the shared badge, exactly as before.
   */
  variantBadge?: ReactNode;
  /**
   * Additional reasons to show the section at all, OR-ed onto the shared
   * condition. The shared list is legacy Pokemon's (4225); sports adds its
   * eleven relic/parallel flags, which can be the only thing a card carries.
   */
  extraVisible?: boolean;
}

/**
 * The card description (`dvg_grading.card_text_blocks`), or nothing.
 *
 * Rendered in TWO places since Phase 4 (F) of the Sept 23 mobile review, and
 * only ever visible in one: its own panel after Special features on a desktop
 * (`cd-desc-panel`, hidden on a phone), and — `bare` — inside the facts
 * panel's "More card details" disclosure on a phone (hidden on a desktop).
 * It is plain text with no state, no effects and no ids, so the second copy
 * costs nothing but the markup.
 */
export function CardDescription({
  dvgGrading,
  bare = false,
  className,
}: {
  dvgGrading: any;
  bare?: boolean;
  className?: string;
}) {
  const textBlocks = dvgGrading?.card_text_blocks;
  if (!textBlocks?.main_text_box) return null;
  const body = (
    <>
      <div className="cd-panel-heading">
        <h3>Card description</h3>
        {textBlocks.text_confidence && (
          <span className="cd-tag">Text quality: {textBlocks.text_confidence}</span>
        )}
      </div>
      <p className="cd-finding-prose" style={{ whiteSpace: 'pre-wrap' }}>
        {textBlocks.main_text_box}
      </p>
      {textBlocks.stat_table_text && textBlocks.stat_table_text !== 'None' && (
        <>
          <p className="cd-eyebrow">Statistics</p>
          <pre className="cd-pre">{textBlocks.stat_table_text}</pre>
        </>
      )}
      {textBlocks.copyright_text && <p className="cd-caption">{textBlocks.copyright_text}</p>}
    </>
  );
  return bare ? (
    <div className={className}>{body}</div>
  ) : (
    <section className={className ? `cd-panel ${className}` : 'cd-panel'}>{body}</section>
  );
}

function Badge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cd-badge">
      <p className="cd-eyebrow">{label}</p>
      {children}
    </div>
  );
}

export function SpecialFeatures({
  card,
  cardInfo,
  dvgGrading,
  extraBadges,
  variantBadge,
  extraVisible = false,
}: SpecialFeaturesProps) {
  const visible = !!(
    dvgGrading?.rarity_features ||
    cardInfo.serial_number ||
    cardInfo.rookie_or_first ||
    dvgGrading?.autograph ||
    cardInfo.subset ||
    cardInfo.autographed ||
    cardInfo.memorabilia ||
    extraVisible
  );

  const serialNumber = cardInfo.serial_number || dvgGrading?.rarity_features?.serial_number;
  const showSerial = hasPrintRunSerial(serialNumber);
  const showRookie = isRookieOrFirst(cardInfo, dvgGrading);
  const showAutograph = hasAutograph(cardInfo, dvgGrading);
  const autographType =
    dvgGrading?.rarity_features?.autograph?.type || dvgGrading?.autograph?.type || 'Yes';
  const certMarkers: string[] = dvgGrading?.autograph?.cert_markers || [];
  const unverifiedAutograph =
    !!card?.conversational_validation_checklist &&
    !card.conversational_validation_checklist.autograph_verified;
  const printFinish = dvgGrading?.rarity_features?.print_finish;
  const featureTags: string[] = dvgGrading?.rarity_features?.feature_tags || [];

  return (
    <>
      {visible && (
        <section className="cd-panel">
          <h3>Special features</h3>
          <div className="cd-badge-grid">
            {cardInfo.subset && <Badge label="Subset / insert">{cardInfo.subset}</Badge>}
            {showSerial && <Badge label="Serial #">{serialNumber}</Badge>}
            {showRookie && <Badge label="Rookie card">Yes</Badge>}
            {showAutograph && (
              <Badge label="Autograph">
                {autographType}
                {certMarkers.length > 0 && (
                  <p className="cd-caption">
                    <strong>Auth markers:</strong> {certMarkers.join(', ')}
                  </p>
                )}
                {unverifiedAutograph && (
                  <p className="cd-caption">
                    <strong>Note:</strong> No on-card authentication detected.
                  </p>
                )}
              </Badge>
            )}
            {printFinish && (
              <Badge label="Print finish">
                <span style={{ textTransform: 'capitalize' }}>
                  {String(printFinish).replace(/_/g, ' ')}
                </span>
              </Badge>
            )}
            {variantBadge === undefined
              ? cardInfo.rarity_or_variant && (
                  <Badge label="Variant">{cardInfo.rarity_or_variant}</Badge>
                )
              : variantBadge}
            {typeof cardInfo.authentic === 'boolean' && (
              <Badge label="Authentic">{cardInfo.authentic ? 'Licensed' : 'Unlicensed'}</Badge>
            )}
            {extraBadges}
          </div>

          {featureTags.length > 0 && (
            <>
              <p className="cd-eyebrow">Additional features</p>
              <ul className="cd-chip-list">
                {featureTags.map((tag, idx) => (
                  <li key={`${tag}-${idx}`}>{tag.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <CardDescription dvgGrading={dvgGrading} className="cd-desc-panel" />
    </>
  );
}

export default SpecialFeatures;
