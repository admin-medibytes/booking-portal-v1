import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingsClient } from "@/lib/hono-client";
import { handleApiResponse } from "@/lib/hono-utils";
import { bookingKeys } from "./use-bookings";
import { bookingDetailKeys } from "./use-booking";

interface UpdateProgressParams {
  bookingId: string;
  progress: string;
  notes?: string;
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, progress, notes }: UpdateProgressParams) => {
      const response = bookingsClient[bookingId].progress.$post({
        json: { progress, notes },
      });
      return await handleApiResponse(response);
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      // Invalidate specific booking detail
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(variables.bookingId) });
      // Invalidate booking details with progress
      queryClient.invalidateQueries({ queryKey: bookingDetailKeys.detail(variables.bookingId) });
    },
    onError: (error: Error) => {
      console.error("Failed to update booking progress:", error);
    },
  });
}