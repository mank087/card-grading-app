'use client';

/**
 * The full DCM Optic&trade; analysis report.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 6297-6904
 * [sports 6004-6611, identical]. The legacy page wraps this in its own header
 * with a "View Full Report" button; in V2 the expander in
 * `GradeDetailsSection` is that control, and this component is the body.
 *
 * The format fork is legacy's (6344-6358): try `JSON.parse`, and on failure
 * treat the report as markdown. The markdown branch's step order and section
 * titles live in `@/lib/cardDetail/reportMarkdown` with their own tests; the
 * JSON branch is `./FullAnalysisJson`.
 *
 * This file is loaded with `next/dynamic` by its caller: it is the largest
 * block on the page and almost nobody opens it.
 */

import { readReportSections, extractMeta } from '@/lib/cardDetail/reportMarkdown';
import FullAnalysisJson from './FullAnalysisJson';

export interface FullAnalysisReportProps {
  card: any;
}

export function FullAnalysisReport({ card }: FullAnalysisReportProps) {
  const report: string = card?.conversational_grading || '';
  if (!report) return null;

  let jsonData: any = null;
  try {
    jsonData = JSON.parse(report);
  } catch {
    jsonData = null;
  }

  if (jsonData) {
    return (
      <FullAnalysisJson
        jsonData={jsonData}
        createdAt={card?.created_at}
        processingTime={card?.processing_time}
      />
    );
  }

  const sections = readReportSections(report);
  const meta = extractMeta(report);

  return (
    <div className="cd-report">
      {sections.map((section) => (
        <section className="cd-report-section" key={section.title}>
          <h4>{section.title}</h4>
          <p className="cd-finding-prose" style={{ whiteSpace: 'pre-line' }}>
            {section.body}
          </p>
        </section>
      ))}

      {meta && (
        <section className="cd-report-section">
          <h4>Evaluation details</h4>
          <dl className="cd-findings">
            <div>
              <dt>Prompt version</dt>
              <dd>{meta.promptVersion}</dd>
            </div>
            <div>
              <dt>Evaluation date</dt>
              <dd>{meta.evaluationDate}</dd>
            </div>
            <div>
              <dt>Processing time</dt>
              <dd>
                {card?.processing_time ? `${(card.processing_time / 1000).toFixed(1)}s` : 'N/A'}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}

export default FullAnalysisReport;
