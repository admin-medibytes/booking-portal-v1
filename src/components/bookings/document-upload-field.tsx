"use client";

import { useState } from "react";
import { FileTextIcon, DownloadIcon, Trash2Icon, Calendar, HardDrive, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DocumentUploadModal } from "./document-upload-modal";
import { formatBytes } from "@/hooks/use-file-upload";
import { useDocuments, useDeleteDocument, useDownloadDocument } from "@/hooks/use-documents";
import type { DocumentSection, DocumentCategory } from "@/types/document";
import type { Document } from "@/types/document";
import { toast } from "sonner";
import { format } from "date-fns";

interface DocumentUploadFieldProps {
  label: string;
  bookingId: string;
  section: DocumentSection;
  category: DocumentCategory;
  maxSizeMB?: number;
  accept?: string;
}

export function DocumentUploadField({
  label,
  bookingId,
  section,
  category,
  maxSizeMB = 512,
  accept = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}: DocumentUploadFieldProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<Document | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch documents for this specific category and section
  const { data: documents = [], refetch } = useDocuments(bookingId, { section, category });
  const deleteDocument = useDeleteDocument();
  const downloadDocument = useDownloadDocument();

  const handleUploadComplete = () => {
    // Refetch documents after upload
    refetch();
    toast.success("Document uploaded successfully");
  };

  const openDeleteDialog = (doc: Document) => {
    setFileToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDocument.mutateAsync(fileToDelete.id);
      toast.success(`Document "${fileToDelete.fileName}" was deleted successfully`);
      refetch();
    } catch (error) {
      console.error("Error deleting document:", error);
      let errorMessage = "Failed to delete document";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleDownload = async (documentId: string, fileName: string) => {
    const toastId = toast.loading(`Downloading ${fileName}...`);
    try {
      await downloadDocument.mutateAsync(documentId);
      toast.success(`Downloaded ${fileName}`, { id: toastId });
    } catch (_error) {
      toast.error("Failed to download document", { id: toastId });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm">{label}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setIsModalOpen(true)}
        >
          Upload
        </Button>
      </div>
      <div className="space-y-2">
        {documents.length > 0 ? (
          <div className="w-full space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:shadow-md transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <FileTextIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate text-sm leading-5">
                        {doc.fileName}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="font-medium">{doc.uploadedBy?.name}</span>
                    </div>
                    <div className="h-3 w-px bg-gray-300" />
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                    </div>
                    <div className="h-3 w-px bg-gray-300" />
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      <span className="font-medium">{formatBytes(doc.fileSize)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center ml-2 space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => handleDownload(doc.id, doc.fileName)}
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => openDeleteDialog(doc)}
                    disabled={isDeleting && fileToDelete?.id === doc.id}
                  >
                    {isDeleting && fileToDelete?.id === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2Icon className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-input relative flex min-h-[100px] flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed p-4 bg-muted/20">
            <div className="flex flex-col items-center justify-center text-center">
              <div
                className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-full border bg-background"
                aria-hidden="true"
              >
                <FileTextIcon className="size-4 opacity-60" />
              </div>
              <p className="text-sm text-muted-foreground">No files uploaded</p>
            </div>
          </div>
        )}
      </div>

      <DocumentUploadModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        label={label}
        bookingId={bookingId}
        section={section}
        category={category}
        maxSizeMB={maxSizeMB}
        accept={accept}
        onUploadComplete={handleUploadComplete}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFile}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
