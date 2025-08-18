import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsClient } from "@/lib/hono-client";
import { handleApiResponse, ApiError } from "@/lib/hono-utils";
import { toast } from "sonner";

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const deletingDocuments = new Set<string>();

  const mutation = useMutation({
    mutationFn: async (documentId: string) => {
      deletingDocuments.add(documentId);
      const response = documentsClient[documentId].$delete();
      return await handleApiResponse<{ message: string }>(response);
    },
    onSuccess: (_, documentId) => {
      deletingDocuments.delete(documentId);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted", {
        description: "The document has been permanently deleted.",
      });
    },
    onError: (error: unknown, documentId) => {
      deletingDocuments.delete(documentId);
      
      // Handle specific error types
      if (error instanceof ApiError) {
        if (error.status === 403) {
          toast.error("Permission denied", {
            description: "You don't have permission to delete this document",
          });
          return;
        }
      }
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to delete document";
      toast.error("Delete failed", {
        description: errorMessage,
      });
    },
  });

  return {
    deleteDocument: mutation.mutate,
    isDeleting: (documentId: string) => deletingDocuments.has(documentId),
  };
}