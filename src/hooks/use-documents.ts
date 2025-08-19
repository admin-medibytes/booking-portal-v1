import { useQuery } from "@tanstack/react-query";
import { documentsClient } from "@/lib/hono-client";
import { handleApiResponse, ApiError } from "@/lib/hono-utils";
import type { Document, DocumentSection, DocumentCategory } from "@/types/document";
import { documentKeys } from "./use-upload-document";
import { toast } from "sonner";

interface DocumentsResponse {
  data: Document[];
}

interface UseDocumentsOptions {
  section?: DocumentSection;
  category?: DocumentCategory;
}

export function useDocuments(bookingId: string, options?: UseDocumentsOptions) {
  const { section, category } = options || {};

  return useQuery({
    queryKey: [...documentKeys.list(bookingId), { section, category }],
    queryFn: async () => {
      try {
        const response = documentsClient.booking[":bookingId"].$get({
          param: { bookingId },
          query: {
            section,
            category,
          },
        });
        const result = await handleApiResponse<DocumentsResponse>(response);
        return result.data;
      } catch (error) {
        // Handle 403 errors specifically
        if (error instanceof ApiError && error.status === 403) {
          // Don't throw, return empty array and show toast
          toast.error("You don't have permission to view documents for this booking");
          return [];
        }
        // Re-throw other errors
        throw error;
      }
    },
    enabled: !!bookingId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 403 errors
      if (error instanceof ApiError && error.status === 403) {
        return false;
      }
      // Default retry logic for other errors
      return failureCount < 3;
    },
  });
}
