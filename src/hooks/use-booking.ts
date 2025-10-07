import { useQuery } from "@tanstack/react-query";
import { bookingsClient } from "@/lib/hono-client";
import { handleApiResponse } from "@/lib/hono-utils";
import type { BookingWithSpecialist, BookingProgress, Organization } from "@/types/booking";

export interface BookingWithDetails extends BookingWithSpecialist {
  progress: (BookingProgress & {
    changedBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  })[];
  documents: Array<{
    id: string;
    name: string;
    type: string;
    uploadedAt: Date;
  }>;
  organization: Organization;
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
      const response = bookingsClient[":id"].$get({
        param: { id },
      });
      const data = await handleApiResponse<{ success: boolean; booking: BookingWithDetails }>(
        response
      );
      return data.booking;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}
