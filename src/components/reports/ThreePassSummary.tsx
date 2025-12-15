'use client';

import React from 'react';
import { GradingPasses } from '@/types/card';

interface ThreePassSummaryProps {
  gradingPasses: GradingPasses;
}

/**
 * Three-Pass Evaluation Summary Component (v5.5)
 * Displays the scores from three independent grading passes,
 * averaged results, and consistency metrics.
 */
export function ThreePassSummary({ gradingPasses }: ThreePassSummaryProps) {
  const { pass_1, pass_2, pass_3, averaged_rounded, variance, consistency, consensus_notes } = gradingPasses;

  // Helper to format score display - v6.0: Always whole numbers
  const formatScore = (score: number): string => {
    return Math.round(score).toString();
  };

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
        Three-Pass Evaluation Summary
      </h4>
      <p className="text-sm text-gray-600 mb-4">
        DCM Optic™ performs three independent evaluations of each card to ensure grading accuracy and reduce variance.
      </p>

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
            {/* Average Row */}
            <tr className="bg-indigo-50 font-semibold">
              <td className="px-4 py-3 text-sm font-bold text-indigo-800">Average</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.centering)}</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.corners)}</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.edges)}</td>
              <td className="px-4 py-3 text-center text-sm text-indigo-700">{formatScore(averaged_rounded.surface)}</td>
              <td className="px-4 py-3 text-center text-lg font-bold text-indigo-800">{formatScore(averaged_rounded.final)}</td>
            </tr>
          </tbody>
        </table>
      </div>

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

      {/* Consensus Notes */}
      {consensus_notes && consensus_notes.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h5 className="text-sm font-semibold text-amber-800 mb-2">
            Consensus Notes
          </h5>
          <ul className="space-y-1">
            {consensus_notes.map((note, index) => (
              <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ThreePassSummary;
