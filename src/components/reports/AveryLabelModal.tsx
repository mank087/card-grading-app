'use client';

import React, { useState, useEffect } from 'react';
import { getAveryConfig, CalibrationOffsets } from '../../lib/averyLabelGenerator';

interface AveryLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (positionIndex: number, offsets: CalibrationOffsets) => void;
  isGenerating?: boolean;
}

const STORAGE_KEY = 'dcm_avery_last_position';
const CALIBRATION_STORAGE_KEY = 'dcm_avery_calibration';

export const AveryLabelModal: React.FC<AveryLabelModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isGenerating = false
}) => {
  const config = getAveryConfig();
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  const [offsetX, setOffsetX] = useState(0); // in inches
  const [offsetY, setOffsetY] = useState(0); // in inches

  // Load saved settings from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      // Load position
      const savedPosition = localStorage.getItem(STORAGE_KEY);
      if (savedPosition !== null) {
        const pos = parseInt(savedPosition, 10);
        if (!isNaN(pos) && pos >= 0 && pos < config.totalLabels) {
          setSelectedPosition(pos);
        }
      }

      // Load calibration offsets
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

  // Save settings and confirm
  const handleConfirm = () => {
    if (selectedPosition !== null) {
      localStorage.setItem(STORAGE_KEY, selectedPosition.toString());
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ x: offsetX, y: offsetY }));
      onConfirm(selectedPosition, { x: offsetX, y: offsetY });
    }
  };

  // Auto-increment to next position
  const handleAutoIncrement = () => {
    if (selectedPosition !== null && selectedPosition < config.totalLabels - 1) {
      setSelectedPosition(selectedPosition + 1);
    } else {
      setSelectedPosition(0); // Wrap to first position
    }
  };

  // Reset calibration to defaults
  const handleResetCalibration = () => {
    setOffsetX(0);
    setOffsetY(0);
  };

  // Format offset for display (show + for positive values)
  const formatOffset = (value: number): string => {
    const formatted = value.toFixed(3);
    return value >= 0 ? `+${formatted}` : formatted;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Print Avery Label</h2>
          <p className="text-purple-100 text-sm mt-1">
            {config.templateName} - {config.description}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 text-sm mb-4">
            Select the label position on the sheet where you want to print. This allows you to use partially used sheets without wasting labels.
          </p>

          {/* Position Grid */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 inline-block">
              {/* Sheet representation */}
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }}>
                {Array.from({ length: config.totalLabels }).map((_, index) => {
                  const isSelected = selectedPosition === index;
                  const row = Math.floor(index / config.columns) + 1;
                  const col = (index % config.columns) + 1;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedPosition(index)}
                      className={`
                        w-14 h-9 rounded border-2 text-xs font-medium transition-all
                        ${isSelected
                          ? 'bg-purple-600 border-purple-700 text-white shadow-md scale-105'
                          : 'bg-white border-gray-300 text-gray-500 hover:border-purple-400 hover:bg-purple-50'
                        }
                      `}
                      title={`Row ${row}, Column ${col}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              {/* Position info */}
              <div className="mt-3 text-center text-xs text-gray-500">
                {selectedPosition !== null ? (
                  <span>
                    Position {selectedPosition + 1} selected
                    (Row {Math.floor(selectedPosition / config.columns) + 1},
                    Column {(selectedPosition % config.columns) + 1})
                  </span>
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
                Next position ({selectedPosition < config.totalLabels - 1 ? selectedPosition + 2 : 1})
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setSelectedPosition(0)}
                className="text-xs text-purple-600 hover:text-purple-800 underline"
              >
                Reset to position 1
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
                  If labels print slightly off-center, adjust these offsets. Positive values move the label right/down, negative values move it left/up.
                </p>

                {/* Horizontal Offset */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">
                      Horizontal Offset
                    </label>
                    <span className="text-xs font-mono text-purple-600">
                      {formatOffset(offsetX)}"
                    </span>
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

                {/* Vertical Offset */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">
                      Vertical Offset
                    </label>
                    <span className="text-xs font-mono text-purple-600">
                      {formatOffset(offsetY)}"
                    </span>
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

                {/* Reset button */}
                <button
                  onClick={handleResetCalibration}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  Reset to default (0, 0)
                </button>

                {/* Calibration status */}
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
              <strong>Tip:</strong> Print at 100% scale (no scaling) for proper alignment. Your position and calibration settings are saved automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
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
                <span className="animate-spin">⏳</span>
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
