import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
      const response = await apiClient.post(`/bookings/${bookingId}/progress`, {
        progress,
        notes,
      });
      return response;
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