import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Mail, User, GripVertical } from "lucide-react";

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

interface DraggableSpecialistCardProps {
  specialist: Specialist;
  onClick?: () => void;
}

export function DraggableSpecialistCard({ specialist, onClick }: DraggableSpecialistCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: specialist.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={`p-4 relative ${isDragging ? "shadow-lg" : ""} cursor-pointer hover:shadow-md transition-shadow`}
        onClick={(e) => {
          // Don't trigger click when dragging
          const target = e.target as HTMLElement;
          if (!target.closest('[data-drag-handle]')) {
            onClick?.();
          }
        }}>
        {/* Drag Handle */}
        <div 
          className="absolute top-4 right-4 cursor-move text-muted-foreground hover:text-foreground touch-none"
          data-drag-handle
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Position Badge */}
        <div className="absolute top-4 left-4">
          <Badge variant="secondary" className="font-mono">
            #{specialist.position}
          </Badge>
        </div>

        <div className="mt-8 space-y-3">
          {/* Name and Status */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{specialist.name}</h3>
              <p className="text-sm text-muted-foreground">{specialist.user.jobTitle}</p>
            </div>
            <Badge variant={specialist.isActive ? "success" : "secondary"}>
              {specialist.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{specialist.user.email}</span>
            </div>
            
            {specialist.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{specialist.location}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>
                {specialist.user.firstName} {specialist.user.lastName}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Calendar ID: {specialist.acuityCalendarId}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}