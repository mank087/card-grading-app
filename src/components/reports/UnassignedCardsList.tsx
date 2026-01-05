'use client';

import Image from 'next/image';

interface CardData {
  id: string;
  card_name?: string;
  serial?: string;
  front_image_url?: string;
  conversational_card_info?: {
    card_name?: string;
  };
}

interface UnassignedCardsListProps {
  cards: CardData[];
  assignedCardIds: Set<string>;
  onDragStart?: (cardId: string) => void;
}

export default function UnassignedCardsList({
  cards,
  assignedCardIds,
  onDragStart,
}: UnassignedCardsListProps) {
  const unassignedCards = cards.filter(card => !assignedCardIds.has(card.id));

  const getCardName = (card: CardData) => {
    return card.conversational_card_info?.card_name || card.card_name || 'Unknown Card';
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('cardId', cardId);
    e.dataTransfer.setData('fromPosition', ''); // Empty means from unassigned
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(cardId);
  };

  if (unassignedCards.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="text-green-600 text-2xl mb-2">✓</div>
        <p className="text-green-700 font-medium text-sm">All cards assigned!</p>
        <p className="text-green-600 text-xs mt-1">
          Drag cards on the grid to reorder
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-700 text-sm">Unassigned Cards</h4>
        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
          {unassignedCards.length}
        </span>
      </div>

      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        {unassignedCards.map((card) => (
          <div
            key={card.id}
            draggable
            onDragStart={(e) => handleDragStart(e, card.id)}
            className="
              flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200
              cursor-grab hover:border-purple-300 hover:shadow-sm
              active:cursor-grabbing transition-all
            "
          >
            {/* Drag handle */}
            <div className="text-gray-400 flex-shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
              </svg>
            </div>

            {/* Card thumbnail */}
            {card.front_image_url && (
              <div className="w-8 h-11 relative flex-shrink-0">
                <Image
                  src={card.front_image_url}
                  alt=""
                  fill
                  className="object-cover rounded"
                  sizes="32px"
                  unoptimized={card.front_image_url.includes('supabase')}
                />
              </div>
            )}

            {/* Card info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">
                {getCardName(card)}
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {card.serial || 'No serial'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 text-center mt-2">
        Drag cards to the sheet grid
      </p>
    </div>
  );
}
