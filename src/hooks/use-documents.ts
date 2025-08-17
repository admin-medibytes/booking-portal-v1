import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Document, DocumentSection, DocumentCategory } from "@/types/document";
import { documentKeys } from "./use-upload-document";

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
      const params = new URLSearchParams();
      if (section) params.append("section", section);
      if (category) params.append("category", category);
      
      const queryString = params.toString();
      const url = `/documents/booking/${bookingId}${queryString ? `?${queryString}` : ""}`;
      
      const response = await apiClient.get<DocumentsResponse>(url);
      return response.data;
    },
    enabled: !!bookingId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}