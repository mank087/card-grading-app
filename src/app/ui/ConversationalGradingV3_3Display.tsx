'use client';

/**
 * Conversational Grading v3.3 Display Components
 *
 * UI components for displaying v3.3 enhanced grading features:
 * - Rarity classification
 * - Defect coordinate maps
 * - Grading metadata (pre-cap, rounding, verification)
 */

import React from 'react';
import type {
  RarityClassification,
  DefectCoordinate,
  GradingMetadataV3_3
} from '@/lib/conversationalGradingV3_3';

// ============================================================================
// RARITY CLASSIFICATION DISPLAY
// ============================================================================

interface RarityClassificationDisplayProps {
  rarity: RarityClassification;
}

export function RarityClassificationDisplay({ rarity }: RarityClassificationDisplayProps) {
  // Determine badge color based on rarity tier
  const getTierColor = (tier: string): string => {
    if (tier.includes('1-of-1') || tier.includes('Unique')) return 'from-purple-500 to-pink-600';
    if (tier.includes('SSP')) return 'from-red-500 to-orange-600';
    if (tier.includes('SP')) return 'from-orange-500 to-yellow-600';
    if (tier.includes('Autograph')) return 'from-blue-500 to-cyan-600';
    if (tier.includes('Memorabilia') || tier.includes('Relic')) return 'from-green-500 to-teal-600';
    if (tier.includes('Parallel') || tier.includes('Insert')) return 'from-indigo-500 to-purple-600';
    if (tier.includes('Rookie')) return 'from-yellow-500 to-amber-600';
    if (tier.includes('Limited Edition')) return 'from-blue-400 to-blue-600';
    if (tier.includes('Commemorative') || tier.includes('Promo')) return 'from-gray-400 to-gray-600';
    return 'from-gray-300 to-gray-500';
  };

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl shadow-lg p-6 border-2 border-yellow-200">
      <h3 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2">
        <span className="text-2xl">🏆</span>
        Rarity Classification
      </h3>

      <div className="space-y-4">
        {/* Primary Rarity Tier */}
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-700 min-w-[100px]">Tier:</span>
          <span className={`px-4 py-2 rounded-lg font-bold text-white bg-gradient-to-r ${getTierColor(rarity.rarity_tier)} shadow-md`}>
            {rarity.rarity_tier}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Serial Number */}
          {rarity.serial_number_fraction && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Serial:</span>
              <span className="px-3 py-1 bg-amber-100 rounded-md text-amber-900 font-bold border border-amber-300">
                {rarity.serial_number_fraction}
              </span>
            </div>
          )}

          {/* Autograph */}
          {rarity.autograph_type !== 'none' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Autograph:</span>
              <span className="px-3 py-1 bg-blue-100 rounded-md text-blue-900 border border-blue-300 capitalize">
                {rarity.autograph_type}
              </span>
            </div>
          )}

          {/* Memorabilia */}
          {rarity.memorabilia_type && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Memorabilia:</span>
              <span className="px-3 py-1 bg-green-100 rounded-md text-green-900 border border-green-300 capitalize">
                {rarity.memorabilia_type}
              </span>
            </div>
          )}

          {/* Finish/Material */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Finish:</span>
            <span className="px-3 py-1 bg-purple-100 rounded-md text-purple-900 border border-purple-300 capitalize">
              {rarity.finish_material}
            </span>
          </div>

          {/* Rookie Flag */}
          {rarity.rookie_flag === 'yes' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Rookie:</span>
              <span className="px-3 py-1 bg-red-100 rounded-md text-red-900 border border-red-300 font-bold">
                ⭐ ROOKIE CARD
              </span>
            </div>
          )}

          {/* Subset/Insert */}
          {rarity.subset_insert_name && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Subset:</span>
              <span className="text-gray-800">{rarity.subset_insert_name}</span>
            </div>
          )}
        </div>

        {/* Special Attributes */}
        {rarity.special_attributes.length > 0 && (
          <div>
            <span className="font-semibold text-gray-700 block mb-2">Special Attributes:</span>
            <div className="flex flex-wrap gap-2">
              {rarity.special_attributes.map((attr, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-indigo-100 rounded-md text-indigo-900 text-sm border border-indigo-300 capitalize"
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rarity Notes */}
        {rarity.rarity_notes && (
          <div className="mt-2 p-3 bg-amber-100/50 rounded-lg border border-amber-200">
            <span className="text-sm text-gray-700">{rarity.rarity_notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DEFECT COORDINATE MAP DISPLAY
// ============================================================================

interface DefectCoordinateMapProps {
  defects: DefectCoordinate[];
  side: 'front' | 'back';
  cardImageUrl?: string;
}

export function DefectCoordinateMap({ defects, side, cardImageUrl }: DefectCoordinateMapProps) {
  if (defects.length === 0) {
    return null;
  }

  // Color coding by severity
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'Microscopic': return 'bg-yellow-400 border-yellow-600';
      case 'Minor': return 'bg-orange-400 border-orange-600';
      case 'Moderate': return 'bg-red-400 border-red-600';
      case 'Heavy': return 'bg-red-600 border-red-800';
      default: return 'bg-gray-400 border-gray-600';
    }
  };

  // Icon by defect type
  const getDefectIcon = (type: string): string => {
    switch (type) {
      case 'scratch': return '╱';
      case 'dent': return '○';
      case 'crease': return '≋';
      case 'print_line': return '|';
      case 'pressure_mark': return '◉';
      default: return '•';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
      <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
        <span className="text-2xl">📍</span>
        {side === 'front' ? 'Front' : 'Back'} Defect Map
      </h3>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Visual Map */}
        <div className="relative w-full rounded-lg overflow-hidden border-4 border-gray-300 bg-gray-100" style={{ paddingBottom: '140%' }}>
          {/* Card outline */}
          <div className="absolute inset-0">
            {/* Background card image if available */}
            {cardImageUrl && (
              <img
                src={cardImageUrl}
                alt={`${side} card`}
                className="absolute inset-0 w-full h-full object-contain opacity-30"
              />
            )}

            {/* Defect markers */}
            {defects.map((defect, idx) => (
              <div
                key={idx}
                className={`absolute w-6 h-6 ${getSeverityColor(defect.severity)} rounded-full border-2 flex items-center justify-center text-white font-bold text-xs shadow-lg cursor-pointer hover:scale-125 transition-transform`}
                style={{
                  left: `${defect.x}%`,
                  top: `${defect.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                title={`${defect.defect_type} (${defect.severity}): ${defect.description}`}
              >
                {getDefectIcon(defect.defect_type)}
              </div>
            ))}
          </div>
        </div>

        {/* Defect Legend & List */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-2">Defects Detected: {defects.length}</div>

          {/* Legend */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-600 mb-2">SEVERITY LEGEND</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 border border-yellow-600 rounded-full"></div>
                <span>Microscopic</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-400 border border-orange-600 rounded-full"></div>
                <span>Minor</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-400 border border-red-600 rounded-full"></div>
                <span>Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-600 border border-red-800 rounded-full"></div>
                <span>Heavy</span>
              </div>
            </div>
          </div>

          {/* Defect List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {defects.map((defect, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 ${getSeverityColor(defect.severity)} rounded-full border`}></div>
                  <span className="font-semibold text-gray-800">({defect.x}%, {defect.y}%)</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-200 rounded capitalize">{defect.defect_type.replace('_', ' ')}</span>
                </div>
                <div className="text-gray-600 text-xs ml-5">
                  <span className="font-semibold">{defect.severity}:</span> {defect.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GRADING METADATA DISPLAY
// ============================================================================

interface GradingMetadataDisplayProps {
  metadata: GradingMetadataV3_3;
  finalGrade: number | null;
}

export function GradingMetadataDisplay({ metadata, finalGrade }: GradingMetadataDisplayProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 space-y-4">
      <h4 className="font-semibold text-gray-800 text-lg mb-3 flex items-center gap-2">
        <span className="text-xl">📊</span>
        Grade Calculation Details
      </h4>

      <div className="space-y-3 text-sm">
        {/* Weighted Total (Pre-Cap) */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
          <span className="text-gray-600 font-medium">Weighted Total (Pre-Cap):</span>
          <span className="font-bold text-lg text-blue-600">{metadata.weighted_total_pre_cap.toFixed(1)}</span>
        </div>

        {/* Final Grade (After Caps/Rounding) */}
        {finalGrade !== null && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-blue-300">
            <span className="text-gray-600 font-medium">Final Grade:</span>
            <span className="font-bold text-xl text-blue-700">{finalGrade.toFixed(1)}</span>
          </div>
        )}

        {/* Grade Cap Applied */}
        {metadata.capped_grade_reason && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-300">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-600 font-semibold">⚠️ Grade Cap Applied:</span>
            </div>
            <div className="text-amber-800 text-sm ml-6">
              {metadata.capped_grade_reason}
            </div>
          </div>
        )}

        {/* Conservative Rounding */}
        {metadata.conservative_rounding_applied && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-300">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-semibold">🔽 Conservative Rounding:</span>
              <span className="text-blue-800 text-sm">Applied due to uncertainty</span>
            </div>
          </div>
        )}

        {/* Cross-Side Verification */}
        {metadata.cross_side_verification_result && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-300">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-purple-600 font-semibold">🔍 Cross-Side Verification:</span>
            </div>
            <div className="text-purple-800 text-sm ml-6">
              {metadata.cross_side_verification_result}
            </div>
          </div>
        )}

        {/* Image Confidence */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
          <span className="text-gray-600 font-medium">Image Confidence:</span>
          <span className={`px-3 py-1 rounded-md font-bold ${
            metadata.image_confidence === 'A' ? 'bg-green-100 text-green-800' :
            metadata.image_confidence === 'B' ? 'bg-blue-100 text-blue-800' :
            metadata.image_confidence === 'C' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            Grade {metadata.image_confidence}
          </span>
        </div>

        {/* Lighting Conditions */}
        {metadata.lighting_conditions_notes && (
          <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
            <div className="text-gray-600 font-semibold mb-1">💡 Lighting Conditions:</div>
            <div className="text-gray-700 text-xs">
              {metadata.lighting_conditions_notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
