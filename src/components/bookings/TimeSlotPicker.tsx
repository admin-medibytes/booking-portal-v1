"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { specialistsClient } from "@/lib/hono-client";
import { cn } from "@/lib/utils";

interface TimeSlot {
  datetime: string;
  duration: number;
  appointmentTypeId: number;
}

interface AvailabilityResponse {
  slots: TimeSlot[];
  timezone: string;
}

interface TimeSlotPickerProps {
  specialistId: string;
  appointmentTypeId: number;
  onSelect: (dateTime: Date) => void;
  selectedDateTime: Date | null;
}

export function TimeSlotPicker({ specialistId, appointmentTypeId, onSelect, selectedDateTime }: TimeSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const {
    data: availability,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["specialist-availability", specialistId, appointmentTypeId, format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const startDate = format(weekStart, "yyyy-MM-dd");
      const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");
      
      const response = await specialistsClient[":id"].availability.$get({
        param: { id: specialistId },
        query: {
          startDate,
          endDate,
          appointmentTypeId: appointmentTypeId.toString(),
          timezone: userTimezone,
        },
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch availability");
      }
      
      return {
        slots: data.data.timeSlots.filter((slot: any) => slot.available),
        timezone: userTimezone,
      } as AvailabilityResponse;
    },
    enabled: !!specialistId && !!appointmentTypeId,
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getSlotsForDate = (date: Date) => {
    if (!availability?.slots) return [];

    return availability.slots.filter((slot) => {
      const slotDate = parseISO(slot.datetime);
      const zonedSlotDate = toZonedTime(slotDate, userTimezone);
      return isSameDay(zonedSlotDate, date);
    });
  };

  const handlePreviousWeek = () => {
    setWeekStart(addDays(weekStart, -7));
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    const dateTime = parseISO(slot.datetime);
    onSelect(dateTime);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full h-20" />
        <div className="grid gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-full h-12" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load available time slots. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const selectedDateSlots = getSlotsForDate(selectedDate);

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5" />
              Select a Date
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </span>
              <Button variant="outline" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((date) => {
              const slots = getSlotsForDate(date);
              const isSelected = isSameDay(date, selectedDate);
              const hasSlots = slots.length > 0;

              return (
                <Button
                  key={date.toISOString()}
                  variant={isSelected ? "default" : "outline"}
                  className={cn("h-auto flex-col p-2", !hasSlots && "opacity-50")}
                  disabled={!hasSlots}
                  onClick={() => handleDateSelect(date)}
                >
                  <span className="text-xs">{format(date, "EEE")}</span>
                  <span className="text-lg font-semibold">{format(date, "d")}</span>
                  {hasSlots && (
                    <span className="text-xs text-muted-foreground">{slots.length} slots</span>
                  )}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Time Slots */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5" />
            Available Times
          </CardTitle>
          <CardDescription>{format(selectedDate, "EEEE, MMMM d, yyyy")}</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedDateSlots.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No available time slots for this date
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {selectedDateSlots.map((slot) => {
                const slotDate = parseISO(slot.datetime);
                const isSelected =
                  selectedDateTime &&
                  isSameDay(selectedDateTime, slotDate) &&
                  selectedDateTime.getTime() === slotDate.getTime();

                return (
                  <Button
                    key={slot.datetime}
                    variant={isSelected ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => handleTimeSelect(slot)}
                  >
                    {formatInTimeZone(slotDate, userTimezone, "h:mm a")}
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDateTime && (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Selected: {format(selectedDateTime, "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
