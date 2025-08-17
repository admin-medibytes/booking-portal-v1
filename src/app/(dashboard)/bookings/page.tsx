"use client";

import { useState, useEffect } from "react";
import { useBookings } from "@/hooks/use-bookings";
import { BookingList } from "@/components/bookings/booking-list";
import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, List, Plus, Search, Loader2 } from "lucide-react";
import type { BookingFilters } from "@/types/booking";
import { startOfMonth, endOfMonth } from "date-fns";

type ViewType = "calendar" | "list";

export default function BookingsPage() {
  const [view, setView] = useState<ViewType>("list");
  const [filters, setFilters] = useState<BookingFilters>({
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

  const handleSearch = (searchTerm: string) => {
    // This would typically update a search filter
    // For now, we'll implement this when we have search support in the API
    console.log("Search:", searchTerm);
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status === "all" ? undefined : status,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handleDateRangeFilter = (range: string) => {
    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (range) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "this-month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "all":
      default:
        startDate = undefined;
        endDate = undefined;
    }

    setFilters((prev) => ({
      ...prev,
      startDate,
      endDate,
      page: 1,
    }));
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
        <Button className="inline-flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
            <Input
              type="text"
              placeholder="Search bookings..."
              className="pl-10"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <Select onValueChange={handleStatusFilter} defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select onValueChange={handleDateRangeFilter} defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
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