"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isSameDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar as CalendarIcon, Clock, Video, MapPin } from "lucide-react";
import { specialistsClient } from "@/lib/hono-client";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/calendar";
import { today, CalendarDate } from "@internationalized/date";
import { timeZones } from "@/lib/utils/timezones";

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
  specialist?: {
    id: string;
    name: string;
    image?: string | null;
    user?: {
      firstName: string;
      lastName: string;
      jobTitle: string;
    };
  };
  appointmentType?: {
    name: string;
    duration: number;
    appointmentMode?: "in-person" | "telehealth";
  };
}

// // Australian timezone options
// const australianTimezones = timeZones.filter((tz) =>
//   tz.includes("Australia")
// );

// const timeZones = australianTimezones
//   .map((tz) => ({
//     label: tz.replace("Australia/", "").replace(/_/g, " "),
//     tzCode: tz,
//   }))
//   .sort((a, b) => a.label.localeCompare(b.label));

const availableTimezones = timeZones.filter((tz) => tz.label.includes("Australia"));

export function TimeSlotPicker({
  specialistId,
  appointmentTypeId,
  onSelect,
  selectedDateTime,
  specialist,
  appointmentType,
}: TimeSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<CalendarDate>(today("Australia/Sydney"));
  const [timeZone, setTimeZone] = useState("Australia/Sydney");
  const [timeFormat, setTimeFormat] = useState<"12" | "24">("12");

  const userTimezone = timeZone;

  // Fetch available dates for the month
  const {
    data: availableDatesData,
    isLoading: isDatesLoading,
    error: datesError,
  } = useQuery({
    queryKey: [
      "specialist-available-dates",
      specialistId,
      appointmentTypeId,
      selectedDate.month,
      selectedDate.year,
    ],
    queryFn: async () => {
      // Format month as YYYY-MM
      const monthStr = `${selectedDate.year}-${String(selectedDate.month).padStart(2, "0")}`;

      const response = await specialistsClient[":id"]["available-dates"].$get({
        param: { id: specialistId },
        query: {
          month: monthStr,
          appointmentTypeId: appointmentTypeId.toString(),
        },
      });

      const result = await response.json();
      if ("error" in result) {
        throw new Error(result.error || "Failed to fetch available dates");
      }

      return result.data.dates;
    },
    enabled: !!specialistId && !!appointmentTypeId,
  });

  // Fetch time slots for selected date
  const {
    data: timeSlotsData,
    isLoading: isSlotsLoading,
    error: slotsError,
  } = useQuery({
    queryKey: [
      "specialist-time-slots",
      specialistId,
      appointmentTypeId,
      selectedDate.toString(),
      timeZone,
    ],
    queryFn: async () => {
      const response = await specialistsClient[":id"]["time-slots"].$get({
        param: { id: specialistId },
        query: {
          date: selectedDate.toString(),
          appointmentTypeId: appointmentTypeId.toString(),
          timezone: userTimezone,
        },
      });

      const result = await response.json();
      if ("error" in result) {
        throw new Error(result.error || "Failed to fetch time slots");
      }

      return result.data.timeSlots;
    },
    enabled: !!specialistId && !!appointmentTypeId && !!selectedDate,
  });

  // Convert date strings to Date objects for calendar
  const availableDates = (availableDatesData || []).map((dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  });

  const handleDateSelect = (value: any) => {
    setSelectedDate(value);
  };

  const handleTimeSelect = (slot: any) => {
    const dateTime = parseISO(slot.datetime);
    onSelect(dateTime);
  };

  const formatTime = (date: Date) => {
    if (timeFormat === "12") {
      return formatInTimeZone(date, userTimezone, "h:mm a");
    }
    return formatInTimeZone(date, userTimezone, "HH:mm");
  };

  const selectedDateSlots = timeSlotsData || [];
  const jsSelectedDate = selectedDate.toDate(userTimezone);
  const isLoading = isDatesLoading || isSlotsLoading;
  const error = datesError || slotsError;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load available time slots. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full bg-white px-8 py-6 rounded-lg border border-gray-200 max-w-max mx-auto">
      <div className="flex gap-6">
        {/* Left Panel - Specialist Info */}
        <div className="flex flex-col gap-4 w-[280px] border-r pr-6">
          {/* Specialist Info */}
          {specialist && (
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={specialist.image || undefined} alt={specialist.name} />
                <AvatarFallback>
                  {specialist.user?.firstName?.[0]}
                  {specialist.user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {specialist.user?.firstName} {specialist.user?.lastName}
                </p>
                <p className="text-sm text-gray-600">{specialist.user?.jobTitle}</p>
              </div>
            </div>
          )}

          {/* Appointment Type Header */}
          {appointmentType && (
            <div className="pb-2 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{appointmentType.name}</h3>
            </div>
          )}

          <div className="grid gap-3">
            <div className="flex items-center text-gray-700">
              <Clock className="size-4 mr-2" />
              <p className="text-sm font-medium">{appointmentType?.duration || 30} mins</p>
            </div>
            <div className="flex items-center text-gray-700">
              {appointmentType?.appointmentMode === "in-person" ? (
                <>
                  <MapPin className="size-4 mr-2" />
                  <p className="text-sm font-medium">In-person consultation</p>
                </>
              ) : (
                <>
                  <Video className="size-4 mr-2" />
                  <p className="text-sm font-medium">Video consultation</p>
                </>
              )}
            </div>
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select time zone">{timeZone}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableTimezones.map((tz) => (
                  <SelectItem key={tz.tzCode} value={tz.tzCode}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Center Panel - Calendar */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="w-[400px] h-[350px]" />
          </div>
        ) : (
          <Calendar
            minValue={today(userTimezone)}
            value={selectedDate}
            onChange={handleDateSelect}
            availableDates={availableDates}
          />
        )}

        {/* Right Panel - Time Slots */}
        <div className="flex flex-col gap-4 w-[280px] border-l pl-6">
          <div className="flex justify-between items-center">
            <p aria-hidden className="flex-1 align-center font-bold text-md text-gray-900">
              {format(jsSelectedDate, "EEE")}{" "}
              <span className="text-gray-600">{format(jsSelectedDate, "d")}</span>
            </p>
            <Tabs
              value={timeFormat}
              onValueChange={(v) => setTimeFormat(v as "12" | "24")}
              className="w-fit"
            >
              <TabsList className="grid w-fit grid-cols-2 bg-gray-100">
                <TabsTrigger value="12" className="text-xs">
                  12h
                </TabsTrigger>
                <TabsTrigger value="24" className="text-xs">
                  24h
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {isLoading ? (
            <div className="grid gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="w-full h-10" />
              ))}
            </div>
          ) : selectedDateSlots.length === 0 ? (
            <div className="flex items-center justify-center h-[320px]">
              <p className="text-center text-gray-500 text-sm">
                No available time slots for this date
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[320px]">
              <div className="grid gap-2 pr-3">
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
                      className={cn(
                        "justify-center",
                        !isSelected && "hover:bg-gray-50 border-gray-200"
                      )}
                      onClick={() => handleTimeSelect(slot)}
                    >
                      {formatTime(slotDate)}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Bottom - Selected DateTime Display */}
      {selectedDateTime && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarIcon className="w-4 h-4" />
            <span>
              Selected:{" "}
              {formatInTimeZone(selectedDateTime, timeZone, "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
