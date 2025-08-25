"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { DraggableSpecialistCard } from "./DraggableSpecialistCard";

interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  location: string | null;
  position: number;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface SortableSpecialistGridProps {
  specialists: Specialist[];
  onReorder: (positions: Array<{ id: string; position: number }>) => void;
}

export function SortableSpecialistGrid({ specialists, onReorder }: SortableSpecialistGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = specialists.findIndex((s) => s.id === active.id);
      const newIndex = specialists.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Calculate new order
        const newOrder = arrayMove(specialists, oldIndex, newIndex);
        
        // Create position updates
        const positionUpdates = newOrder.map((specialist, index) => ({
          id: specialist.id,
          position: index + 1, // Positions start from 1
        }));

        // Only send updates for specialists whose positions changed
        const changedPositions = positionUpdates.filter((update, idx) => {
          const original = specialists.find(s => s.id === update.id);
          return original && original.position !== update.position;
        });

        if (changedPositions.length > 0) {
          onReorder(changedPositions);
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={specialists.map((s) => s.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {specialists.map((specialist) => (
            <DraggableSpecialistCard
              key={specialist.id}
              specialist={specialist}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}