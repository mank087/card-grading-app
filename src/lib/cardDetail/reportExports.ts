/**
 * The REPORT exports the card detail page offers, as data.
 *
 * Owner review item 7: the Reports tab used to mount the general
 * `DownloadReportButton` menu, which mixes printable labels in with reports.
 * Labels belong to "Labels & holders"; this file is the reports half, and it
 * is only the reports.
 *
 * Each entry names one EXISTING flow inside `DownloadReportButton` — see its
 * additive `reportDownload` prop — so nothing here generates anything and
 * there is no second copy of a generator to drift.
 */

import type { ReportDownloadKind } from '@/components/reports/DownloadReportButton';

export interface CardReportExport {
  kind: ReportDownloadKind;
  /** The card's heading. */
  name: string;
  /** The file the reader gets, in a couple of words. */
  format: string;
  /** One plain sentence: what it is and what it is for. */
  summary: string;
  /** The button's own words. */
  action: string;
}

export const CARD_REPORT_EXPORTS: readonly CardReportExport[] = [
  {
    kind: 'report',
    name: 'Full grading report',
    format: 'PDF',
    summary:
      'Every finding behind the grade, front and back, with the photos and the subgrades — the document to keep or send with the card.',
    action: 'Download PDF',
  },
  {
    kind: 'mini-pdf',
    name: 'Mini-report',
    format: 'PDF',
    summary:
      'The same grade on one small page, sized to fold or cut to 2.5″ × 3.5″ so it travels with the card.',
    action: 'Download PDF',
  },
  {
    kind: 'mini-jpg',
    name: 'Mini-report image',
    format: 'Image',
    summary:
      'The mini-report as a picture, for a marketplace listing or a post.',
    action: 'Download image',
  },
  {
    kind: 'card-images',
    name: 'Card images with graded label',
    format: 'Front & back images',
    summary:
      'Your two photos, each with the grade label above it, ready to upload anywhere you sell or share.',
    action: 'Download images',
  },
] as const;
