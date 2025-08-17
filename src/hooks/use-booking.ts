import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { BookingWithSpecialist, BookingProgress } from "@/types/booking";

export interface BookingWithDetails extends BookingWithSpecialist {
  progress: (BookingProgress & {
    changedBy?: {
      id: string;
      name: string;
      email: string;
    };
  })[];
  documents: Array<{
    id: string;
    name: string;
    type: string;
    uploadedAt: Date;
  }>;
  currentProgress: string;
}

export const bookingDetailKeys = {
  all: ["booking-details"] as const,
  detail: (id: string) => [...bookingDetailKeys.all, id] as const,
};

export function useBookingWithDetails(id: string) {
  return useQuery({
    queryKey: bookingDetailKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; booking: BookingWithDetails }>(
        `/bookings/${id}`
      );
      return response.booking;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}