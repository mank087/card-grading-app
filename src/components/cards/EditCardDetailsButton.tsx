'use client';

import { useState } from 'react';
import EditCardDetailsModal from './EditCardDetailsModal';

interface CardData {
  id: string;
  user_id?: string;
  card_name?: string;
  featured?: string;
  card_set?: string;
  card_number?: string;
  release_date?: string;
  manufacturer_name?: string;
  serial_numbering?: string;
  autographed?: boolean;
  autograph_type?: string;
  rookie_card?: boolean;
  first_print_rookie?: boolean;
  memorabilia_type?: string;
  holofoil?: string;
  is_foil?: boolean;
  foil_type?: string;
  mtg_rarity?: string;
  is_double_faced?: boolean;
  mtg_set_code?: string;
  rarity_tier?: string;
  rarity_description?: string;
  category?: string;
  conversational_card_info?: Record<string, any>;
}

interface EditCardDetailsButtonProps {
  card: CardData;
  currentUserId?: string;
  onEditComplete: (updatedCard: CardData) => void;
  className?: string;
  variant?: 'default' | 'icon-only';
}

export default function EditCardDetailsButton({
  card,
  currentUserId,
  onEditComplete,
  className = '',
  variant = 'default'
}: EditCardDetailsButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only show button if user owns this card
  const isOwner = currentUserId && card.user_id === currentUserId;

  if (!isOwner) {
    return null;
  }

  const handleSave = (updatedCard: CardData) => {
    onEditComplete(updatedCard);
  };

  if (variant === 'icon-only') {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors ${className}`}
          title="Edit Card Details"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <EditCardDetailsModal
          card={card}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="hidden sm:inline">Edit Details</span>
      </button>

      <EditCardDetailsModal
        card={card}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
