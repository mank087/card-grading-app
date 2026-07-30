'use client';

import React from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
 * Drag-to-reorder for a binder, shaped as a PROVIDER + CELL so it can wrap the
 * collection's existing (large, inline) card markup without restructuring it.
 *
 *   <SortableGrid enabled={...} ids={...} onReorder={...} className="grid ...">
 *     {cards.map(c => <SortableCell key={c.id} id={c.id} enabled={...}>…</SortableCell>)}
 *   </SortableGrid>
 *
 * The contexts are ALWAYS rendered, with the sensors gated on `enabled`, rather
 * than conditionally wrapping the tree. Two reasons: useSortable outside a
 * SortableContext warns and misbehaves, and flipping the tree structure when a
 * binder is selected would remount every card. With no sensors the contexts are
 * inert, so the plain collection pays nothing.
 *
 * dnd-kit rather than native HTML5 drag events: HTML5 DnD has no touch support
 * (much of this traffic is mobile web) and no keyboard path.
 */

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
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
        // Without this the browser's own image/link dragging hijacks the
        // gesture before dnd-kit's 8px threshold is reached, and the card never
        // moves — it just shows a ghost image.
        WebkitUserDrag: 'none',
      } as React.CSSProperties}
      // Belt and braces for the same problem: card tiles contain <a> and <img>,
      // both natively draggable.
      onDragStart={(e) => e.preventDefault()}
      {...attributes}
      {...listeners}
      className="touch-none select-none cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

export function SortableGrid({
  enabled,
  ids,
  onReorder,
  className,
  children,
}: {
  enabled: boolean;
  ids: string[];
  /** (movedId, afterId|null, nextIds) — afterId is the anchor the server needs. */
  onReorder: (movedId: string, afterId: string | null, nextIds: string[]) => void;
  className?: string;
  children: React.ReactNode;
}) {
  // 8px of travel before a drag begins, so a tap still opens the card.
  const pointer = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboard = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const active = useSensors(pointer, keyboard);
  const none = useSensors();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;

    const oldIndex = ids.indexOf(String(a.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ids, oldIndex, newIndex);
    const movedIdx = next.indexOf(String(a.id));
    // The server takes "put it after X"; at index 0 there is no X.
    onReorder(String(a.id), movedIdx === 0 ? null : next[movedIdx - 1], next);
  };

  return (
    <DndContext
      sensors={enabled ? active : none}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}

export default SortableGrid;
