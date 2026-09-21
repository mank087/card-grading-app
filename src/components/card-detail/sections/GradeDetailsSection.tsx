'use client';

/**
 * Grade details — the whole inline report from the legacy page.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` [sports is
 * line-for-line the same in this region, offset by about -93 lines]:
 *
 *   3453-3469   overall condition summary and the limiting factor
 *               (`#tour-condition-summary`)
 *   3471-3477   the reviewed-and-dismissed structural line
 *   3479-3491   the owner's condition report and the model's answer to it
 *   4392-4763   centering            → ./grade/EvidenceCentering
 *   4769-4812   the defect overlays  → ./grade/DefectInspection
 *   4814-5193   corners/edges/surface→ ./grade/EvidenceCondition
 *   5196-5444   confidence           → ./grade/ConfidencePanel
 *   6297-6904   the full analysis    → ./grade/FullAnalysisReport
 *   6906-6916   version + graded date→ ./grade/ReportProvenance
 *   6950-6960   the owner's manual grade review request
 *
 * Professional mail-away estimates (5619-5797) are NOT here: `anchorMap.ts`
 * gives `tour-pro-estimates` to the Market section, and that is where
 * `../ProEstimatesPanel` is mounted.
 *
 * ── LAYOUT ───────────────────────────────────────────────────────────────
 * The mockup's Grade details tab: the inspection photo on the left, the
 * findings on the right behind one tab per subgrade, with the confidence, the
 * user's report and the full analysis as expanders under them. The tabs are
 * real buttons with `aria-selected` and the panel carries the block's anchor
 * id, so a hero subgrade click, a `#tour-centering` deep link and a tour step
 * all select the right tab and land on it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import { ThreePassSummary } from '@/components/reports/ThreePassSummary';
import { ConditionReportDisplay } from '@/components/UserConditionReport';
import { GradeReviewButton } from '@/components/grade-review/GradeReviewButton';
import type { GradingPasses } from '@/types/card';
import type { UserConditionReportInput } from '@/types/conditionReport';
import type { CardDetailCategory } from '@/lib/featureFlags/cardDetailV2';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';
import {
  hasCenteringData,
  readStructuralUnconfirmedNote,
} from '@/lib/cardDetail/gradeDetails';

import EvidenceCentering from './grade/EvidenceCentering';
import { EvidenceCorners, EvidenceEdges, EvidenceSurface } from './grade/EvidenceCondition';
import ConfidencePanel from './grade/ConfidencePanel';
import ReportProvenance from './grade/ReportProvenance';

/** Image-heavy and below the fold. */
const DefectInspection = dynamic(() => import('./grade/DefectInspection'), {
  ssr: false,
  loading: () => <p className="cd-caption">Loading the inspection photos…</p>,
});

/** The largest block on the page, and behind a closed expander. */
const FullAnalysisReport = dynamic(() => import('./grade/FullAnalysisReport'), {
  ssr: false,
  loading: () => <p className="cd-caption">Loading the full analysis…</p>,
});

export const EVIDENCE_TABS = [
  { key: 'centering', label: 'Centering', anchorId: 'tour-centering' },
  { key: 'corners', label: 'Corners', anchorId: 'cd-evidence-corners' },
  { key: 'edges', label: 'Edges', anchorId: 'cd-evidence-edges' },
  { key: 'surface', label: 'Surface', anchorId: 'cd-evidence-surface' },
] as const;

export type EvidenceKey = (typeof EVIDENCE_TABS)[number]['key'];

/** Which tab an anchor id belongs to, or null when it names none of them. */
export function evidenceForAnchor(anchorId: string | null | undefined): EvidenceKey | null {
  if (!anchorId) return null;
  return EVIDENCE_TABS.find((tab) => tab.anchorId === anchorId)?.key ?? null;
}

export interface GradeDetailsSectionProps {
  card: any;
  vm: CardDetailViewModel;
  category: CardDetailCategory;
  /**
   * The anchor the shell was last asked to jump to. When it names an evidence
   * block, that tab is selected before the shell scrolls.
   */
  focusAnchor?: string | null;
  /** Opens the shared image zoom modal. */
  onZoom?: (imageUrl: string, alt: string, title: string) => void;
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

export function GradeDetailsSection({
  card,
  vm,
  category,
  focusAnchor,
  onZoom,
}: GradeDetailsSectionProps) {
  const [evidence, setEvidence] = useState<EvidenceKey>('centering');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [confidenceOpen, setConfidenceOpen] = useState(false);
  /**
   * The shell fires its own scroll two frames after it switches section, which
   * is a frame too early for a tab this component has not selected yet — the
   * panel carrying the anchor id is not in the DOM to be found. So the panel
   * scrolls itself once it exists, and the shell's attempt is simply a no-op.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef(false);
  const correctionTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    panelRef.current?.scrollIntoView({ behavior, block: 'start' });
    // The inspection photos arrive in a dynamic chunk and the card images load
    // after that, both of which grow the page under the scroll that has just
    // been clamped to the old document height. One correction once they have
    // landed is the difference between arriving at the block and arriving 400px
    // above it.
    window.clearTimeout(correctionTimer.current);
    correctionTimer.current = window.setTimeout(
      () => panelRef.current?.scrollIntoView({ behavior, block: 'start' }),
      700
    );
  });

  // Cleared on unmount only; a re-render must not cancel a correction in flight.
  useEffect(() => () => window.clearTimeout(correctionTimer.current), []);

  // A hash set from outside this page — an old shared report link, a QR code,
  // the browser's back button — also picks the tab, and opens the confidence
  // expander when that is what it named.
  const applyHash = useCallback(() => {
    if (typeof window === 'undefined') return;
    const anchorId = window.location.hash.replace(/^#/, '');
    const key = evidenceForAnchor(anchorId);
    if (key) {
      setEvidence(key);
      pendingScroll.current = true;
    }
    if (anchorId === 'tour-optic-score') setConfidenceOpen(true);
  }, []);

  useEffect(() => {
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  // The shell writes the hash with replaceState, which fires no event, so the
  // anchor is handed over directly as well.
  useEffect(() => {
    const key = evidenceForAnchor(focusAnchor);
    if (key) {
      setEvidence(key);
      pendingScroll.current = true;
    }
    if (focusAnchor === 'tour-optic-score') setConfidenceOpen(true);
  }, [focusAnchor]);

  const gradingPasses = readGradingPasses(card);
  const structuralNote = readStructuralUnconfirmedNote(card);
  const hasUserReport = !!card?.has_user_condition_report && !!card?.user_condition_report;
  const frontUrl = vm.images.front.url;
  const backUrl = vm.images.back.url;
  const showCentering = hasCenteringData(card);
  const activeTab = EVIDENCE_TABS.find((tab) => tab.key === evidence) ?? EVIDENCE_TABS[0];

  return (
    <div className="cd-section" data-category={category}>
      <div className="cd-section-title">
        <p className="cd-eyebrow">The details make the grade</p>
        <h2>
          Why {vm.grade.gradeFormatted === 'N/A' ? 'this assessment' : `a ${vm.grade.gradeFormatted}`}?
        </h2>
        <p>The findings behind the grade, front and back.</p>
      </div>

      {/* Overall condition summary — owns #tour-condition-summary. */}
      <section id="tour-condition-summary" className="cd-panel">
        <h3>Overall card condition summary</h3>
        {vm.grade.summary ? (
          <p className="cd-finding-prose">{vm.grade.summary}</p>
        ) : (
          <p className="cd-caption">No written condition summary was saved with this grade.</p>
        )}
        {vm.grade.limitingFactor && (
          <p className="cd-caption">
            <strong>Limiting factor:</strong> {vm.grade.limitingFactor}
          </p>
        )}
        {vm.grade.status === 'not-gradable' && (
          <p className="cd-caption">
            <strong>Important:</strong> This card cannot receive a numerical grade due to the
            detected issues described below. Professional grading companies (PSA, BGS, SGC)
            also do not assign numerical grades to cards with these conditions.
          </p>
        )}
        {structuralNote && (
          <>
            <p className="cd-eyebrow">Surface line reviewed</p>
            <p className="cd-finding-prose">{structuralNote}</p>
          </>
        )}
      </section>

      {/* ── evidence: photo beside the findings ───────────────────────── */}
      <div className="cd-evidence-grid">
        <section className="cd-panel">
          <DefectInspection card={card} frontUrl={frontUrl} backUrl={backUrl} onZoom={onZoom} />
        </section>

        <section className="cd-panel">
          <div className="cd-evidence-tabs" role="tablist" aria-label="Grading evidence category">
            {EVIDENCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`cd-tab-${tab.key}`}
                aria-selected={tab.key === evidence}
                aria-controls={tab.anchorId}
                tabIndex={tab.key === evidence ? 0 : -1}
                onClick={() => setEvidence(tab.key)}
              >
                {tab.label}
                <b>{vm.grade.subgrades[tab.key] === null ? '—' : vm.grade.subgrades[tab.key]}</b>
              </button>
            ))}
          </div>

          {/* One panel, carrying the active block's anchor id so a deep link
              and a hero subgrade both land on the findings they named. */}
          <div
            ref={panelRef}
            id={activeTab.anchorId}
            role="tabpanel"
            aria-labelledby={`cd-tab-${activeTab.key}`}
            tabIndex={0}
          >
            {evidence === 'centering' &&
              (showCentering ? (
                <EvidenceCentering card={card} />
              ) : (
                <p className="cd-caption">No centering measurements were saved with this grade.</p>
              ))}
            {evidence === 'corners' && (
              <EvidenceCorners card={card} frontUrl={frontUrl} backUrl={backUrl} />
            )}
            {evidence === 'edges' && <EvidenceEdges card={card} />}
            {evidence === 'surface' && <EvidenceSurface card={card} />}
          </div>

          {/* `tour-optic-score` sits on the <details> itself, not on its body:
              a closed <details> hides its body, and the tour measures the
              element it is given. Targeting it opens the expander. */}
          <details
            className="cd-expander"
            id="tour-optic-score"
            open={confidenceOpen}
            onToggle={(e) => setConfidenceOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>Confidence &amp; image quality</summary>
            <div className="cd-expander-body">
              <ConfidencePanel card={card} />
            </div>
          </details>

          <details className="cd-expander">
            <summary>User-reported condition</summary>
            <div className="cd-expander-body">
              {hasUserReport ? (
                <ConditionReportDisplay
                  report={card.user_condition_report as UserConditionReportInput}
                  aiResponse={
                    card.user_condition_ai_response
                      ? {
                          hints_confirmed: card.user_condition_ai_response.hints_confirmed || [],
                          hints_not_visible:
                            card.user_condition_ai_response.hints_not_visible || [],
                          influenced_grade: card.user_report_influenced_grade || false,
                        }
                      : undefined
                  }
                />
              ) : (
                <p className="cd-caption">
                  No condition report was submitted with this card.
                </p>
              )}
            </div>
          </details>

          <details
            className="cd-expander"
            onToggle={(e) => setAnalysisOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>Full DCM Optic&trade; analysis</summary>
            <div className="cd-expander-body">
              {card?.conversational_grading ? (
                analysisOpen && <FullAnalysisReport card={card} />
              ) : (
                <p className="cd-caption">No analysis report was saved with this grade.</p>
              )}
            </div>
          </details>
        </section>
      </div>

      {gradingPasses && (
        <section className="cd-panel">
          <ThreePassSummary gradingPasses={gradingPasses} />
        </section>
      )}

      <section className="cd-panel">
        <ReportProvenance card={card} />
        <p className="cd-caption">
          DCM Optic&trade; grades from photographs. Defects outside the camera&rsquo;s view, and
          anything a protective case hides, are not assessed.
        </p>
      </section>

      {vm.permissions.isOwner && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GradeReviewButton cardId={vm.id} ownerId={card?.user_id} />
        </div>
      )}
    </div>
  );
}

export default GradeDetailsSection;
