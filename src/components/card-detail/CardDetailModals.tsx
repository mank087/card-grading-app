'use client';

/**
 * The delete confirm dialog the shell used to hold inline. Lifted out verbatim
 * so the shell stays composition; nothing about its markup or wording changed.
 *
 * The re-grade confirm and its insufficient-credits offer were removed on
 * 2026-10-15: DCM does not offer re-grades (the customer resubmits the card;
 * VIP / Card Lovers can request a grade review).
 */

export interface CardDetailModalsProps {
  showDelete: boolean;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

export function CardDetailModals({
  showDelete,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
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
    </>
  );
}

export default CardDetailModals;
