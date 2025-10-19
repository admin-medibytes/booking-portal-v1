"use client";

import { useRouter } from "next/navigation";
import { addMinutes, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BookingWithSpecialist } from "@/types/booking";
import { UserIcon, MapPin, Video, Calendar } from "lucide-react";
import { Separator } from "../ui/separator";
import { useAuth } from "@/hooks/use-auth";

interface BookingDetailsPopoverProps {
  booking: BookingWithSpecialist;
  onClose: () => void;
}

export function BookingDetailsPopover({ booking, onClose }: BookingDetailsPopoverProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleViewDetails = () => {
    router.push(`/bookings/${booking.id}`);
    onClose();
  };

  const handleReschedule = () => {
    router.push(`/bookings/${booking.id}/reschedule`);
    onClose();
  };

  const appointmentDate = booking.dateTime ? new Date(booking.dateTime) : null;
  // For now, we'll use a default status since currentProgress isn't available

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          {appointmentDate &&
            
            <span className="text-sm text-muted-foreground">{format(appointmentDate, "PPPp")} to {format(addMinutes(appointmentDate, booking.duration), "h:mm a")}</span>
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

          {/* Referrer Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Referrer</span>
            </div>
            <p className="text-sm ml-6 capitalize">
              {booking.referrer?.firstName && booking.referrer?.lastName
                ? `${booking.referrer.firstName} ${booking.referrer.lastName}`
                : "Unassigned"}
            </p>
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
                {booking.specialist.user?.jobTitle}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {booking.type === "telehealth" && booking.location ? (
          <DialogFooter>
            <div className="w-full space-y-2">
                <div className="flex flex-row gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={() => window.open(booking.location, "_blank")}
                    className="flex-1"
                  >
                    <Video className="h-4 w-4 mr-1" />
                    Join Meeting
                  </Button>
                  {user?.memberRole !== "specialist" && (
                    <Button variant="outline" onClick={handleReschedule} className="flex-1">
                      <Calendar className="h-4 w-4 mr-1" />
                      Reschedule
                    </Button>
                  )}
                </div>
                <Button onClick={handleViewDetails} className="w-full">
                  View Details
                </Button>
              </div>
            </DialogFooter>
        ) : (
          <DialogFooter className="flex-row gap-2">
            {user?.memberRole !== "specialist" && (
              <Button variant="outline" onClick={handleReschedule} className="flex-1">
                <Calendar className="h-4 w-4 mr-1" />
                Reschedule
              </Button>
            )}
            <Button onClick={handleViewDetails} className="flex-1">
              View Details
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
