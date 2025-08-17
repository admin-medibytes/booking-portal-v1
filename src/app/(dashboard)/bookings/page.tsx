"use client";

import { useState, useEffect } from "react";
import { useBookings } from "@/hooks/use-bookings";
import { BookingList } from "@/components/bookings/booking-list";
import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { BookingFilters, type FilterState } from "@/components/bookings/booking-filters";
import { Button } from "@/components/ui/button";
import { Calendar, List, Plus, Loader2 } from "lucide-react";
import type { BookingFilters as BookingFiltersType } from "@/types/booking";
import { startOfMonth, endOfMonth } from "date-fns";
import { useSpecialists } from "@/hooks/use-specialists";
import { useRouter } from "next/navigation";

type ViewType = "calendar" | "list";

export default function BookingsPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewType>("list");
  const [filters, setFilters] = useState<BookingFiltersType>({
    page: 1,
    limit: 20,
  });

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem("bookings-view") as ViewType;
    if (savedView && ["calendar", "list"].includes(savedView)) {
      setView(savedView);
    }
  }, []);

  // Save view preference
  const handleViewChange = (newView: ViewType) => {
    setView(newView);
    localStorage.setItem("bookings-view", newView);
  };

  // Fetch bookings data
  const { data, isLoading, error } = useBookings(filters);
  const { data: specialists } = useSpecialists();

  const handleFiltersChange = (filterState: FilterState) => {
    // Map filter state to booking filters
    const newFilters: BookingFiltersType = {
      ...filters,
      search: filterState.search || undefined,
      status: filterState.status || undefined,
      specialistIds: filterState.specialistIds.length > 0 ? filterState.specialistIds : undefined,
      page: 1, // Reset to first page when filters change
    };

    // For calendar view, adjust date range based on current view
    if (view === "calendar") {
      const now = new Date();
      newFilters.startDate = startOfMonth(now);
      newFilters.endDate = endOfMonth(now);
    }

    setFilters(newFilters);
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
          <p className="mt-2 text-gray-600">
            Manage patient appointments and referrals
          </p>
        </div>
        <Button className="inline-flex items-center" onClick={() => router.push("/bookings/new")}>
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      {/* Filters and View Toggle */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <BookingFilters 
            specialists={specialists || []} 
            onFiltersChange={handleFiltersChange}
          />
          
          {/* View Toggle */}
          <div className="flex gap-2 ml-4">
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => handleViewChange("list")}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "outline"}
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
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {view === "list" ? (
              <div className="p-6">
                <BookingList bookings={data?.bookings || []} />
              </div>
            ) : (
              <div className="p-6">
                <BookingCalendar bookings={data?.bookings || []} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}