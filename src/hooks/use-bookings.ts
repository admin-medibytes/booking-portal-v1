import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
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
      const response = await apiClient.get<BookingListResponse>("/bookings", {
        params: filters as Record<string, string | number | boolean | undefined>,
      });

      console.log("use bookings", response);

      return response;
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
      const response = await apiClient.get<{ success: boolean; booking: BookingWithSpecialist }>(
        `/bookings/${id}`
      );
      return response.booking;
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
      const response = await apiClient.patch(`/bookings/${id}/status`, { status });
      return response;
    },
    onSuccess: (data, variables) => {
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
      const response = await apiClient.post(`/bookings/${id}/cancel`);
      return response;
    },
    onSuccess: (data, id) => {
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
      const response = await apiClient.post(`/bookings/${id}/reschedule`, { date });
      return response;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.id) });
    },
  });
}
