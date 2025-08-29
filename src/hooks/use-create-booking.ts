import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingsClient } from "@/lib/hono-client";
import { handleApiResponse } from "@/lib/hono-utils";
import { bookingKeys } from "./use-bookings";
import { toast } from "sonner";

interface CreateBookingData {
  specialistId: string;
  appointmentTypeId: string;
  appointmentDateTime: string;
  examineeName: string;
  examineePhone: string;
  examineeEmail?: string | null;
  appointmentType: "in_person" | "telehealth";
  notes?: string | null;
}

interface CreateBookingResponse {
  success: boolean;
  id: string;
  message: string;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation<CreateBookingResponse, Error, CreateBookingData>({
    mutationFn: async (data) => {
      const response = bookingsClient.$post({
        json: data,
      });
      return await handleApiResponse<CreateBookingResponse>(response);
    },
    onSuccess: (data) => {
      // Invalidate booking queries to refresh the list
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      
      // Show success toast
      toast.success(data.message || "Booking created successfully");
    },
    onError: (error) => {
      console.error("Failed to create booking:", error);
      
      // Show error toast with specific message
      if (error.message.includes("Time slot")) {
        toast.error("This time slot is no longer available. Please select another time.");
      } else if (error.message.includes("Specialist not found")) {
        toast.error("The selected specialist is not available. Please select another specialist.");
      } else {
        toast.error(error.message || "Failed to create booking. Please try again.");
      }
    },
  });
}