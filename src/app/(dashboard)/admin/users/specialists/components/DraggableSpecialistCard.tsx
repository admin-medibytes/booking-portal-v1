import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Mail, User, GripVertical, Video, MapPinned, AlertCircle } from "lucide-react";
import type { SpecialistLocation } from "@/server/db/schema/specialists";
import { getLocationDisplay } from "@/lib/utils/location";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  slug: string | null;
  location: SpecialistLocation | null;
  acceptsInPerson: boolean;
  acceptsTelehealth: boolean;
  position: number;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    image?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface DraggableSpecialistCardProps {
  specialist: Specialist;
  onClick?: () => void;
}

export function DraggableSpecialistCard({ specialist, onClick }: DraggableSpecialistCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: specialist.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get initials from specialist name
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || "S";
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <Card
        className={`p-4 relative h-full flex flex-col ${isDragging ? "shadow-lg" : ""} cursor-pointer hover:shadow-md transition-shadow`}
        onClick={(e) => {
          // Don't trigger click when dragging
          const target = e.target as HTMLElement;
          if (!target.closest("[data-drag-handle]")) {
            onClick?.();
          }
        }}
      >
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

        <div className="mt-8 flex flex-col h-full">
          {/* Name and Status */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={specialist.user.image || ""} alt={specialist.name} />
                <AvatarFallback>
                  {getInitials(`${specialist.user.firstName} ${specialist.user.lastName}`)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{specialist.name}</h3>
                <p className="text-sm text-muted-foreground">{specialist.user.jobTitle}</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <Badge variant={specialist.isActive ? "success" : "secondary"}>
                {specialist.isActive ? "Active" : "Inactive"}
              </Badge>
              {/* Appointment Type Badges */}
              <div className="flex flex-wrap gap-1 mt-2 justify-end min-h-[3.5rem] items-start">
                {specialist.acceptsInPerson && (
                  <Badge variant="outline" className="text-xs">
                    <MapPinned className="w-3 h-3 mr-1" />
                    In-person
                  </Badge>
                )}
                {specialist.acceptsTelehealth && (
                  <Badge variant="outline" className="text-xs">
                    <Video className="w-3 h-3 mr-1" />
                    Telehealth
                  </Badge>
                )}
                {!specialist.acceptsInPerson && !specialist.acceptsTelehealth && (
                  <Badge variant="secondary" className="text-xs">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    On Request
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator className="mb-3" />

          {/* Contact Info */}
          <div className="space-y-2 text-sm flex-grow">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{specialist.user.email}</span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {getLocationDisplay(
                  specialist.acceptsInPerson,
                  specialist.acceptsTelehealth,
                  specialist.location
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>
                {specialist.user.firstName} {specialist.user.lastName}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 mt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Calendar ID: {specialist.acuityCalendarId}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
