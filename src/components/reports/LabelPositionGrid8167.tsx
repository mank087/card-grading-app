'use client';

import { useState } from 'react';
import Image from 'next/image';

interface CardData {
  id: string;
  card_name?: string;
  serial?: string;
  front_image_url?: string;
  conversational_card_info?: {
    card_name?: string;
  };
  conversational_whole_grade?: number | null;
  conversational_condition_label?: string | null;
}

interface LabelPositionGrid8167Props {
  positionMap: Map<string, number>; // cardId -> position (0-39 for single page)
  cards: CardData[];
  onCardDrop: (cardId: string, position: number) => void;
  onCardRemove: (cardId: string) => void;
  onSwap: (fromPosition: number, toPosition: number) => void;
  pageNumber?: number; // Optional page number for multi-page display
}

// 8167 layout: 4 columns (F|B|F|B) × 20 rows = 80 labels
// But we show 2 card positions per row (each card = front + back)
const ROWS = 20;
const CARD_COLS = 2; // 2 card positions per row
const TOTAL_CARD_POSITIONS = 40; // 40 cards per page

export default function LabelPositionGrid8167({
  positionMap,
  cards,
  onCardDrop,
  onCardRemove,
  onSwap,
  pageNumber,
}: LabelPositionGrid8167Props) {
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);
  const [draggingFromPosition, setDraggingFromPosition] = useState<number | null>(null);

  // Create reverse map: position -> cardId
  const positionToCard = new Map<number, string>();
  positionMap.forEach((position, cardId) => {
    positionToCard.set(position, cardId);
  });

  const getCardById = (cardId: string) => cards.find(c => c.id === cardId);

  const getCardName = (card: CardData) => {
    return card.conversational_card_info?.card_name || card.card_name || 'Unknown Card';
  };

  const handleDragOver = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    setDragOverPosition(position);
  };

  const handleDragLeave = () => {
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    setDragOverPosition(null);

    const cardId = e.dataTransfer.getData('cardId');
    const fromPosition = e.dataTransfer.getData('fromPosition');

    if (!cardId) return;

    // Check if target position is occupied
    const existingCardId = positionToCard.get(position);

    if (fromPosition !== '' && existingCardId) {
      // Swap cards
      onSwap(parseInt(fromPosition), position);
    } else if (existingCardId && existingCardId !== cardId) {
      // Target occupied, swap with incoming card
      const incomingCurrentPos = positionMap.get(cardId);
      if (incomingCurrentPos !== undefined) {
        onSwap(incomingCurrentPos, position);
      } else {
        // Coming from unassigned, swap out the existing card
        onCardRemove(existingCardId);
        onCardDrop(cardId, position);
      }
    } else {
      // Empty cell, just place the card
      onCardDrop(cardId, position);
    }

    setDraggingFromPosition(null);
  };

  const handleDragStart = (e: React.DragEvent, cardId: string, position: number) => {
    e.dataTransfer.setData('cardId', cardId);
    e.dataTransfer.setData('fromPosition', position.toString());
    setDraggingFromPosition(position);
  };

  const handleCellClick = (position: number) => {
    const cardId = positionToCard.get(position);
    if (cardId) {
      onCardRemove(cardId);
    }
  };

  // Convert card position (0-39) to row/col for display
  const positionToRowCol = (pos: number) => {
    const row = Math.floor(pos / CARD_COLS);
    const col = pos % CARD_COLS;
    return { row, col };
  };

  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <div className="text-center mb-3">
        <h4 className="font-semibold text-gray-700 text-sm">
          Avery 8167 Sheet{pageNumber ? ` - Page ${pageNumber}` : ''}
        </h4>
        <p className="text-xs text-gray-500">2 × 20 grid (40 card pairs per page)</p>
        <p className="text-[10px] text-gray-400 mt-1">Each position = Front + Back label</p>
      </div>

      {/* Column headers */}
      <div className="grid gap-1 mb-1 px-1" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="text-[10px] text-center text-purple-600 font-medium">Card Pair 1</div>
        <div className="text-[10px] text-center text-purple-600 font-medium">Card Pair 2</div>
      </div>

      {/* Scrollable grid container */}
      <div className="bg-white rounded-lg p-2 shadow-inner max-h-[400px] overflow-y-auto">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
        >
          {Array.from({ length: TOTAL_CARD_POSITIONS }).map((_, index) => {
            const cardId = positionToCard.get(index);
            const card = cardId ? getCardById(cardId) : null;
            const isOccupied = !!card;
            const isDragOver = dragOverPosition === index;
            const isDragging = draggingFromPosition === index;
            const { row } = positionToRowCol(index);

            return (
              <div
                key={index}
                className={`
                  relative h-10 rounded border-2 transition-all cursor-pointer
                  ${isOccupied
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-dashed border-gray-300 bg-gray-50 hover:border-purple-400'
                  }
                  ${isDragOver ? 'border-purple-500 bg-purple-100 scale-[1.02]' : ''}
                  ${isDragging ? 'opacity-50' : ''}
                  ${row % 2 === 0 ? '' : 'bg-opacity-70'}
                `}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => handleCellClick(index)}
                title={isOccupied ? `Click to remove: ${getCardName(card!)}` : `Position ${index + 1} (Row ${row + 1})`}
              >
                {isOccupied && card ? (
                  <div
                    className="absolute inset-0 p-1 flex items-center"
                    draggable
                    onDragStart={(e) => handleDragStart(e, cardId!, index)}
                  >
                    <div className="flex items-center gap-1 w-full">
                      {card.front_image_url && (
                        <div className="w-5 h-7 relative flex-shrink-0">
                          <Image
                            src={card.front_image_url}
                            alt=""
                            fill
                            className="object-cover rounded-sm"
                            sizes="20px"
                            unoptimized={card.front_image_url.includes('supabase')}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[8px] font-medium text-gray-800 truncate leading-tight">
                          {getCardName(card)}
                        </p>
                        {card.conversational_whole_grade && (
                          <p className="text-[7px] text-purple-600 font-semibold">
                            Grade: {card.conversational_whole_grade}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-300">{index + 1}</span>
                  </div>
                )}

                {/* Position badge */}
                <div className={`
                  absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full text-[7px] font-bold
                  flex items-center justify-center
                  ${isOccupied ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'}
                `}>
                  {index + 1}
                </div>

                {/* Row indicator on left edge */}
                {index % CARD_COLS === 0 && (
                  <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 -translate-x-full pr-1">
                    <span className="text-[8px] text-gray-400">{row + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center mt-2">
        Drag cards here or click to remove
      </p>
    </div>
  );
}
