"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  startOfDay,
  parseISO,
  setHours,
  eachDayOfInterval,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { BookingWithSpecialist } from "@/types/booking";
import { BookingDetailsPopover } from "./booking-details-popover";

interface BookingCalendarProps {
  bookings: BookingWithSpecialist[];
  onEventSelect?: (booking: BookingWithSpecialist) => void;
  onMonthChange?: (date: Date) => void;
  isLoading?: boolean;
  timezone?: string;
  externalMonth?: Date; // Allow parent to control the displayed month
}

type ViewType = "month" | "week" | "day" | "agenda";

export function BookingCalendar({
  bookings,
  onEventSelect,
  onMonthChange,
  isLoading = false,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  externalMonth
}: BookingCalendarProps) {
  const [isClient, setIsClient] = useState(false);

  // Initialize state from localStorage on first render to prevent duplicate requests
  const [currentDate, setCurrentDate] = useState(() => {
    if (typeof window === "undefined") return new Date();
    const savedDate = localStorage.getItem("booking-calendar-date");
    return savedDate ? new Date(savedDate) : new Date();
  });

  // Sync with external month changes (e.g., from search auto-navigation)
  useEffect(() => {
    if (externalMonth && externalMonth.getTime() !== currentDate.getTime()) {
      console.log('[Calendar] Syncing with external month:', externalMonth);
      setCurrentDate(externalMonth);
    }
  }, 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [externalMonth]);

  const [viewType, setViewType] = useState<ViewType>(() => {
    if (typeof window === "undefined") return "month";
    const savedView = localStorage.getItem("booking-calendar-view");
    return savedView && ["month", "week", "day", "agenda"].includes(savedView)
      ? (savedView as ViewType)
      : "month";
  });

  const [selectedBooking, setSelectedBooking] = useState<BookingWithSpecialist | null>(null);

  // Set isClient flag after mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Save currentDate to localStorage when it changes and notify parent
  useEffect(() => {
    if (isClient) {
      localStorage.setItem("booking-calendar-date", currentDate.toISOString());
      onMonthChange?.(currentDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, isClient]);

  // Save viewType to localStorage when it changes
  useEffect(() => {
    if (isClient) {
      localStorage.setItem("booking-calendar-view", viewType);
    }
  }, [viewType, isClient]);

  // Navigation functions
  const navigatePrevious = useCallback(() => {
    if (viewType === "month") {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else if (viewType === "week") {
      setCurrentDate((prev) => subWeeks(prev, 1));
    } else if (viewType === "day" || viewType === "agenda") {
      setCurrentDate((prev) => subDays(prev, 1));
    }
  }, [viewType]);

  const navigateNext = useCallback(() => {
    if (viewType === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else if (viewType === "week") {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else if (viewType === "day" || viewType === "agenda") {
      setCurrentDate((prev) => addDays(prev, 1));
    }
  }, [viewType]);

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Handle keyboard shortcuts
  // useEffect(() => {
  //   const handleKeyPress = (e: KeyboardEvent) => {
  //     switch (e.key) {
  //       case "m":
  //         setViewType("month");
  //         break;
  //       case "w":
  //         setViewType("week");
  //         break;
  //       case "d":
  //         setViewType("day");
  //         break;
  //       case "a":
  //         setViewType("agenda");
  //         break;
  //     }
  //   };

  //   window.addEventListener("keypress", handleKeyPress);
  //   return () => window.removeEventListener("keypress", handleKeyPress);
  // }, []);

  // Get header title based on view
  const headerTitle = useMemo(() => {
    switch (viewType) {
      case "month":
        return format(currentDate, "MMMM yyyy");
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        if (isSameMonth(weekStart, weekEnd)) {
          return format(weekStart, "MMMM d") + " - " + format(weekEnd, "d, yyyy");
        }
        return format(weekStart, "MMM d") + " - " + format(weekEnd, "MMM d, yyyy");
      case "day":
      case "agenda":
        return format(currentDate, "EEEE, MMMM d, yyyy");
    }
  }, [currentDate, viewType]);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, BookingWithSpecialist[]> = {};

    bookings.forEach((booking) => {
      const appointmentDate = booking.dateTime;
      if (appointmentDate) {
        const dateKey = format(new Date(appointmentDate), "yyyy-MM-dd");
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(booking);
      }
    });

    // Sort bookings within each day by time
    Object.keys(grouped).forEach((dateKey) => {
      grouped[dateKey].sort((a, b) => {
        const timeA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
        const timeB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
        return timeA - timeB;
      });
    });

    return grouped;
  }, [bookings]);

  // Calculate total bookings for the current month
  const totalMonthBookings = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    return bookings.filter((booking) => {
      if (!booking.dateTime) return false;
      const bookingDate = new Date(booking.dateTime);
      return bookingDate >= monthStart && bookingDate <= monthEnd;
    }).length;
  }, [bookings, currentDate]);

  const handleBookingClick = useCallback((booking: BookingWithSpecialist, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBooking(booking);
    onEventSelect?.(booking);
  }, [onEventSelect]);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="w-4 h-4" />
              <span className="sr-only">Previous</span>
            </Button>
            <Button variant="outline" size="sm" onClick={navigateToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
              <span className="sr-only">Next</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold sm:text-2x">{headerTitle}</h2>
            {viewType === "month" && (
              <Badge variant="secondary" className="text-sm border border-gray-200">
                {totalMonthBookings} {totalMonthBookings === 1 ? "booking" : "bookings"}
              </Badge>
            )}
          </div>
        </div>

        {/* View Toggle - OriginUI Tabs Style */}
        <Tabs value={viewType} onValueChange={(value) => setViewType(value as ViewType)}>
          <TabsList className="bg-background h-auto -space-x-px p-0 shadow-xs rtl:space-x-reverse border">
            <TabsTrigger
              value="month"
              className="data-[state=active]:bg-muted data-[state=active]:after:bg-primary relative overflow-hidden rounded-md [&:nth-child(n):not(:first-child):not(:last-child)]:rounded-none border py-2 px-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-e last:rounded-s capitalize"
            >
              Month
            </TabsTrigger>
            <TabsTrigger
              value="week"
              className="data-[state=active]:bg-muted data-[state=active]:after:bg-primary relative overflow-hidden rounded-md [&:nth-child(n):not(:first-child):not(:last-child)]:rounded-none border py-2 px-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-e last:rounded-s capitalize"
            >
              Week
            </TabsTrigger>
            <TabsTrigger
              value="day"
              className="data-[state=active]:bg-muted data-[state=active]:after:bg-primary relative overflow-hidden rounded-md [&:nth-child(n):not(:first-child):not(:last-child)]:rounded-none border py-2 px-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-e last:rounded-s capitalize"
            >
              Day
            </TabsTrigger>
            <TabsTrigger
              value="agenda"
              className="data-[state=active]:bg-muted data-[state=active]:after:bg-primary relative overflow-hidden rounded-md [&:nth-child(n):not(:first-child):not(:last-child)]:rounded-none border py-2 px-4 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-e last:rounded-s capitalize"
            >
              Agenda
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar Views */}
      {viewType === "month" && (
        <MonthView
          currentDate={currentDate}
          bookingsByDate={bookingsByDate}
          onBookingClick={handleBookingClick}
          isLoading={isLoading}
          timezone={timezone}
        />
      )}

      {viewType === "week" && (
        <WeekView
          currentDate={currentDate}
          bookingsByDate={bookingsByDate}
          onBookingClick={handleBookingClick}
          isLoading={isLoading}
          timezone={timezone}
        />
      )}

      {viewType === "day" && (
        <DayView
          currentDate={currentDate}
          bookingsByDate={bookingsByDate}
          onBookingClick={handleBookingClick}
          timezone={timezone}
        />
      )}

      {viewType === "agenda" && (
        <AgendaView
          currentDate={currentDate}
          bookings={bookings}
          onBookingClick={handleBookingClick}
          timezone={timezone}
        />
      )}

      {/* Booking Details Popover */}
      {selectedBooking && (
        <BookingDetailsPopover booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}
    </div>
  );
}

// Month View Component
interface MonthViewProps {
  currentDate: Date;
  bookingsByDate: Record<string, BookingWithSpecialist[]>;
  onBookingClick: (booking: BookingWithSpecialist, e: React.MouseEvent) => void;
  isLoading?: boolean;
  timezone: string;
}

function MonthView({ currentDate, bookingsByDate, onBookingClick, isLoading = false, timezone }: MonthViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  return (
    <div className="overflow-hidden border rounded-lg shadow">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 bg-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="p-1 text-xs font-medium text-center border-r sm:p-2 sm:text-sm text-muted-foreground last:border-r-0"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.substring(0, 1)}</span>
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 ">
        {calendarDays.map((day, index) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayBookings = bookingsByDate[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={index}
              className={cn(
                "min-h-[80px] sm:min-h-[150px] p-1 sm:p-2 border-r border-b last:border-r-0",
                !isCurrentMonth && "bg-muted/30",
                isToday && "bg-blue-50 dark:bg-blue-950/20"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                {isLoading ? (
                  <Skeleton className="h-5 w-6" />
                ) : (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      !isCurrentMonth && "text-muted-foreground",
                      isToday && "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                )}
              </div>

              {/* Booking Items */}
              <div>
                <div className="hidden sm:block space-y-1">
                  {dayBookings.slice(0, 3).map((booking) => (
                    <BookingItem
                      key={booking.id}
                      booking={booking}
                      view="month"
                      onClick={onBookingClick}
                      timezone={timezone}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full text-xs text-center text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors">
                          +{dayBookings.length - 3} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 max-h-96 overflow-y-auto p-2">
                        <div className="space-y-1">
                          <div className="px-2 py-1 text-sm font-medium border-b mb-2">
                            {format(day, "MMMM d, yyyy")} - {dayBookings.length} bookings
                          </div>
                          {dayBookings.map((booking) => (
                            <BookingItem
                              key={booking.id}
                              booking={booking}
                              view="month"
                              onClick={onBookingClick}
                              timezone={timezone}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="sm:hidden">
                  {dayBookings.slice(0, 1).map((booking) => (
                    <BookingItem
                      key={booking.id}
                      booking={booking}
                      view="month"
                      onClick={onBookingClick}
                      timezone={timezone}
                    />
                  ))}
                  {dayBookings.length > 1 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="w-full text-xs text-center text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors">
                          +{dayBookings.length - 1}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 max-h-80 overflow-y-auto p-2">
                        <div className="space-y-1">
                          <div className="px-2 py-1 text-sm font-medium border-b mb-2">
                            {format(day, "MMM d")} - {dayBookings.length} bookings
                          </div>
                          {dayBookings.map((booking) => (
                            <BookingItem
                              key={booking.id}
                              booking={booking}
                              view="month"
                              onClick={onBookingClick}
                              timezone={timezone}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Week View Component
interface WeekViewProps {
  currentDate: Date;
  bookingsByDate: Record<string, BookingWithSpecialist[]>;
  onBookingClick: (booking: BookingWithSpecialist, e: React.MouseEvent) => void;
  isLoading?: boolean;
  timezone: string;
}

function WeekView({ currentDate, bookingsByDate, onBookingClick, isLoading: _isLoading = false, timezone }: WeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const allHours = Array.from({ length: 24 }, (_, i) => i); // 12am to 11pm (0-23)

  return (
    <div className="overflow-hidden border rounded-lg shadow">
      {/* Time column and day headers */}
      <div className="grid grid-cols-8 bg-muted">
        <div className="p-2 text-sm font-medium border-r text-muted-foreground">Time</div>
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "p-2 text-center border-r last:border-r-0",
              isToday(day) && "bg-blue-50 dark:bg-blue-950/20"
            )}
          >
            <div className="text-sm font-medium">{format(day, "EEE")}</div>
            <div
              className={cn(
                "text-lg",
                isToday(day) && "text-blue-600 dark:text-blue-400 font-semibold"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots grid */}
      <div className="grid grid-cols-8 overflow-y-auto ">
        {allHours.map((hour) => (
          <React.Fragment key={hour}>
            {/* Hour label */}
            <div className="sticky left-0 p-2 text-sm border-b border-r text-muted-foreground bg-background">
              {format(setHours(new Date(), hour), "h a")}
            </div>

            {/* Day slots */}
            {weekDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate[dateKey] || [];
              const hourBookings = dayBookings.filter((booking) => {
                if (!booking.dateTime) return false;
                const bookingDate = new Date(booking.dateTime);
                return bookingDate.getHours() === hour;
              });

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className="p-1 border-r border-b last:border-r-0 relative min-h-[60px] space-y-1"
                >
                  {hourBookings.map((booking) => (
                    <BookingItem
                      key={booking.id}
                      booking={booking}
                      view="week"
                      onClick={onBookingClick}
                      timezone={timezone}
                    />
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Day View Component
interface DayViewProps {
  currentDate: Date;
  bookingsByDate: Record<string, BookingWithSpecialist[]>;
  onBookingClick: (booking: BookingWithSpecialist, e: React.MouseEvent) => void;
  timezone: string;
}

function DayView({ currentDate, bookingsByDate, onBookingClick, timezone }: DayViewProps) {
  const dateKey = format(currentDate, "yyyy-MM-dd");
  const dayBookings = bookingsByDate[dateKey] || [];
  const allHours = Array.from({ length: 24 }, (_, i) => i); // 12am to 11pm (0-23)

  return (
    <div className="overflow-hidden border rounded-lg shadow">
      {/* Day header */}
      <div className="p-4 border-b bg-muted">
        <h3 className="text-lg font-semibold">{format(currentDate, "EEEE, MMMM d, yyyy")}</h3>
        <p className="text-sm text-muted-foreground">
          {dayBookings.length} booking{dayBookings.length !== 1 ? "s" : ""} scheduled
        </p>
      </div>

      {/* Hourly slots */}
      <div className="max-h-[600px] overflow-y-auto">
        {allHours.map((hour) => {
          const hourBookings = dayBookings.filter((booking) => {
            if (!booking.dateTime) return false;
            const bookingDate = new Date(booking.dateTime);
            return bookingDate.getHours() === hour;
          });

          return (
            <div key={hour} className="grid grid-cols-12 border-b last:border-b-0">
              {/* Time label */}
              <div className="col-span-2 p-3 text-sm border-r text-muted-foreground">
                {format(setHours(new Date(), hour), "h:mm a")}
              </div>

              {/* Booking slot */}
              <div className="col-span-10 p-2 min-h-[80px] space-y-1">
                {hourBookings.map((booking) => (
                  <BookingItem
                    key={booking.id}
                    booking={booking}
                    view="day"
                    onClick={onBookingClick}
                    timezone={timezone}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Agenda View Component
interface AgendaViewProps {
  currentDate: Date;
  bookings: BookingWithSpecialist[];
  onBookingClick: (booking: BookingWithSpecialist, e: React.MouseEvent) => void;
  timezone: string;
}

function AgendaView({ currentDate, bookings, onBookingClick, timezone }: AgendaViewProps) {
  const agendaBookings = useMemo(() => {
    const startDate = startOfDay(currentDate);
    const endDate = addDays(startDate, 30);

    return bookings
      .filter((booking) => {
        const bookingDate = booking.dateTime ? new Date(booking.dateTime) : null;
        return bookingDate && bookingDate >= startDate && bookingDate <= endDate;
      })
      .sort((a, b) => {
        const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
        const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
        return dateA - dateB;
      });
  }, [currentDate, bookings]);

  // Group bookings by date for agenda view
  const groupedBookings = useMemo(() => {
    const grouped: Record<string, BookingWithSpecialist[]> = {};

    agendaBookings.forEach((booking) => {
      if (!booking.dateTime) return;
      const dateKey = format(new Date(booking.dateTime), "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(booking);
    });

    return grouped;
  }, [agendaBookings]);

  if (agendaBookings.length === 0) {
    return (
      <div className="p-8 border rounded-lg shadow">
        <div className="flex flex-col items-center justify-center text-center">
          <Calendar className="w-12 h-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium">No bookings found</h3>
          <p className="text-muted-foreground">
            There are no bookings scheduled for the next 30 days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border rounded-lg">
      <div className="p-4 border-b bg-muted">
        <h3 className="text-lg font-semibold">Next 30 Days</h3>
        <p className="text-sm text-muted-foreground">
          {agendaBookings.length} booking{agendaBookings.length !== 1 ? "s" : ""} scheduled
        </p>
      </div>

      <div className="divide-y">
        {Object.entries(groupedBookings).map(([dateKey, dayBookings]) => {
          const date = parseISO(dateKey);

          return (
            <div key={dateKey} className="p-4">
              <h4 className="sticky top-0 mb-3 text-sm font-medium text-muted-foreground bg-background">
                {format(date, "EEEE, MMMM d, yyyy")}
              </h4>
              <div className="space-y-1">
                {dayBookings.map((booking) => (
                  <BookingItem
                    key={booking.id}
                    booking={booking}
                    view="agenda"
                    onClick={onBookingClick}
                    timezone={timezone}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Booking Item Component - Memoized for performance
interface BookingItemProps {
  booking: BookingWithSpecialist;
  view: ViewType;
  onClick: (booking: BookingWithSpecialist, e: React.MouseEvent) => void;
  timezone: string;
}

const BookingItem = React.memo(function BookingItem({ booking, view, onClick, timezone }: BookingItemProps) {
  const appointmentDate = booking.dateTime ? new Date(booking.dateTime) : null;
  const timeString = appointmentDate ? formatInTimeZone(appointmentDate, timezone, "h:mm a") : "";

  // Set color based on booking type: blue for telehealth, violet for in-person
  const statusColor =
    booking.type === "telehealth"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      : "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";

  if (view === "month") {
    return (
      <div
        className={cn(
          "p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity",
          statusColor
        )}
        onClick={(e) => onClick(booking, e)}
      >
        <div className="font-medium truncate">
          {timeString} - {booking.examinee.firstName} {booking.examinee.lastName}
        </div>
      </div>
    );
  }

  if (view === "week") {
    return (
      <div
        className={cn(
          "p-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity w-full",
          statusColor
        )}
        onClick={(e) => onClick(booking, e)}
      >
        <div className="font-medium truncate">
          {booking.examinee?.firstName} {booking.examinee?.lastName}
        </div>
        <div className="text-xs opacity-75">{booking.specialist?.name || "Unassigned"}</div>
      </div>
    );
  }

  if (view === "day" || view === "agenda") {
    return (
      <div
        className={cn("p-3 rounded-md cursor-pointer hover:shadow-md transition-all", statusColor)}
        onClick={(e) => onClick(booking, e)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{timeString}</span>
              <Badge variant="outline" className="text-xs shadow bg-gray-100 text-gray-800">
                {booking.location}
              </Badge>
            </div>
            <div className="font-medium">
              {booking.examinee.firstName} {booking.examinee.lastName}
            </div>
            <div className="text-sm opacity-75">
              with {booking.specialist?.name || "Unassigned"}
              {booking.specialist?.user?.jobTitle && ` (${booking.specialist.user.jobTitle})`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
});
