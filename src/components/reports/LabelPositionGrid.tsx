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
}

interface LabelPositionGridProps {
  positionMap: Map<string, number>; // cardId -> position (0-17)
  cards: CardData[];
  onCardDrop: (cardId: string, position: number) => void;
  onCardRemove: (cardId: string) => void;
  onSwap: (fromPosition: number, toPosition: number) => void;
}

const ROWS = 6;
const COLS = 3;
const TOTAL_POSITIONS = 18;

export default function LabelPositionGrid({
  positionMap,
  cards,
  onCardDrop,
  onCardRemove,
  onSwap,
}: LabelPositionGridProps) {
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

  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <div className="text-center mb-3">
        <h4 className="font-semibold text-gray-700 text-sm">Avery 6871 Sheet</h4>
        <p className="text-xs text-gray-500">3 x 6 grid (18 labels)</p>
      </div>

      <div
        className="grid gap-1.5 bg-white rounded-lg p-2 shadow-inner"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {Array.from({ length: TOTAL_POSITIONS }).map((_, index) => {
          const cardId = positionToCard.get(index);
          const card = cardId ? getCardById(cardId) : null;
          const isOccupied = !!card;
          const isDragOver = dragOverPosition === index;
          const isDragging = draggingFromPosition === index;

          return (
            <div
              key={index}
              className={`
                relative aspect-[2.375/1.25] rounded border-2 transition-all cursor-pointer
                ${isOccupied
                  ? 'border-purple-300 bg-purple-50'
                  : 'border-dashed border-gray-300 bg-gray-50 hover:border-purple-400'
                }
                ${isDragOver ? 'border-purple-500 bg-purple-100 scale-105' : ''}
                ${isDragging ? 'opacity-50' : ''}
              `}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => handleCellClick(index)}
              title={isOccupied ? `Click to remove: ${getCardName(card!)}` : `Position ${index + 1}`}
            >
              {isOccupied && card ? (
                <div
                  className="absolute inset-0 p-1 flex flex-col justify-center"
                  draggable
                  onDragStart={(e) => handleDragStart(e, cardId!, index)}
                >
                  <div className="flex items-center gap-1">
                    {card.front_image_url && (
                      <div className="w-6 h-8 relative flex-shrink-0">
                        <Image
                          src={card.front_image_url}
                          alt=""
                          fill
                          className="object-cover rounded-sm"
                          sizes="24px"
                          unoptimized={card.front_image_url.includes('supabase')}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-medium text-gray-800 truncate leading-tight">
                        {getCardName(card)}
                      </p>
                      <p className="text-[7px] text-gray-500 truncate">
                        {card.serial || 'No serial'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-gray-300">{index + 1}</span>
                </div>
              )}

              {/* Position badge */}
              <div className={`
                absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[8px] font-bold
                flex items-center justify-center
                ${isOccupied ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'}
              `}>
                {index + 1}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 text-center mt-2">
        Drag cards here or click to remove
      </p>
    </div>
  );
}
