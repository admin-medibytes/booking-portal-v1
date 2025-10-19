import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect, useRef } from "react";

import { bookingsClient } from "@/lib/hono-client";
import type { BookingListResponse, BookingWithSpecialist, BookingFilters } from "@/types/booking";

// Query key factory for consistent cache management
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (filters?: BookingFilters) => [...bookingKeys.lists(), filters] as const,
  calendar: () => [...bookingKeys.all, "calendar"] as const,
  calendarMonth: (year: number, month: number) => [...bookingKeys.calendar(), year, month] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
};

// Hook to fetch bookings list with filters
export function useBookings(
  filters?: BookingFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: bookingKeys.list(filters),
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      // Filter out any "all" status before sending to backend
      const cleanedFilters = filters
        ? {
            ...filters,
            status: filters.status === "all" ? undefined : filters.status,
          }
        : undefined;

      // Convert Date objects to strings for the query
      const queryFilters = cleanedFilters
        ? Object.entries(cleanedFilters).reduce(
            (acc, [key, value]) => {
              if (value instanceof Date) {
                acc[key] = value.toISOString();
              } else if (Array.isArray(value)) {
                // Handle arrays by joining them as comma-separated strings
                acc[key] = value.join(",");
              } else if (value !== undefined) {
                acc[key] = value as string | number | boolean;
              }
              return acc;
            },
            {} as Record<string, string | number | boolean>
          )
        : {};

      const res = await bookingsClient.$get({
        query: queryFilters,
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to fetch bookings");
      }

      const data = await res.json();

      // Transform date strings to Date objects for TypeScript compatibility
      const rawBookings = (data.bookings || []) as Array<Record<string, unknown>>;
      const transformedBookings = rawBookings.map((booking) => {
        const referrerObj = booking.referrer as Record<string, unknown> | null | undefined;
        const referrerOrganizationObj = booking.referrerOrganization as
          | Record<string, unknown>
          | null
          | undefined;

        return {
          ...(booking as Record<string, unknown>),
          createdAt: new Date(booking.createdAt as string),
          updatedAt: new Date(booking.updatedAt as string),
          appointmentDate: booking.dateTime ? new Date(booking.dateTime as string) : null,
          completedAt: booking.completedAt
            ? new Date(booking.completedAt as string)
            : null,
          cancelledAt: booking.cancelledAt
            ? new Date(booking.cancelledAt as string)
            : null,
          referrer:
            referrerObj && Object.keys(referrerObj).length > 0 ? referrerObj : null,
          referrerOrganization:
            referrerOrganizationObj && Object.keys(referrerOrganizationObj).length > 0
              ? referrerOrganizationObj
              : null,
        } as unknown as BookingWithSpecialist;
      });

      const transformedData: BookingListResponse = {
        ...data,
        bookings: transformedBookings,
      };

      return transformedData;
    },
    staleTime: 30 * 1000, // 30 seconds as per requirements
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}

// Hook to fetch single booking details
export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const res = await bookingsClient[":id"].$get({
        param: { id },
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to fetch booking");
      }

      const data = (await res.json()) as unknown as {
        success: boolean;
        booking: BookingWithSpecialist;
      };
      return data.booking;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}

// Hook to fetch bookings for calendar view (month-based, with server-side filtering)
export function useBookingsCalendar(
  currentMonth: Date,
  clientFilters?: {
    search?: string;
    specialistIds?: string[];
    status?: string;
  },
  options?: { enabled?: boolean; onSearchResultFound?: (date: Date) => void }
) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Fetch all bookings for the month (or broader range when searching)
  const { data, isLoading, error } = useQuery({
    queryKey: [...bookingKeys.calendarMonth(year, month), clientFilters],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const queryFilters: Record<string, string> = {
        limit: "500", // Reduced from 1000 for better performance
      };

      // When searching, don't restrict by date to find all matching results
      // Otherwise, only fetch bookings for the current month
      if (!clientFilters?.search) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        queryFilters.startDate = startDate.toISOString();
        queryFilters.endDate = endDate.toISOString();
      }

      // Apply status filter server-side if present
      if (clientFilters?.status && clientFilters.status !== "all" && clientFilters.status !== "") {
        queryFilters.status = clientFilters.status;
      }

      // Apply specialist filter server-side if present
      if (clientFilters?.specialistIds && clientFilters.specialistIds.length > 0) {
        queryFilters.specialistIds = clientFilters.specialistIds.join(",");
      }

      const res = await bookingsClient.$get({
        query: queryFilters,
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to fetch bookings");
      }

      const data = await res.json();

      // Return bookings as-is - minimal transformation for performance
      return (data.bookings || []) as unknown as BookingWithSpecialist[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - calendar data can be cached longer
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
  });

  // Apply client-side filtering (only search, as status/specialist are now server-side)
  const filteredBookings = useMemo(() => {
    if (!data) return [];

    let filtered = [...data];

    // Apply search filter client-side (search in examinee name and email)
    if (clientFilters?.search) {
      const searchLower = clientFilters.search.toLowerCase().trim();
      filtered = filtered.filter((booking) => {
        const examinee = booking.examinee as { firstName?: string; lastName?: string; email?: string } | undefined;
        const firstName = examinee?.firstName?.toLowerCase() || "";
        const lastName = examinee?.lastName?.toLowerCase() || "";
        const email = examinee?.email?.toLowerCase() || "";
        const fullName = `${firstName} ${lastName}`.trim();

        return (
          firstName.includes(searchLower) ||
          lastName.includes(searchLower) ||
          fullName.includes(searchLower) ||
          email.includes(searchLower)
        );
      });
    }

    return filtered;
  }, [data, clientFilters?.search]);

  // Track if we've already navigated for this search term
  const hasNavigatedRef = useRef(false);
  const lastSearchRef = useRef<string | undefined>(undefined);

  // Reset navigation flag when search term changes
  useEffect(() => {
    if (clientFilters?.search !== lastSearchRef.current) {
      hasNavigatedRef.current = false;
      lastSearchRef.current = clientFilters?.search;
    }
  }, [clientFilters?.search]);

  // Find nearest future booking from search results and navigate to its month
  useEffect(() => {
    console.log('[Calendar Auto-Nav] Effect triggered', {
      hasSearch: !!clientFilters?.search,
      searchTerm: clientFilters?.search,
      bookingsCount: filteredBookings.length,
      hasCallback: !!options?.onSearchResultFound,
      hasNavigated: hasNavigatedRef.current,
      currentMonth: `${year}-${month + 1}`,
    });

    if (
      clientFilters?.search &&
      filteredBookings.length > 0 &&
      options?.onSearchResultFound &&
      !hasNavigatedRef.current
    ) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      console.log('[Calendar Auto-Nav] Processing bookings for navigation', {
        today: today.toISOString(),
        totalBookings: filteredBookings.length,
      });

      // Find all future bookings from search results
      const futureBookings = filteredBookings.filter((booking) => {
        if (!booking.dateTime) return false;
        const bookingDate = new Date(booking.dateTime);
        return bookingDate >= today;
      });

      console.log('[Calendar Auto-Nav] Future bookings found:', futureBookings.length);

      if (futureBookings.length > 0) {
        // Sort by date ascending to find the nearest future booking
        futureBookings.sort((a, b) => {
          const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
          const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
          return dateA - dateB;
        });

        const nearestBooking = futureBookings[0];
        if (nearestBooking.dateTime) {
          const bookingDate = new Date(nearestBooking.dateTime);
          console.log('[Calendar Auto-Nav] Nearest future booking:', {
            date: bookingDate.toISOString(),
            examinee: `${nearestBooking.examinee?.firstName} ${nearestBooking.examinee?.lastName}`,
            bookingYear: bookingDate.getFullYear(),
            bookingMonth: bookingDate.getMonth(),
            currentYear: year,
            currentMonth: month,
          });

          // Only trigger navigation if the booking is in a different month than currently displayed
          if (
            bookingDate.getFullYear() !== year ||
            bookingDate.getMonth() !== month
          ) {
            console.log('[Calendar Auto-Nav] Navigating to new month:', bookingDate);
            options.onSearchResultFound(bookingDate);
            hasNavigatedRef.current = true;
          } else {
            console.log('[Calendar Auto-Nav] Booking is in current month, no navigation needed');
          }
        }
      }
    }
  }, [filteredBookings, clientFilters?.search, options, year, month]);

  return {
    bookings: filteredBookings,
    isLoading,
    error,
  };
}

// Hook to update booking status (for future use - route not implemented yet)
// export function useUpdateBookingStatus() {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: async ({ id, status }: { id: string; status: string }) => {
//       const res = await bookingsClient[":id"].status.$patch({
//         param: { id },
//         json: { status },
//       });

//       if (!res.ok) {
//         const error = await res.text();
//         throw new Error(error || 'Failed to update booking status');
//       }

//       return await res.json();
//     },
//     onSuccess: (_data, variables) => {
//       // Invalidate and refetch booking lists
//       queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
//       // Invalidate specific booking detail
//       queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.id) });
//     },
//   });
// }

// Hook to cancel a booking (for future use - route not implemented yet)
// export function useCancelBooking() {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: async (id: string) => {
//       const res = await bookingsClient[":id"].cancel.$post({
//         param: { id }
//       });

//       if (!res.ok) {
//         const error = await res.text();
//         throw new Error(error || 'Failed to cancel booking');
//       }

//       return await res.json();
//     },
//     onSuccess: (_data, id) => {
//       // Invalidate and refetch
//       queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
//       queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
//     },
//   });
// }

// Hook to reschedule a booking (for future use - route not implemented yet)
// export function useRescheduleBooking() {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: async ({ id, date }: { id: string; date: Date }) => {
//       const res = await bookingsClient[":id"].reschedule.$post({
//         param: { id },
//         json: { date },
//       });

//       if (!res.ok) {
//         const error = await res.text();
//         throw new Error(error || 'Failed to reschedule booking');
//       }

//       return await res.json();
//     },
//     onSuccess: (_data, variables) => {
//       // Invalidate and refetch
//       queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
//       queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.id) });
//     },
//   });
// }
