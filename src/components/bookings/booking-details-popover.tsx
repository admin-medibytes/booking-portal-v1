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
import { CalendarIcon, ClockIcon, UserIcon, BuildingIcon } from "lucide-react";

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
          <DialogTitle>Booking Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Badge className={statusColor}>
              {booking.status
                ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
                : "Active"}
            </Badge>
          </div>

          {/* Examinee Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Examinee</span>
            </div>
            <p className="text-sm ml-6">
              {booking.examinee.firstName} {booking.examinee.lastName}
            </p>
          </div>

          {/* Appointment Date & Time */}
          {appointmentDate && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Date & Time</span>
              </div>
              <p className="text-sm ml-6">{format(appointmentDate, "EEEE, MMMM d, yyyy")}</p>
              <div className="flex items-center gap-2 ml-6">
                <ClockIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">{format(appointmentDate, "h:mm a")}</span>
              </div>
            </div>
          )}

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

          {/* Exam Location */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BuildingIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Exam Location</span>
            </div>
            <p className="text-sm ml-6">{booking.location || "Not specified"}</p>
          </div>

          {/* Examination Type */}
          {booking.type && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Examination Type</span>
              </div>
              <p className="text-sm ml-6">{booking.type}</p>
            </div>
          )}
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
