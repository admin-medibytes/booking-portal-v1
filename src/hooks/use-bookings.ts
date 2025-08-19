import { useQuery } from "@tanstack/react-query";

import { bookingsClient } from "@/lib/hono-client";
import type { BookingListResponse, BookingWithSpecialist, BookingFilters } from "@/types/booking";

// Query key factory for consistent cache management
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (filters?: BookingFilters) => [...bookingKeys.lists(), filters] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
};

// Hook to fetch bookings list with filters
export function useBookings(filters?: BookingFilters) {
  return useQuery({
    queryKey: bookingKeys.list(filters),
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
      console.log("Done fetching with use bookings");
      return data as unknown as BookingListResponse;
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
