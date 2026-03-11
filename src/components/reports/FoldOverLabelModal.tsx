'use client';

import React, { useState, useEffect } from 'react';
import { getAvery8167Config, CalibrationOffsets } from '../../lib/avery8167LabelGenerator';

interface FoldOverLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (positionIndex: number, offsets: CalibrationOffsets) => void;
  isGenerating?: boolean;
}

const STORAGE_KEY = 'dcm_foldover_last_position';
const CALIBRATION_STORAGE_KEY = 'dcm_avery8167_calibration';

export const FoldOverLabelModal: React.FC<FoldOverLabelModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isGenerating = false
}) => {
  const config = getAvery8167Config();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const savedPosition = localStorage.getItem(STORAGE_KEY);
      if (savedPosition !== null) {
        const pos = parseInt(savedPosition, 10);
        if (!isNaN(pos) && pos >= 0 && pos < config.totalLabels) {
          setSelectedPosition(pos);
        }
      }

      const savedCalibration = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (savedCalibration) {
        try {
          const cal = JSON.parse(savedCalibration);
          if (typeof cal.x === 'number') setOffsetX(cal.x);
          if (typeof cal.y === 'number') setOffsetY(cal.y);
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [isOpen, config.totalLabels]);

  const handleConfirm = () => {
    if (selectedPosition !== null) {
      localStorage.setItem(STORAGE_KEY, selectedPosition.toString());
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ x: offsetX, y: offsetY }));
      onConfirm(selectedPosition, { x: offsetX, y: offsetY });
    }
  };

  const handleAutoIncrement = () => {
    if (selectedPosition === null) {
      setSelectedPosition(0);
      return;
    }
    const nextPos = (selectedPosition + 1) % config.totalLabels;
    setSelectedPosition(nextPos);
  };

  const handleResetCalibration = () => {
    setOffsetX(0);
    setOffsetY(0);
  };

  const formatOffset = (value: number): string => {
    const formatted = value.toFixed(3);
    return value >= 0 ? `+${formatted}` : formatted;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Fold-Over Toploader Label</h2>
          <p className="text-purple-100 text-sm mt-1">
            {config.templateName} - Folds over toploader edge
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-gray-600 text-sm mb-2">
            Select a label position. Each card uses <strong>one label</strong> that folds over the top edge of the toploader.
          </p>
          <div className="flex gap-4 text-xs text-gray-500 mb-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-purple-50 border border-purple-300 rounded"></span>
              Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-purple-600 border border-purple-700 rounded"></span>
              Selected
            </span>
          </div>

          {/* How it works */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
            <p className="text-gray-700 text-xs font-medium mb-1">How it works:</p>
            <p className="text-gray-500 text-xs">
              The label prints with the grade on the left and a QR code on the right.
              Fold it over the top of your toploader — grade faces front, QR faces back.
            </p>
          </div>

          {/* Position Grid - 4 columns x 20 rows */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 inline-block">
              <div
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: config.totalLabels }).map((_, index) => {
                  const isSelected = selectedPosition === index;
                  const row = Math.floor(index / config.columns) + 1;
                  const col = (index % config.columns) + 1;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedPosition(index)}
                      className={`
                        w-10 h-4 rounded-sm border text-[8px] font-medium transition-all cursor-pointer
                        ${isSelected
                          ? 'bg-purple-600 border-purple-700 text-white shadow-md'
                          : 'bg-purple-50 border-purple-300 text-purple-600 hover:bg-purple-100 hover:border-purple-400'
                        }
                      `}
                      title={`Position ${index + 1} (Row ${row}, Col ${col})`}
                    >
                      {isSelected ? 'F' : index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 text-center text-xs text-gray-500">
                {selectedPosition !== null ? (
                  <span>Selected: Position {selectedPosition + 1}</span>
                ) : (
                  <span>Click a position to select</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          {selectedPosition !== null && (
            <div className="flex justify-center gap-2 mb-4">
              <button
                onClick={handleAutoIncrement}
                className="text-xs text-purple-600 hover:text-purple-800 underline"
              >
                Next position
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setSelectedPosition(0)}
                className="text-xs text-purple-600 hover:text-purple-800 underline"
              >
                Reset to first
              </button>
            </div>
          )}

          {/* Calibration Section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <button
              onClick={() => setShowCalibration(!showCalibration)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-sm font-medium text-gray-700 transition-colors"
            >
              <span>Printer Calibration</span>
              <span className={`transform transition-transform ${showCalibration ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showCalibration && (
              <div className="p-4 bg-white border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-4">
                  If labels print slightly off-center, adjust these offsets.
                </p>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Horizontal Offset</label>
                    <span className="text-xs font-mono text-purple-600">{formatOffset(offsetX)}"</span>
                  </div>
                  <input
                    type="range"
                    min="-0.1"
                    max="0.1"
                    step="0.005"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>-0.1" (left)</span>
                    <span>0</span>
                    <span>+0.1" (right)</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Vertical Offset</label>
                    <span className="text-xs font-mono text-purple-600">{formatOffset(offsetY)}"</span>
                  </div>
                  <input
                    type="range"
                    min="-0.1"
                    max="0.1"
                    step="0.005"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>-0.1" (up)</span>
                    <span>0</span>
                    <span>+0.1" (down)</span>
                  </div>
                </div>

                <button
                  onClick={handleResetCalibration}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  Reset to default (0, 0)
                </button>

                {(offsetX !== 0 || offsetY !== 0) && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded p-2">
                    <p className="text-xs text-purple-700">
                      Custom calibration active: {formatOffset(offsetX)}" horizontal, {formatOffset(offsetY)}" vertical
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-amber-800 text-xs">
              <strong>Tip:</strong> Apply the label centered on the toploader's top edge, then fold it over. The grade will be visible on the front and the QR code on the back.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedPosition === null || isGenerating}
            className={`
              px-6 py-2 rounded-lg font-semibold transition-all
              ${selectedPosition !== null && !isGenerating
                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">&#9203;</span>
                Generating...
              </span>
            ) : (
              'Generate Label'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
