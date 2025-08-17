import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const deletingDocuments = new Set<string>();

  const mutation = useMutation({
    mutationFn: async (documentId: string) => {
      deletingDocuments.add(documentId);
      const response = await apiClient.delete<{ message: string }>(`/documents/${documentId}`);
      return response;
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
      if (error instanceof Error && 'status' in error) {
        const statusError = error as Error & { status: number };
        if (statusError.status === 403) {
          toast.error("Permission denied", {
            description: "You don't have permission to delete this document",
          });
          return;
        }
      }
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null && 'response' in error
        ? (error as {response?: {data?: {error?: string}}}).response?.data?.error || "Failed to delete document"
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