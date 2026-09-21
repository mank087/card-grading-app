'use client';

/**
 * Grade details — PLACEHOLDER for slice 1C-i.
 *
 * ── WHAT THIS MOUNTS NOW ─────────────────────────────────────────────────
 * Only the pieces that already exist as components, with the same props the
 * legacy pokemon client passes them:
 *
 *   ThreePassSummary        CardDetailClient.tsx:6447-6450 — `grading_passes`
 *                           off the JSON-parsed `conversational_grading`.
 *   SectionDefects          4931, 4977, 5085, 5131 — the `defects` array on
 *                           each of front/back corners/edges, read out of
 *                           `conversational_corners_edges_surface` with the
 *                           same nested-then-flat fallback (4823-4866).
 *   ConditionReportDisplay  3481-3492 — the owner's own condition report and
 *                           the model's response to it.
 *   GradeReviewButton       6958 — owner-only manual review request.
 *
 * Plus the overall condition summary block (3455-3468), because it owns the
 * `#tour-condition-summary` anchor.
 *
 * ── WHAT IS THE NEXT SLICE, NOT THIS ONE ─────────────────────────────────
 * TODO(slice 1C-ii): port the large inline report JSX from the legacy pokemon
 * client. It is not attempted here. The ranges that remain, as of 2026-09-21:
 *
 *   4396-4816   Centering: CollapsibleSection `tour-centering`, the
 *               front/back ratio readouts, `centeringQuality` /
 *               `displayCenteringRatio` / `centeringTierIcon`, and the
 *               measurement-method disclosure.
 *   4816-5200   Corners / edges / surface: per-side panels, the corner and
 *               edge condition grids, `DefectOverlay` + `DefectLegend` +
 *               `CornerZoomCrops`, and the surface analysis prose.
 *   5203-5440   DCM Optic confidence: CollapsibleSection `tour-optic-score`,
 *               image quality, `getUncertaintyFromConfidence`,
 *               `convertRangeToPlusMinus`, `shouldRecommendNewPhotos`.
 *   5622-5800   Professional grade estimates: CollapsibleSection
 *               `tour-pro-estimates` (PSA / BGS / CGC mail-away estimates).
 *               NOTE this one lands in the MARKET section, not here — see
 *               anchorMap.ts.
 *   6335-6900   The full DCM Optic analysis report (JSON and markdown
 *               renderers), of which only ThreePassSummary is lifted today.
 *
 * Until then `#tour-centering` and `#tour-optic-score` are real elements in
 * this section carrying an honest "not in this build yet" note, so a legacy
 * deep link or a tour step still resolves and still reveals this section.
 */

import { ThreePassSummary } from '@/components/reports/ThreePassSummary';
import SectionDefects from '@/components/reports/SectionDefects';
import { ConditionReportDisplay } from '@/components/UserConditionReport';
import { GradeReviewButton } from '@/components/grade-review/GradeReviewButton';
import type { GradingPasses } from '@/types/card';
import type { UserConditionReportInput } from '@/types/conditionReport';
import type { CardDetailCategory } from '@/lib/featureFlags/cardDetailV2';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';

export interface GradeDetailsSectionProps {
  card: any;
  vm: CardDetailViewModel;
  category: CardDetailCategory;
}

/** `conversational_grading` is JSON in v4.0+ and markdown before it. */
function readGradingPasses(card: any): GradingPasses | undefined {
  const report = card?.conversational_grading;
  if (typeof report !== 'string' || !report) return undefined;
  try {
    return (JSON.parse(report)?.grading_passes as GradingPasses | undefined) ?? undefined;
  } catch {
    return undefined; // Markdown report — no structured passes to show.
  }
}

/** The same nested-then-flat read the legacy client does at 4823-4826. */
function readDefects(card: any, group: 'corners' | 'edges', side: 'front' | 'back') {
  const details = card?.conversational_corners_edges_surface || {};
  const raw = details?.[group]?.[side] || details?.[`${side}_${group}`] || {};
  const defects = raw?.defects;
  // An empty array is "inspected, nothing found" — SectionDefects renders
  // nothing for it, so treat it as absent and keep the panel from being an
  // empty box with two headings in it.
  return Array.isArray(defects) && defects.length > 0 ? defects : null;
}

export function GradeDetailsSection({ card, vm, category }: GradeDetailsSectionProps) {
  const gradingPasses = readGradingPasses(card);
  const hasUserReport = !!card?.has_user_condition_report && !!card?.user_condition_report;

  return (
    <div className="cd-section" data-category={category}>
      <div className="cd-section-title">
        <p className="cd-eyebrow">The details make the grade</p>
        <h2>Why this grade?</h2>
        <p>
          The findings behind {vm.grade.gradeFormatted === 'N/A' ? 'this assessment' : `the ${vm.grade.gradeFormatted}`}.
        </p>
      </div>

      {/* Overall condition summary — owns #tour-condition-summary. */}
      <section id="tour-condition-summary" className="cd-panel">
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Overall card condition summary</h3>
        {vm.grade.summary ? (
          <p style={{ marginTop: 10, lineHeight: 1.7 }}>{vm.grade.summary}</p>
        ) : (
          <p className="cd-caption" style={{ marginTop: 10 }}>
            No written condition summary was saved with this grade.
          </p>
        )}
        {vm.grade.limitingFactor && (
          <p className="cd-caption" style={{ marginTop: 12 }}>
            <strong>Limiting factor:</strong> {vm.grade.limitingFactor}
          </p>
        )}
      </section>

      {/* Anchor kept alive for legacy links and the tour. Content is the next slice. */}
      <section id="tour-centering" className="cd-panel">
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Centering</h3>
        <p className="cd-caption" style={{ marginTop: 8 }}>
          Centering measurement: {vm.grade.subgrades.centering === null ? '—' : `${vm.grade.subgrades.centering}/10`}.
          The full front/back ratio breakdown has not been ported to this page yet — open{' '}
          <a href={`/${category}/${vm.id}?v=1`}>the current card page</a> for it.
        </p>
      </section>

      {(readDefects(card, 'corners', 'front') ||
        readDefects(card, 'edges', 'front') ||
        readDefects(card, 'corners', 'back') ||
        readDefects(card, 'edges', 'back')) && (
        <section className="cd-panel">
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>Recorded defects</h3>
          <div className="cd-two-col">
            <div>
              <p className="cd-eyebrow">Front</p>
              <SectionDefects defects={readDefects(card, 'corners', 'front')} />
              <SectionDefects defects={readDefects(card, 'edges', 'front')} />
            </div>
            <div>
              <p className="cd-eyebrow">Back</p>
              <SectionDefects defects={readDefects(card, 'corners', 'back')} accent="purple" />
              <SectionDefects defects={readDefects(card, 'edges', 'back')} accent="purple" />
            </div>
          </div>
        </section>
      )}

      {/* Anchor kept alive for legacy links and the tour. Content is the next slice. */}
      <section id="tour-optic-score" className="cd-panel">
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>DCM Optic&trade; confidence</h3>
        <p className="cd-caption" style={{ marginTop: 8 }}>
          The image-quality and confidence readout has not been ported to this page yet — open{' '}
          <a href={`/${category}/${vm.id}?v=1`}>the current card page</a> for it.
        </p>
      </section>

      {gradingPasses && (
        <section className="cd-panel">
          <ThreePassSummary gradingPasses={gradingPasses} />
        </section>
      )}

      {hasUserReport && (
        <section className="cd-panel">
          <ConditionReportDisplay
            report={card.user_condition_report as UserConditionReportInput}
            aiResponse={
              card.user_condition_ai_response
                ? {
                    hints_confirmed: card.user_condition_ai_response.hints_confirmed || [],
                    hints_not_visible: card.user_condition_ai_response.hints_not_visible || [],
                    influenced_grade: card.user_report_influenced_grade || false,
                  }
                : undefined
            }
          />
        </section>
      )}

      {vm.permissions.isOwner && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GradeReviewButton cardId={vm.id} ownerId={card?.user_id} />
        </div>
      )}
    </div>
  );
}

export default GradeDetailsSection;
