'use client';

import React from 'react';
import { GradeHold, GradingPasses } from '@/types/card';

interface ThreePassSummaryProps {
  gradingPasses: GradingPasses;
}

/**
 * Three-Pass Evaluation Summary Component (v5.5)
 * Displays the scores from three independent grading passes,
 * averaged results, and consistency metrics.
 */
export function ThreePassSummary({ gradingPasses }: ThreePassSummaryProps) {
  // Guard against missing data
  if (!gradingPasses) return null;

  const { pass_1, pass_2, pass_3, averaged_rounded, variance, consistency, consensus_notes } = gradingPasses;

  // Guard against missing pass data
  if (!pass_1 || !pass_2 || !pass_3 || !averaged_rounded) {
    console.warn('[ThreePassSummary] Missing pass data:', { pass_1: !!pass_1, pass_2: !!pass_2, pass_3: !!pass_3, averaged_rounded: !!averaged_rounded });
    return null;
  }

  // Helper to format score display - v6.0: Always whole numbers
  const formatScore = (score: number | undefined): string => {
    if (score === undefined || score === null) return 'N/A';
    return Math.round(score).toString();
  };

  // Filter out internal/dev boilerplate — users should only see notes that
  // explain WHY the consensus differs (zoom inspection, structural findings),
  // not implementation chatter like "v8.9 server-side ensemble (n=3)".
  const userNotes = (consensus_notes || []).filter((n) => {
    const t = String(n).toLowerCase();
    return !(
      t.includes('server-side ensemble') ||
      t.includes('median consensus') ||
      /\bn\s*=\s*3\b/.test(t) ||
      /^v\d+\.\d+\b/.test(String(n).trim())
    );
  });
  const hasConsensusNotes = userNotes.length > 0;

  // Helper to get consistency color
  const getConsistencyColor = (cons: string): string => {
    switch (cons) {
      case 'high':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Helper to get consistency icon
  const getConsistencyIcon = (cons: string): string => {
    switch (cons) {
      case 'high':
        return '✓';
      case 'moderate':
        return '⚠';
      case 'low':
        return '!';
      default:
        return '?';
    }
  };

  return (
    <div className="mt-8 pt-8 border-t-2 border-indigo-100">
      <h4 className="text-xl font-bold text-indigo-900 mb-4 pb-2 border-b border-indigo-200">
        {(gradingPasses as GradingPasses & { review_applied?: boolean }).review_applied ? 'Original Evaluations & Reviewed Result' : 'Three-Pass Evaluation Summary'}
      </h4>
      <p className="text-sm text-gray-600 mb-4">
        DCM Optic™ performs three independent evaluations of each card — each incorporating a magnified zoom inspection of the corners, edges, and surfaces — and takes the median as the consensus grade.
      </p>

      <GradeHoldNotice hold={gradingPasses.grade_hold} />

      {/* Scores Table */}
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gradient-to-r from-indigo-100 to-purple-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pass</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Centering</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Corners</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Edges</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Surface</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-indigo-800">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Pass 1 */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">Pass 1</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_1.centering)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_1.corners)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_1.edges)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_1.surface)}</td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-indigo-700">{formatScore(pass_1.final)}</td>
            </tr>
            {/* Pass 2 */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">Pass 2</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_2.centering)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_2.corners)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_2.edges)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_2.surface)}</td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-indigo-700">{formatScore(pass_2.final)}</td>
            </tr>
            {/* Pass 3 */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-700">Pass 3</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_3.centering)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_3.corners)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_3.edges)}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">{formatScore(pass_3.surface)}</td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-indigo-700">{formatScore(pass_3.final)}</td>
            </tr>
            {/* Divider */}
            <tr className="bg-gray-100">
              <td colSpan={6} className="px-4 py-1"></td>
            </tr>
            {/* Consensus Row */}
            <tr className="bg-indigo-50 font-semibold">
              <td className="px-4 py-3 text-sm font-bold text-indigo-800">{(gradingPasses as GradingPasses & { review_applied?: boolean }).review_applied ? 'Reviewed result' : 'Consensus'}</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.centering)}</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.corners)}</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.edges)}</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.surface)}</td>
              <td className="px-4 py-3 text-center text-lg font-bold text-indigo-800">{formatScore(averaged_rounded.final)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Magnified-inspection findings. Zoom caps are now folded into every pass
          row (so the table is internally coherent — no "10/10/10 → 8" jump); this
          lists what the 24-crop inspection actually found on corners/edges/surface. */}
      {hasConsensusNotes && (
        <div className="-mt-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h5 className="text-sm font-semibold text-amber-800 mb-1.5 flex items-center gap-2">
            <span aria-hidden>🔍</span> Magnified inspection findings
          </h5>
          <ul className="space-y-1">
            {userNotes.map((note, index) => (
              <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Consistency and Variance */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getConsistencyColor(consistency)}`}>
          <span className="text-lg font-bold">{getConsistencyIcon(consistency)}</span>
          <span className="text-sm font-semibold">
            Consistency: <span className="capitalize">{consistency}</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
          <span className="text-sm font-semibold">
            Variance: {variance.toFixed(1)}
          </span>
        </div>
      </div>

    </div>
  );
}

export default ThreePassSummary;

const HOLD_TITLES: Record<GradeHold['cause'], string> = {
  clipped_corner: 'Held at 9: part of the card is outside the photo',
  regions_uninspected: 'Held at 9: some edges or corners could not be inspected up close',
  holder: 'Held at 9: photographed in a holder',
  rigid_holder: 'Held at 9: photographed in a rigid holder',
  possible_damage_unconfirmed: 'Held at 9: a possible crease was not confirmed',
  evaluations_disagree: 'Held at 9: the evaluations did not agree closely enough',
  evaluation_dissent: 'Held at 9: one evaluation scored it lower',
  image_quality: 'Held at 9: the photos limit what could be confirmed',
};

/**
 * Says plainly that a grade was HELD for evidence, not lowered for condition. The
 * subgrade tiles follow the final grade (labels and listings rely on that), so without
 * this a held card reads as four separate deductions that no evaluation ever made.
 */
export function GradeHoldNotice({ hold }: { hold?: GradeHold }) {
  if (!hold?.held) return null;
  const { pass_1, pass_2, pass_3 } = hold.evaluations || ({} as GradeHold['evaluations']);
  const unanimous = [pass_1, pass_2, pass_3].every(score => score === hold.from);
  return (
    <div role="note" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">{HOLD_TITLES[hold.cause] || `Held at ${hold.to}`}</p>
      <p className="mt-1 text-sm text-amber-900">
        {unanimous
          ? `All three evaluations scored this card ${hold.from}. No condition flaw lowered it.`
          : `The evaluations scored this card ${pass_1}, ${pass_2} and ${pass_3}.`}{' '}
        The final grade is held at {hold.to} because {hold.reason}.
      </p>
      {hold.advice && <p className="mt-2 text-sm text-amber-800">{hold.advice}</p>}
      <p className="mt-2 text-xs text-amber-700">
        The consensus row below shows {hold.to} in every category because a final grade is never higher than its lowest category. They are not four separate deductions.
      </p>
    </div>
  );
}
