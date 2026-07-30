'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Drag behaviour for the collection.
 *
 * TWO gestures share one DndContext, which is why the context lives here at the
 * page level rather than around the grid:
 *
 *   1. Drag a card onto a BINDER CHIP  → files it into that binder. Works from
 *      any view, including All Cards. This is what people actually expect from
 *      "drag cards to a binder", and it was the missing half.
 *   2. Drag a card onto ANOTHER CARD   → reorders, but only inside a manual
 *      binder with no active sort.
 *
 * Drop targets are id-prefixed (`binder:<uuid>`) so onDragEnd can tell the two
 * apart without guessing.
 */

export const BINDER_DROP_PREFIX = 'binder:';

/**
 * Sentinel target for the "+ New binder" chip. Without its own droppable id the
 * chip isn't a drop target at all, so a card dropped on it falls through to
 * whichever real binder happens to be nearest — silently filing it somewhere
 * the user never chose.
 */
export const NEW_BINDER_DROP_ID = `${BINDER_DROP_PREFIX}__new__`;

/** Wrap a binder chip to make it a drop target. */
export function BinderDropTarget({
  binderId,
  disabled,
  children,
}: {
  binderId: string;
  disabled?: boolean;
  children: (isOver: boolean) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${BINDER_DROP_PREFIX}${binderId}`,
    disabled,
  });
  return <div ref={setNodeRef}>{children(isOver && !disabled)}</div>;
}

export function SortableCell({
  id,
  enabled,
  children,
}: {
  id: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enabled,
  });

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 10 : undefined,
        // Card tiles contain <a> and <img>, both natively draggable. Without
        // this the browser's own drag hijacks the gesture before dnd-kit's
        // threshold and the card never moves — you just get a ghost image.
        WebkitUserDrag: 'none',
      } as React.CSSProperties}
      onDragStart={(e) => e.preventDefault()}
      {...attributes}
      {...listeners}
      // NOT touch-none: that would stop the page scrolling wherever a card sits.
      // The TouchSensor's long-press activation handles scroll conflict instead.
      className="select-none cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

export function CollectionDnd({
  enabled,
  ids,
  canReorder,
  onReorder,
  onFileToBinder,
  dragPreview,
  children,
}: {
  /** Any dragging at all (i.e. the user has at least one binder). */
  enabled: boolean;
  ids: string[];
  /** Reordering additionally requires a manual binder and no active sort. */
  canReorder: boolean;
  onReorder: (movedId: string, afterId: string | null, nextIds: string[]) => void;
  onFileToBinder: (cardId: string, binderId: string) => void;
  /** Rendered under the cursor while dragging. */
  dragPreview?: (cardId: string) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Mouse and touch are deliberately separate sensors rather than one
  // PointerSensor.
  //
  // A PointerSensor needs `touch-action: none` on every draggable to stop the
  // browser scrolling mid-drag — and with dragging enabled across the whole
  // collection that would kill vertical scrolling on mobile, since every card
  // would swallow the gesture. Splitting them lets touch use a LONG PRESS
  // (250ms) to start a drag, so a normal swipe still scrolls the page, while
  // the mouse keeps the instant 8px threshold.
  const mouse = useSensor(MouseSensor, { activationConstraint: { distance: 8 } });
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } });
  const keyboard = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const active = useSensors(mouse, touch, keyboard);
  const none = useSensors();

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active: a, over } = event;
    if (!over) return;

    const cardId = String(a.id);
    const overId = String(over.id);

    // 1. Dropped on a binder chip → file it there.
    if (overId.startsWith(BINDER_DROP_PREFIX)) {
      onFileToBinder(cardId, overId.slice(BINDER_DROP_PREFIX.length));
      return;
    }

    // 2. Dropped on another card → reorder, if this view allows it.
    if (!canReorder || overId === cardId) return;
    const oldIndex = ids.indexOf(cardId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ids, oldIndex, newIndex);
    const movedIdx = next.indexOf(cardId);
    onReorder(cardId, movedIdx === 0 ? null : next[movedIdx - 1], next);
  };

  return (
    <DndContext
      sensors={enabled ? active : none}
      // pointerWithin resolves the binder chips (small targets outside the
      // grid) far more reliably than closestCenter, which biases toward the
      // large grid items; fall back to closestCenter for card-on-card.
      collisionDetection={(args) => {
        const hits = pointerWithin(args);
        return hits.length ? hits : closestCenter(args);
      }}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeId && dragPreview ? dragPreview(activeId) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Sortable list wrapper. The DndContext lives in CollectionDnd, above this. */
export function SortableGrid({
  ids,
  className,
  children,
}: {
  ids: string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <SortableContext items={ids} strategy={rectSortingStrategy}>
      <div className={className}>{children}</div>
    </SortableContext>
  );
}

export default SortableGrid;
