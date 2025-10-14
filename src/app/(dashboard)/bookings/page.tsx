"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useBookings, useBookingsCalendar } from "@/hooks/use-bookings";
import { BookingListTable } from "@/components/bookings/booking-list-table";
import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { BookingFilters, type FilterState } from "@/components/bookings/booking-filters";
import { Button } from "@/components/ui/button";
import { Calendar, List, Plus, Loader2 } from "lucide-react";
import type { BookingFilters as BookingFiltersType } from "@/types/booking";
import { useSpecialists } from "@/hooks/use-specialists";

type ViewType = "calendar" | "list";

export default function BookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize view from URL or localStorage
  const [view, setView] = useState<ViewType>(() => {
    const urlView = (searchParams.get("view") as ViewType | undefined) || "calendar";
    if (urlView && ["calendar", "list"].includes(urlView)) {
      return urlView;
    }
    const savedView = localStorage.getItem("bookings-view") as ViewType;
    if (savedView && ["calendar", "list"].includes(savedView)) {
      return savedView;
    }
    return "calendar";
  });

  // Initialize filters from URL
  const [filters, setFilters] = useState<BookingFiltersType>(() => {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "5");
    const urlStatus = searchParams.get("status");
    const status = urlStatus === null || urlStatus === "" ? "active" : (urlStatus === "all" ? undefined : urlStatus);

    return {
      page,
      limit,
      status: status,
      specialistIds: searchParams.get("specialists")?.split(",").filter(Boolean),
      search: searchParams.get("search") || undefined,
    };
  });

  // Track current month for calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Update URL when view changes
  const handleViewChange = (newView: ViewType) => {
    setView(newView);
    localStorage.setItem("bookings-view", newView);

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    router.push(`?${params.toString()}`);
  };

  // Fetch bookings data - only fetch for the active view
  const { data: listData, isLoading: listLoading, error: listError } = useBookings(
    filters,
    { enabled: view === "list" }
  );
  const { bookings: calendarBookings, isLoading: calendarLoading, error: calendarError } = useBookingsCalendar(
    currentMonth,
    {
      search: filters.search,
      specialistIds: filters.specialistIds,
      status: filters.status,
    },
    { enabled: view === "calendar" }
  );
  const { data: specialists } = useSpecialists();

  // Use appropriate data based on view
  const data = view === "calendar" ? { bookings: calendarBookings, pagination: { page: 1, limit: calendarBookings.length, total: calendarBookings.length, totalPages: 1 } } : listData;
  const isLoading = view === "calendar" ? calendarLoading : listLoading;
  const error = view === "calendar" ? calendarError : listError;

  // Sync filters with URL params when they change
  useEffect(() => {
    const urlStatus = searchParams.get("status");
    const status = urlStatus === null || urlStatus === "" ? "active" : (urlStatus === "all" ? undefined : urlStatus);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "5");
    const specialistIds = searchParams.get("specialists")?.split(",").filter(Boolean);
    const search = searchParams.get("search") || undefined;

    setFilters({
      page,
      limit,
      status: status,
      specialistIds,
      search,
    });
  }, [searchParams]);

  const handleFiltersChange = (filterState: FilterState) => {
    // Map filter state to booking filters
    const newFilters: BookingFiltersType = {
      ...filters,
      search: filterState.search || undefined,
      status: filterState.status || undefined,
      specialistIds: filterState.specialistIds.length > 0 ? filterState.specialistIds : undefined,
      page: 1, // Reset to first page when filters change
    };

    setFilters(newFilters);
  };

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    const newFilters = { ...filters, page: newPage };
    setFilters(newFilters);

    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    const newFilters = { ...filters, limit: newSize, page: 1 };
    setFilters(newFilters);

    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", newSize.toString());
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  if (error) {
    return (
      <div className="container py-6 mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading bookings: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-2 text-gray-600">Manage examinee appointments and referrals</p>
        </div>
        <Button className="inline-flex items-center" onClick={() => router.push("/bookings/new")}>
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      {/* Filters and View Toggle */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <BookingFilters specialists={specialists || []} onFiltersChange={handleFiltersChange} />

          {/* View Toggle - Button Group Style */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit border">
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("list")}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("calendar")}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {view === "list" ? (
        isLoading ? (
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
            </div>
          </div>
        ) : (
          <BookingListTable
            bookings={data?.bookings || []}
            totalCount={data?.pagination.total || 0}
            currentPage={filters.page || 1}
            pageSize={filters.limit || 10}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )
      ) : (
        <BookingCalendar
          bookings={data?.bookings || []}
          isLoading={isLoading}
          onMonthChange={setCurrentMonth}
        />
      )}
    </div>
  );
}
