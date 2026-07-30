'use client';

import React, { useState } from 'react';
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
 * Drag-to-reorder for a binder, shaped as a PROVIDER + CELL rather than a
 * render-prop grid so it can wrap the collection's existing (large, inline)
 * card markup without restructuring it.
 *
 *   <SortableGrid enabled={...} ids={...} onReorder={...} className="grid ...">
 *     {cards.map(c => <SortableCell key={c.id} id={c.id} enabled={...}>…</SortableCell>)}
 *   </SortableGrid>
 *
 * dnd-kit rather than native HTML5 drag events: HTML5 DnD has no touch support
 * (a lot of this traffic is mobile web) and no keyboard path. dnd-kit gives
 * pointer, touch and keyboard, which keeps reordering reachable without a mouse.
 *
 * When `enabled` is false both components render plain wrappers, so the
 * non-binder collection pays nothing.
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
  const sortable = useSortable({ id, disabled: !enabled });
  if (!enabled) return <>{children}</>;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing"
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
  const [, force] = useState(0);

  const sensors = useSensors(
    // 8px of travel before a drag begins, so a tap still opens the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!enabled) return <div className={className}>{children}</div>;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ids, oldIndex, newIndex);
    const movedIdx = next.indexOf(String(active.id));
    // The server takes "put it after X"; at index 0 there is no X.
    const afterId = movedIdx === 0 ? null : next[movedIdx - 1];

    onReorder(String(active.id), afterId, next);
    force(n => n + 1);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}

export default SortableGrid;
