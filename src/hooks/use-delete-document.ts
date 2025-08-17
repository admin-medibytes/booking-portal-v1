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
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null && 'response' in error
        ? (error as {response?: {data?: {error?: string}}}).response?.data?.error || "Failed to delete document"
        : "Failed to delete document";
      toast.error(errorMessage);
    },
  });

  return {
    deleteDocument: mutation.mutate,
    isDeleting: (documentId: string) => deletingDocuments.has(documentId),
  };
}