import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Document, DocumentSection, DocumentCategory } from "@/types/document";

interface InitiateUploadInput {
  bookingId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  section: DocumentSection;
  category: DocumentCategory;
}

interface InitiateUploadResult {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

interface ConfirmUploadInput {
  documentId: string;
  s3Key: string;
  bookingId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  section: DocumentSection;
  category: DocumentCategory;
}

/**
 * Hook to fetch documents for a booking
 */
export function useDocuments(
  bookingId: string,
  filters?: {
    section?: DocumentSection;
    category?: DocumentCategory;
  }
) {
  return useQuery({
    queryKey: ["documents", bookingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.section) params.append("section", filters.section);
      if (filters?.category) params.append("category", filters.category);

      const response = await fetch(`/api/documents/booking/${bookingId}?${params.toString()}`);
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch documents");
        }
        throw new Error("Failed to fetch documents");
      }
      const data = await response.json();
      return data.data as Document[];
    },
    enabled: !!bookingId,
  });
}

/**
 * Hook to initiate document upload (get presigned URL)
 */
export function useInitiateUpload() {
  return useMutation({
    mutationFn: async (input: InitiateUploadInput) => {
      const response = await fetch("/api/documents/initiate-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to initiate upload");
        }
        throw new Error(`Failed to initiate upload: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data as InitiateUploadResult;
    },
  });
}

/**
 * Hook to upload file to S3 using presigned URL
 */
export function useUploadToS3() {
  return useMutation({
    mutationFn: async ({
      uploadUrl,
      file,
      onProgress,
    }: {
      uploadUrl: string;
      file: File;
      onProgress?: (progress: number) => void;
    }) => {
      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload aborted"));
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
    },
  });
}

/**
 * Hook to confirm upload (save document metadata)
 */
export function useConfirmUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConfirmUploadInput) => {
      const response = await fetch("/api/documents/confirm-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to confirm upload");
        }
        throw new Error(`Failed to confirm upload: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data as Document;
    },
    onSuccess: (_, variables) => {
      // Invalidate documents query to refetch the list
      queryClient.invalidateQueries({
        queryKey: ["documents", variables.bookingId],
      });
    },
  });
}

/**
 * Complete upload workflow hook
 */
export function useUploadDocument() {
  const initiateUpload = useInitiateUpload();
  const uploadToS3 = useUploadToS3();
  const confirmUpload = useConfirmUpload();

  return useMutation({
    mutationFn: async ({
      file,
      bookingId,
      section,
      category,
      onProgress,
    }: {
      file: File;
      bookingId: string;
      section: DocumentSection;
      category: DocumentCategory;
      onProgress?: (progress: number) => void;
    }) => {
      // Step 1: Initiate upload
      const initResult = await initiateUpload.mutateAsync({
        bookingId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        section,
        category,
      });

      try {
        // Step 2: Upload to S3
        await uploadToS3.mutateAsync({
          uploadUrl: initResult.uploadUrl,
          file,
          onProgress,
        });

        // Step 3: Confirm upload
        const document = await confirmUpload.mutateAsync({
          documentId: initResult.documentId,
          s3Key: initResult.s3Key,
          bookingId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          section,
          category,
        });

        return document;
      } catch (error) {
        // If S3 upload or confirmation fails, the document won't be saved
        // The backend handles cleanup of orphaned files via lifecycle policies
        throw error;
      }
    },
  });
}

/**
 * Hook to delete a document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete document");
        }
        throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }
      return { success: true };
    },
    onSuccess: () => {
      // Invalidate all document queries
      queryClient.invalidateQueries({
        queryKey: ["documents"],
      });
    },
  });
}

/**
 * Hook for direct document upload (server-side upload)
 */
export function useDirectUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      files,
      bookingId,
      section,
      category,
    }: {
      files: File[];
      bookingId: string;
      section: DocumentSection;
      category: DocumentCategory;
    }) => {
      const formData = new FormData();

      // Add all files
      files.forEach((file) => {
        formData.append("files", file);
      });

      // Add metadata
      formData.append("bookingId", bookingId);
      formData.append("section", section);
      formData.append("category", category);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload documents");
        }
        throw new Error(`Failed to upload documents: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as {
        totalFiles: number;
        successfulUploads: number;
        failedUploads: number;
        files: Array<{ id?: string; name: string; uploadSuccess: boolean; error?: string }>;
      };
    },
    onSuccess: (_, variables) => {
      // Invalidate documents query to refetch the list
      queryClient.invalidateQueries({
        queryKey: ["documents", variables.bookingId],
      });
    },
  });
}

/**
 * Hook to download a document
 */
export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/documents/${documentId}`);

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to download document");
        }
        throw new Error(`Failed to download document: ${response.status} ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : "document";

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}
