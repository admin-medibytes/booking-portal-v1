import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
      const cleanedFilters = filters ? {
        ...filters,
        status: filters.status === "all" ? undefined : filters.status
      } : undefined;
      
      const res = await bookingsClient.$get({
        query: cleanedFilters as Record<string, string | number | boolean | undefined>,
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch bookings');
      }
      
      const data = await res.json() as BookingListResponse;
      console.log("Done fetching with use bookings");
      return data;
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
      const res = await bookingsClient[id].$get();
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch booking');
      }
      
      const data = await res.json() as { success: boolean; booking: BookingWithSpecialist };
      return data.booking;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}

// Hook to update booking status (for future use)
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await bookingsClient[id].status.$patch({
        json: { status },
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to update booking status');
      }
      
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate and refetch booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      // Invalidate specific booking detail
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.id) });
    },
  });
}

// Hook to cancel a booking (for future use)
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await bookingsClient[id].cancel.$post();
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to cancel booking');
      }
      
      return await res.json();
    },
    onSuccess: (_data, id) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
    },
  });
}

// Hook to reschedule a booking (for future use)
export function useRescheduleBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: Date }) => {
      const res = await bookingsClient[id].reschedule.$post({
        json: { date },
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to reschedule booking');
      }
      
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.id) });
    },
  });
}