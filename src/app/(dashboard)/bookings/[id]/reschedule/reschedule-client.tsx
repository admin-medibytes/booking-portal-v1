"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TimeSlotPicker } from "@/components/bookings/TimeSlotPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface RescheduleClientProps {
  booking: {
    id: string;
    acuityAppointmentId: number;
    acuityAppointmentTypeId: number;
    dateTime: Date;
    duration: number;
    type: "in-person" | "telehealth";
    status: "active" | "closed" | "archived";
    specialist: {
      id: string;
      name: string;
      image: string | null;
      user: {
        firstName: string;
        lastName: string;
        jobTitle: string;
      };
    };
  };
}

export function RescheduleClient({ booking }: RescheduleClientProps) {
  const router = useRouter();
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(
    booking.dateTime ? new Date(booking.dateTime) : null
  );
  const [selectedTimezone, setSelectedTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [datetimeString, setDatetimeString] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);

  const handleTimeSlotSelect = (dateTime: Date, datetimeStr: string, timezone: string) => {
    setSelectedDateTime(dateTime);
    setDatetimeString(datetimeStr);
    setSelectedTimezone(timezone);
  };

  const handleReschedule = async () => {
    if (!selectedDateTime) {
      toast.error("Please select a new date and time");
      return;
    }

    setIsRescheduling(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datetime: datetimeString,
          timezone: selectedTimezone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reschedule appointment");
      }

      toast.success("Appointment rescheduled successfully");
      router.push(`/bookings/${booking.id}`);
    } catch (error) {
      console.error("Error rescheduling:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reschedule appointment");
    } finally {
      setIsRescheduling(false);
    }
  };

  const isClosed = booking.status === "closed" || booking.status === "archived";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Reschedule Appointment</h1>
          <p className="text-muted-foreground">
            Select a new date and time for your appointment
          </p>
        </div>
      </div>

      {/* Closed Booking Overlay */}
      {isClosed && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Card className="max-w-md mx-4">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
                <Calendar className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Appointment Cancelled</h3>
                <p className="text-muted-foreground">
                  This appointment has been cancelled and cannot be rescheduled.
                </p>
              </div>
              <Button onClick={() => router.push(`/bookings/${booking.id}`)} className="w-full">
                View Booking Details
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Appointment Comparison Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isClosed ? "pointer-events-none blur-sm" : ""}`}>
        <Card>
          <CardHeader>
            <CardTitle>Current Appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {format(new Date(booking.dateTime), "EEEE, MMMM d, yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(booking.dateTime), "h:mm a")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedTimezone}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedDateTime && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>New Appointment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">
                    {format(selectedDateTime, "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedDateTime, "h:mm a")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTimezone}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleReschedule}
                disabled={isRescheduling || !selectedDateTime}
                className="w-full"
              >
                {isRescheduling ? "Rescheduling..." : "Confirm Reschedule"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Time Slot Picker */}
      <Card className={isClosed ? "pointer-events-none blur-sm" : ""}>
        <CardHeader>
          <CardTitle>Select New Date & Time</CardTitle>
          <CardDescription>
            Choose an available time slot for your appointment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeSlotPicker
            specialistId={booking.specialist.id}
            appointmentTypeId={booking.acuityAppointmentTypeId}
            onSelect={handleTimeSlotSelect}
            onTimezoneChange={setSelectedTimezone}
            selectedDateTime={selectedDateTime}
            selectedTimezone={selectedTimezone}
            specialist={booking.specialist}
            appointmentType={{
              name: booking.type === "telehealth" ? "Telehealth Appointment" : "In-Person Appointment",
              duration: booking.duration,
              appointmentMode: booking.type,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
