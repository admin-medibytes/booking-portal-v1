"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BookingWithSpecialist } from "@/types/booking";
import { CalendarIcon, ClockIcon, UserIcon, BuildingIcon, MapPin, Video } from "lucide-react";

interface BookingDetailsPopoverProps {
  booking: BookingWithSpecialist;
  onClose: () => void;
}

export function BookingDetailsPopover({ booking, onClose }: BookingDetailsPopoverProps) {
  const router = useRouter();

  const handleViewDetails = () => {
    router.push(`/bookings/${booking.id}`);
    onClose();
  };

  const appointmentDate = booking.dateTime ? new Date(booking.dateTime) : null;
  // For now, we'll use a default status since currentProgress isn't available
  const statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          {appointmentDate &&
            
            <span className="text-sm text-muted-foreground">{format(appointmentDate, "h:mm a")}, 06:00 AM - 07:00 AM</span>
          }
          <DialogTitle>{booking.examinee.firstName} {booking.examinee.lastName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div />

          {/* Examination Type */}
          {booking.type && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {
                  booking.type === 'telehealth' ? <Video className="h-4 w-4 text-muted-foreground" /> :
                  <MapPin className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium">Appointment Type</span>
              </div>
              <p className="text-sm ml-6 capitalize">{booking.type}</p>
            </div>
          )}

          {/* Specialist Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Referrer</span>
            </div>
            <p className="text-sm ml-6 capitalize">{booking.referrer?.firstName} {booking.referrer?.lastName || "Unassigned"}</p>
          </div>

          {/* Specialist Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Specialist</span>
            </div>
            <div className="ml-6">
              <p className="text-sm font-medium">{booking.specialist?.name || "Unassigned"}</p>
              <p className="text-sm text-muted-foreground">
                {booking.specialist?.jobTitle || "N/A"}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleViewDetails}>View Full Details</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
