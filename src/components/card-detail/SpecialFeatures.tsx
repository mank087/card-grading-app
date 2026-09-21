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
}: SpecialFeaturesProps) {
  const visible = !!(
    dvgGrading?.rarity_features ||
    cardInfo.serial_number ||
    cardInfo.rookie_or_first ||
    dvgGrading?.autograph ||
    cardInfo.subset ||
    cardInfo.autographed ||
    cardInfo.memorabilia
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
  const textBlocks = dvgGrading?.card_text_blocks;

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
            {cardInfo.rarity_or_variant && (
              <Badge label="Variant">{cardInfo.rarity_or_variant}</Badge>
            )}
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

      {textBlocks?.main_text_box && (
        <section className="cd-panel">
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
          {textBlocks.copyright_text && (
            <p className="cd-caption">{textBlocks.copyright_text}</p>
          )}
        </section>
      )}
    </>
  );
}

export default SpecialFeatures;
