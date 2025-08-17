import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DocumentCategory, Document } from "@/types/document";

interface UploadDocumentParams {
  file: File;
  bookingId: string;
  category: DocumentCategory;
}

interface UploadResponse {
  data: Document;
}

interface UploadError {
  error: string;
  status?: number;
}

// Query key factory for documents
export const documentKeys = {
  all: ["documents"] as const,
  lists: () => [...documentKeys.all, "list"] as const,
  list: (bookingId: string) => [...documentKeys.lists(), bookingId] as const,
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

export function useUploadDocument() {
  const queryClient = useQueryClient();

  const uploadMutation = useMutation<
    UploadResponse,
    UploadError,
    UploadDocumentParams & { onProgress?: (progress: number) => void }
  >({
    mutationFn: async ({ file, bookingId, category, onProgress }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "metadata",
        JSON.stringify({
          bookingId,
          category,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        })
      );

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = Math.round((e.loaded / e.total) * 100);
            onProgress(progress);
          }
        });

        xhr.onloadend = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject({
                error: "Invalid response format",
                status: xhr.status,
              });
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject({
                error: errorResponse.error || "Upload failed",
                status: xhr.status,
              });
            } catch {
              reject({
                error: `Upload failed: ${xhr.statusText}`,
                status: xhr.status,
              });
            }
          }
        };

        xhr.onerror = () => {
          reject({
            error: "Network error occurred",
            status: 0,
          });
        };

        xhr.open("POST", "/api/documents");
        xhr.withCredentials = true; // Include cookies for session
        xhr.send(formData);
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate document list for this booking
      queryClient.invalidateQueries({
        queryKey: documentKeys.list(variables.bookingId),
      });
      
      // Also invalidate the booking detail to update document count
      queryClient.invalidateQueries({
        queryKey: ["bookings", "detail", variables.bookingId],
      });

      toast.success(`${variables.file.name} uploaded successfully`);
    },
    onError: (error) => {
      if (error.status === 429) {
        // Extract retry time from error message
        const retryMatch = error.error.match(/try again in (\d+) minutes?/);
        const retryMinutes = retryMatch ? retryMatch[1] : "a few";
        toast.error(`Upload limit reached (50 per hour). Please try again in ${retryMinutes} minute${retryMinutes === "1" ? "" : "s"}.`);
      } else if (error.status === 413) {
        toast.error("File too large. Maximum size is 100MB.");
      } else if (error.status === 400) {
        toast.error(error.error);
      } else if (error.status === 401) {
        toast.error("Session expired. Please log in again.");
      } else if (error.status === 403) {
        toast.error("You don't have permission to upload documents to this booking.");
      } else {
        toast.error("Failed to upload document. Please try again.");
      }
    },
  });

  return {
    uploadDocument: (
      params: UploadDocumentParams,
      onProgress?: (progress: number) => void
    ) => uploadMutation.mutateAsync({ ...params, onProgress }),
    isUploading: uploadMutation.isPending,
  };
}