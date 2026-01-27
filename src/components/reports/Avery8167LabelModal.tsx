'use client';

import React, { useState, useEffect } from 'react';
import { getAvery8167Config, CalibrationOffsets } from '../../lib/avery8167LabelGenerator';

interface Avery8167LabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (frontPositionIndex: number, backPositionIndex: number, offsets: CalibrationOffsets) => void;
  isGenerating?: boolean;
}

const STORAGE_KEY = 'dcm_avery8167_last_position';
const CALIBRATION_STORAGE_KEY = 'dcm_avery8167_calibration';

export const Avery8167LabelModal: React.FC<Avery8167LabelModalProps> = ({
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

  // Load saved settings from localStorage on mount
  useEffect(() => {
    if (isOpen) {
      const savedPosition = localStorage.getItem(STORAGE_KEY);
      if (savedPosition !== null) {
        const pos = parseInt(savedPosition, 10);
        // Only restore if it's a valid front label position (columns 0 or 2)
        if (!isNaN(pos) && pos >= 0 && pos < config.totalLabels) {
          const col = pos % config.columns;
          if (col === 0 || col === 2) {
            setSelectedPosition(pos);
          }
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
  }, [isOpen, config.totalLabels, config.columns]);

  // Calculate the back label position (column to the right)
  const getBackPosition = (frontPos: number): number => {
    return frontPos + 1; // Back label is always one column to the right
  };

  // Check if a position is selectable (columns 0 or 2 only - front label columns)
  const isSelectablePosition = (index: number): boolean => {
    const col = index % config.columns;
    return col === 0 || col === 2;
  };

  // Check if a position is a back label position (columns 1 or 3)
  const isBackPosition = (index: number): boolean => {
    const col = index % config.columns;
    return col === 1 || col === 3;
  };

  // Check if this back position is paired with selected front
  const isPairedBack = (index: number): boolean => {
    if (selectedPosition === null) return false;
    return index === getBackPosition(selectedPosition);
  };

  const handleConfirm = () => {
    if (selectedPosition !== null) {
      const backPosition = getBackPosition(selectedPosition);
      localStorage.setItem(STORAGE_KEY, selectedPosition.toString());
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ x: offsetX, y: offsetY }));
      onConfirm(selectedPosition, backPosition, { x: offsetX, y: offsetY });
    }
  };

  const handleAutoIncrement = () => {
    if (selectedPosition === null) {
      setSelectedPosition(0); // Start at first position
      return;
    }

    // Find next valid front position
    let nextPos = selectedPosition + 2; // Skip the back column

    // If we're at the end of column 0 or 2, move to next row
    const currentCol = selectedPosition % config.columns;
    const currentRow = Math.floor(selectedPosition / config.columns);

    if (currentCol === 0) {
      // Move to column 2 in same row
      nextPos = selectedPosition + 2;
    } else if (currentCol === 2) {
      // Move to column 0 in next row
      nextPos = (currentRow + 1) * config.columns;
    }

    // Wrap around if needed
    if (nextPos >= config.totalLabels) {
      nextPos = 0;
    }

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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Print Toploader Labels</h2>
          <p className="text-purple-100 text-sm mt-1">
            {config.templateName} - {config.description}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-gray-600 text-sm mb-2">
            Select a <strong>front label</strong> position (purple columns). The back label will automatically print in the column to the right.
          </p>
          <div className="flex gap-4 text-xs text-gray-500 mb-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></span>
              Front (selectable)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></span>
              Back (auto-assigned)
            </span>
          </div>

          {/* Position Grid - 4 columns x 20 rows */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 inline-block">
              {/* Column headers */}
              <div className="grid gap-0.5 mb-1" style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }}>
                <div className="text-[8px] text-center text-purple-600 font-medium">Front</div>
                <div className="text-[8px] text-center text-gray-400">Back</div>
                <div className="text-[8px] text-center text-purple-600 font-medium">Front</div>
                <div className="text-[8px] text-center text-gray-400">Back</div>
              </div>

              <div
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: config.totalLabels }).map((_, index) => {
                  const isSelectable = isSelectablePosition(index);
                  const isBack = isBackPosition(index);
                  const isSelected = selectedPosition === index;
                  const isPaired = isPairedBack(index);
                  const row = Math.floor(index / config.columns) + 1;
                  const col = (index % config.columns) + 1;

                  return (
                    <button
                      key={index}
                      onClick={() => isSelectable && setSelectedPosition(index)}
                      disabled={!isSelectable}
                      className={`
                        w-10 h-4 rounded-sm border text-[8px] font-medium transition-all
                        ${isSelected
                          ? 'bg-purple-600 border-purple-700 text-white shadow-md'
                          : isPaired
                            ? 'bg-green-500 border-green-600 text-white'
                            : isSelectable
                              ? 'bg-purple-50 border-purple-300 text-purple-600 hover:bg-purple-100 hover:border-purple-400 cursor-pointer'
                              : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        }
                      `}
                      title={isSelectable
                        ? `Position ${index + 1} (Row ${row}, Col ${col}) - Click to select front label`
                        : isPaired
                          ? `Position ${index + 1} - Back label (auto-assigned)`
                          : `Position ${index + 1} - Back label column`
                      }
                    >
                      {isPaired ? 'B' : isSelected ? 'F' : index + 1}
                    </button>
                  );
                })}
              </div>

              {/* Position info */}
              <div className="mt-3 text-center text-xs text-gray-500">
                {selectedPosition !== null ? (
                  <span>
                    Front: Position {selectedPosition + 1} | Back: Position {getBackPosition(selectedPosition) + 1}
                  </span>
                ) : (
                  <span>Click a purple position to select</span>
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
                Next pair
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
              <strong>Tip:</strong> Both front and back labels will print on the same sheet. Apply front to toploader front, back to toploader back.
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
                <span className="animate-spin">⏳</span>
                Generating...
              </span>
            ) : (
              'Generate Labels'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
