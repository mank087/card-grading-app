'use client';

/**
 * The Reports tab — reports ONLY (owner review item 7).
 *
 * It used to mount the general `DownloadReportButton`, whose two dropdowns mix
 * printable slab / Avery labels in with the reports. Labels live in "Labels &
 * holders"; this tab is a grid of cards, one per report export, in the same
 * visual language as the holder cards: a heading, the format, one plain
 * sentence, and one download.
 *
 * Nothing here generates a file. Each card's action is the SAME
 * `DownloadReportButton` flow the menu opened, reached through that
 * component's additive `reportDownload` prop, so there is still exactly one
 * implementation of every export.
 *
 * `#tour-download-buttons` is on the grid, because that is what the onboarding
 * tour is pointing at.
 *
 * PHONES (≤760px, Sept 23 review, Phase 4 R): the same four cards render as a
 * compact list — name and format on one line, the purpose trimmed to one line
 * by CSS (the full sentence stays in the DOM for a screen reader), and the
 * download at the end of the row. Markup is unchanged; card-detail.css does it.
 */

import type { ReactNode } from 'react';
import { CARD_REPORT_EXPORTS } from '@/lib/cardDetail/reportExports';
import type { ReportDownloadKind } from '@/components/reports/DownloadReportButton';
import SectionTitle from '../SectionTitle';

export interface ReportsSectionProps {
  serial: string;
  isOwner: boolean;
  /** True when someone is signed in but does not own this card. */
  viewerSignedIn: boolean;
  /**
   * One trigger for one report export, supplied by the adapter. Omitted for a
   * visitor, who sees the card and a sign-in line instead of a dead button.
   */
  renderReportDownload?: (kind: ReportDownloadKind, label: string) => ReactNode;
}

export function ReportsSection({
  serial,
  isOwner,
  viewerSignedIn,
  renderReportDownload,
}: ReportsSectionProps) {
  return (
    <div className="cd-section">
      <SectionTitle
        eyebrow="Keep it. Share it. Show it."
        title="Your grading report, ready to go."
        phoneTitle="Reports"
        lead={
          <>
            Four ways to take this grade with you. Printable labels for a slab, a top loader or a
            One-Touch are in Labels &amp; holders.
          </>
        }
      />

      <p className="cd-caption">
        DCM serial <strong className="cd-serial">{serial}</strong>
      </p>

      {/* Once, above the list. It used to repeat on every one of the four
          report cards, which a visitor read four times in a row. */}
      {!(isOwner && renderReportDownload) && (
        <p className="cd-caption cd-report-locked">
          {viewerSignedIn ? (
            'Only the card’s owner can download these reports.'
          ) : (
            <>
              <a href="/login">Log in</a> as the card&rsquo;s owner to download these reports.
            </>
          )}
        </p>
      )}

      <div id="tour-download-buttons" className="cd-holder-cards cd-report-cards">
        {CARD_REPORT_EXPORTS.map((report) => (
          <section key={report.kind} className="cd-holder-card" aria-label={report.name}>
            <div className="cd-holder-card-body">
              <p className="cd-holder-tag">
                <span>{report.format}</span>
              </p>
              <h4 className="cd-holder-card-name">{report.name}</h4>
              <p className="cd-caption cd-report-purpose">{report.summary}</p>
            </div>

            {isOwner && renderReportDownload && (
              <div className="dcm-actions cd-holder-card-actions">
                {renderReportDownload(report.kind, report.action)}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export default ReportsSection;
