import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Document } from "@/types/document";
import { documentKeys } from "./use-upload-document";

interface DocumentsResponse {
  data: Document[];
}

export function useDocuments(bookingId: string) {
  return useQuery({
    queryKey: documentKeys.list(bookingId),
    queryFn: async () => {
      const response = await apiClient.get<DocumentsResponse>(
        `/documents/booking/${bookingId}`
      );
      return response.data;
    },
    enabled: !!bookingId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}