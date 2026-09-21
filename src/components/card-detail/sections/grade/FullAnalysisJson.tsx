'use client';

/**
 * The full DCM Optic&trade; analysis, JSON form (report v4.0+).
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 6361-6727
 * [sports 6068-6434, identical]: card information, the three-pass summary, set
 * metadata, centering, corners, edges, surface, the final-grade calculation
 * and the evaluation-details footer, in that order (6692-6701).
 *
 * Every guard is legacy's: a section absent from the JSON renders nothing, an
 * empty-string field is skipped, and the literal string "null" is dropped from
 * the card back text only (6435).
 */

import { ThreePassSummary } from '@/components/reports/ThreePassSummary';
import type { GradingPasses } from '@/types/card';
import { formatGradedDate } from '@/lib/cardDetail/parsers';

const CORNER_POSITIONS = ['top_left', 'top_right', 'bottom_left', 'bottom_right'] as const;
const EDGE_POSITIONS = ['top', 'bottom', 'left', 'right'] as const;

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function Field({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{String(value)}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cd-report-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Sub({ title }: { title: string }) {
  return <p className="cd-eyebrow">{title}</p>;
}

function Note({ text }: { text: string }) {
  return <p className="cd-finding-prose">{text}</p>;
}

function Score({ score, label }: { score: number | string | undefined; label?: string }) {
  if (score === null || score === undefined) return null;
  return (
    <span className="cd-score-badge">
      {label ? `${label}: ` : ''}
      {score}/10
    </span>
  );
}

export interface FullAnalysisJsonProps {
  jsonData: any;
  /** `card.created_at` and `card.processing_time`, for the footer. */
  createdAt?: string | null;
  processingTime?: number | null;
}

export function FullAnalysisJson({
  jsonData,
  createdAt,
  processingTime,
}: FullAnalysisJsonProps) {
  const info = jsonData?.card_info;
  const meta = jsonData?.card_info?.set_metadata || jsonData?.set_metadata;
  const centering = jsonData?.centering;
  const corners = jsonData?.corners;
  const edges = jsonData?.edges;
  const surface = jsonData?.surface;
  const grade = jsonData?.final_grade || {
    decimal_grade: jsonData?.decimal_grade,
    whole_grade: jsonData?.whole_grade,
    grade_range: jsonData?.grade_range,
    condition_label: jsonData?.condition_label,
    summary: jsonData?.final_grade_summary,
  };
  const passes = jsonData?.grading_passes as GradingPasses | undefined;
  const promptVersion = jsonData?.prompt_version || jsonData?.metadata?.prompt_version;

  const renderCenteringSide = (side: any, label: string) => {
    if (!side) return null;
    return (
      <div key={label} className="cd-face">
        <Sub title={label} />
        <p className="cd-caption">
          {side.card_type && `Card type: ${side.card_type}. `}
          {side.measurement_method && `Measured using ${String(side.measurement_method).toLowerCase()}.`}
        </p>
        {side.measurements && <p className="cd-caption">{side.measurements}</p>}
        <dl className="cd-findings">
          <div>
            <dt>Left/Right</dt>
            <dd>{side.left_right || 'N/A'}</dd>
          </div>
          <div>
            <dt>Top/Bottom</dt>
            <dd>{side.top_bottom || 'N/A'}</dd>
          </div>
          <div>
            <dt>Worst axis</dt>
            <dd>{side.worst_axis || 'N/A'}</dd>
          </div>
          <div>
            <dt>Score</dt>
            <dd>{side.score || 'N/A'}/10</dd>
          </div>
        </dl>
        {side.quality_tier && (
          <p className="cd-caption">
            <strong>Quality tier:</strong> {side.quality_tier}
          </p>
        )}
        {side.analysis && <Note text={side.analysis} />}
      </div>
    );
  };

  const renderCornerSide = (side: any, label: string) => {
    if (!side) return null;
    return (
      <div key={label} className="cd-face">
        <Sub title={label} />
        {side.summary && <p className="cd-caption">{side.summary}</p>}
        <dl className="cd-findings">
          {CORNER_POSITIONS.map((pos) => {
            const corner = side[pos];
            if (!corner) return null;
            return (
              <div key={pos}>
                <dt>{formatLabel(pos)}</dt>
                <dd>
                  <Score score={corner.score} />
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="cd-caption">
          <strong>Overall score:</strong> <Score score={side.score} />
        </p>
      </div>
    );
  };

  const renderEdgeSide = (side: any, label: string) => {
    if (!side) return null;
    return (
      <div key={label} className="cd-face">
        <Sub title={label} />
        {side.summary && <p className="cd-caption">{side.summary}</p>}
        <dl className="cd-findings">
          {EDGE_POSITIONS.map((pos) => {
            const edge = side[pos];
            if (!edge) return null;
            return (
              <div key={pos}>
                <dt>{formatLabel(pos)}</dt>
                <dd>{edge.score}/10</dd>
              </div>
            );
          })}
        </dl>
        <p className="cd-caption">
          <strong>Overall score:</strong> <Score score={side.score} />
        </p>
      </div>
    );
  };

  const renderSurfaceSide = (side: any, label: string) => {
    if (!side) return null;
    return (
      <div key={label} className="cd-face">
        <Sub title={label} />
        {side.finish_type && (
          <p className="cd-caption">
            <strong>Finish type:</strong> {side.finish_type}
          </p>
        )}
        {side.condition && <p className="cd-caption">{side.condition}</p>}
        <p className="cd-caption">
          <strong>Score:</strong> <Score score={side.score} />
        </p>
        {side.summary && <Note text={side.summary} />}
      </div>
    );
  };

  return (
    <div className="cd-report">
      {info && (
        <Section title="Card information">
          <dl className="cd-findings">
            <Field label="Card Name" value={info.card_name} />
            <Field label="Set Name" value={info.set_name} />
            <Field label="Year" value={info.year} />
            <Field label="Manufacturer" value={info.manufacturer} />
            <Field label="Card Number" value={info.card_number} />
            <Field label="Authentic" value={info.authentic} />
            <Field label="Player Or Character" value={info.player_or_character} />
            <Field label="Pokemon Stage" value={info.pokemon_stage} />
            <Field label="Pokemon Type" value={info.pokemon_type} />
            <Field label="HP" value={info.hp} />
            <Field label="Card Type" value={info.card_type} />
            <Field label="Subset" value={info.subset} />
            <Field label="Serial Number" value={info.serial_number} />
            <Field label="Rarity Tier" value={info.rarity_tier} />
          </dl>
          {info.card_front_text && (
            <div>
              <p className="cd-eyebrow">Card front text</p>
              <p className="cd-finding-prose" style={{ whiteSpace: 'pre-line' }}>
                {info.card_front_text}
              </p>
            </div>
          )}
          {info.card_back_text && info.card_back_text !== 'null' && (
            <div>
              <p className="cd-eyebrow">Card back text</p>
              <p className="cd-finding-prose">{info.card_back_text}</p>
            </div>
          )}
        </Section>
      )}

      {passes && <ThreePassSummary gradingPasses={passes} />}

      {meta && (
        <Section title="Set metadata">
          {meta.set_identifier_reason && <p className="cd-caption">{meta.set_identifier_reason}</p>}
          <pre className="cd-pre">{JSON.stringify(meta, null, 2)}</pre>
        </Section>
      )}

      {centering && (
        <Section title="Centering analysis">
          <div className="cd-faces">
            {renderCenteringSide(centering.front, 'Front')}
            {renderCenteringSide(centering.back, 'Back')}
          </div>
        </Section>
      )}

      {corners && (
        <Section title="Corner analysis">
          <div className="cd-faces">
            {renderCornerSide(corners.front, 'Front')}
            {renderCornerSide(corners.back, 'Back')}
          </div>
        </Section>
      )}

      {edges && (
        <Section title="Edge analysis">
          <div className="cd-faces">
            {renderEdgeSide(edges.front, 'Front')}
            {renderEdgeSide(edges.back, 'Back')}
          </div>
        </Section>
      )}

      {surface && (
        <Section title="Surface analysis">
          <div className="cd-faces">
            {renderSurfaceSide(surface.front, 'Front')}
            {renderSurfaceSide(surface.back, 'Back')}
          </div>
        </Section>
      )}

      {grade && (
        <Section title="Final grade calculation">
          <dl className="cd-findings">
            <div>
              <dt>Decimal grade</dt>
              <dd>{grade.decimal_grade || 'N/A'}</dd>
            </div>
            <div>
              <dt>Whole grade</dt>
              <dd>{grade.whole_grade || 'N/A'}</dd>
            </div>
            <div>
              <dt>Grade range</dt>
              <dd>{grade.grade_range || 'N/A'}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{grade.condition_label || 'N/A'}</dd>
            </div>
          </dl>
          {grade.summary && <Note text={grade.summary} />}
        </Section>
      )}

      {promptVersion && (
        <Section title="Evaluation details">
          <dl className="cd-findings">
            <div>
              <dt>Prompt version</dt>
              <dd>{promptVersion}</dd>
            </div>
            <div>
              <dt>Evaluation date</dt>
              <dd>{formatGradedDate(createdAt)}</dd>
            </div>
            <div>
              <dt>Processing time</dt>
              <dd>{processingTime ? `${(processingTime / 1000).toFixed(1)}s` : 'N/A'}</dd>
            </div>
          </dl>
        </Section>
      )}
    </div>
  );
}

export default FullAnalysisJson;
