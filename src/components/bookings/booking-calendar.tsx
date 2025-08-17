"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BookingWithSpecialist } from "@/types/booking";
import { cn } from "@/lib/utils";

interface BookingCalendarProps {
  bookings: BookingWithSpecialist[];
}

type ViewType = "month" | "week" | "day";

export function BookingCalendar({ bookings }: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, BookingWithSpecialist[]> = {};
    
    bookings.forEach((booking) => {
      if (booking.examDate) {
        const dateKey = format(new Date(booking.examDate), "yyyy-MM-dd");
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(booking);
      }
    });

    return grouped;
  }, [bookings]);

  // Generate calendar days for month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return days;
  }, [currentDate]);

  const navigatePrevious = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const navigateNext = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: "bg-blue-100 text-blue-800",
      closed: "bg-gray-100 text-gray-800",
      archived: "bg-gray-100 text-gray-500",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewType === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("month")}
          >
            Month
          </Button>
          <Button
            variant={viewType === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("week")}
          >
            Week
          </Button>
          <Button
            variant={viewType === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("day")}
          >
            Day
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {viewType === "month" && (
        <div className="border rounded-lg overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-gray-700 border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[120px] p-2 border-r border-b last:border-r-0",
                    !isCurrentMonth && "bg-gray-50",
                    isToday && "bg-blue-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        !isCurrentMonth && "text-gray-400",
                        isToday && "text-blue-600"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayBookings.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayBookings.length}
                      </Badge>
                    )}
                  </div>

                  {/* Booking Cards */}
                  <div className="space-y-1">
                    {dayBookings.slice(0, 2).map((booking) => (
                      <Card
                        key={booking.id}
                        className={cn(
                          "p-1 cursor-pointer hover:shadow-sm transition-shadow",
                          getStatusColor(booking.status)
                        )}
                      >
                        <Link href={`/bookings/${booking.id}`}>
                          <div className="text-xs">
                            <p className="font-medium truncate">
                              {booking.patientFirstName} {booking.patientLastName[0]}.
                            </p>
                            <p className="text-gray-600">
                              {booking.examDate && format(new Date(booking.examDate), "h:mm a")}
                            </p>
                          </div>
                        </Link>
                      </Card>
                    ))}
                    {dayBookings.length > 2 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{dayBookings.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View - Simplified for now */}
      {viewType === "week" && (
        <div className="border rounded-lg p-4">
          <p className="text-center text-gray-500">Week view coming soon...</p>
        </div>
      )}

      {/* Day View - Simplified for now */}
      {viewType === "day" && (
        <div className="border rounded-lg p-4">
          <p className="text-center text-gray-500">Day view coming soon...</p>
        </div>
      )}
    </div>
  );
}