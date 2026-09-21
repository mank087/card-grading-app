'use client';

/**
 * The three confirm dialogs the shell used to hold inline — delete, re-grade
 * and the insufficient-credits offer. Lifted out verbatim so the shell stays
 * composition; nothing about their markup or wording changed.
 */

import Link from 'next/link';

export interface CardDetailModalsProps {
  showDelete: boolean;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;

  showRegradeConfirm: boolean;
  onCloseRegrade: () => void;
  onConfirmRegrade: () => void;

  showInsufficientCredits: boolean;
  onCloseInsufficientCredits: () => void;

  balance: number;
}

export function CardDetailModals({
  showDelete,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
  showRegradeConfirm,
  onCloseRegrade,
  onConfirmRegrade,
  showInsufficientCredits,
  onCloseInsufficientCredits,
  balance,
}: CardDetailModalsProps) {
  return (
    <>
      {showDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Delete card from collection
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              This permanently removes the card and all associated data from the system.
            </p>
            <p className="text-xs text-red-600 text-center mb-6 font-medium">
              ⚠️ This action is non-reversible
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onCloseDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegradeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Re-grade this card?
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              This re-analyses the card using the <strong>same uploaded images</strong> with the
              latest DCM Optic™ grading system. The new grade <strong>replaces</strong> the
              current one.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 text-center font-medium">
                This will use 1 credit from your balance.
              </p>
              <p className="text-xs text-amber-600 text-center mt-1">
                Current balance: {balance} credit{balance !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onCloseRegrade}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmRegrade}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Re-grade card (1 credit)
              </button>
            </div>
          </div>
        </div>
      )}

      {showInsufficientCredits && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Insufficient credits</h2>
            <p className="text-gray-600 mb-4">You need 1 credit to re-grade this card.</p>
            <div className="bg-gray-100 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-600">Current balance</p>
              <p className="text-2xl font-bold text-gray-900">{balance} credits</p>
            </div>
            <div className="space-y-2">
              <Link
                href="/credits"
                className="block w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl"
              >
                Purchase credits
              </Link>
              <button
                onClick={onCloseInsufficientCredits}
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CardDetailModals;
