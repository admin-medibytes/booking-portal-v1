"use client";

import { useState } from "react";
import {
  AlertCircleIcon,
  FileTextIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/hooks/use-file-upload";
import { useDirectUpload } from "@/hooks/use-documents";
import type { DocumentSection, DocumentCategory } from "@/types/document";
import { toast } from "sonner";

interface DocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  bookingId: string;
  section: DocumentSection;
  category: DocumentCategory;
  maxSizeMB?: number;
  accept?: string;
  onUploadComplete?: () => void;
}

// Helper function to parse accept string and generate user-friendly file types text
function getAcceptedFileTypesText(accept: string): string {
  const extensions = new Set<string>();

  // Extract file extensions from the accept string
  const parts = accept.split(',').map(part => part.trim());

  parts.forEach(part => {
    if (part.startsWith('.')) {
      // Direct extension like .pdf
      extensions.add(part.substring(1).toUpperCase());
    } else if (part === 'audio/*') {
      // Generic audio type
      extensions.add('AUDIO');
    } else if (part.startsWith('audio/')) {
      // Specific audio MIME types - extract common ones
      if (part.includes('mpeg')) extensions.add('MP3');
      if (part.includes('wav')) extensions.add('WAV');
      if (part.includes('mp4') || part.includes('m4a')) extensions.add('M4A');
      if (part.includes('ogg')) extensions.add('OGG');
      if (part.includes('webm')) extensions.add('WEBM');
    } else if (part.startsWith('video/')) {
      // Specific video MIME types
      if (part.includes('mp4')) extensions.add('MP4');
    } else if (part === 'application/pdf') {
      extensions.add('PDF');
    } else if (part.includes('msword') || part.includes('wordprocessingml')) {
      extensions.add('DOC');
      extensions.add('DOCX');
    }
  });

  // Convert to array and sort
  const extensionsArray = Array.from(extensions).sort();

  // If we have AUDIO as a generic type, simplify the display
  if (extensionsArray.includes('AUDIO')) {
    const nonAudio = extensionsArray.filter(ext => !['MP3', 'WAV', 'M4A', 'OGG', 'WEBM', 'OPUS', 'FLAC', 'AAC', 'WMA'].includes(ext));
    if (nonAudio.length > 0 && nonAudio[0] !== 'AUDIO') {
      return [...nonAudio, 'Audio files'].join(', ');
    }
    return nonAudio.join(', ');
  }

  return extensionsArray.join(', ');
}

export function DocumentUploadModal({
  open,
  onOpenChange,
  label,
  bookingId,
  section,
  category,
  maxSizeMB = 512,
  accept = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  onUploadComplete,
}: DocumentUploadModalProps) {
  const maxSize = maxSizeMB * 1024 * 1024;
  const [uploading, setUploading] = useState(false);
  const directUpload = useDirectUpload();
  const acceptedFileTypesText = getAcceptedFileTypesText(accept);

  const handleUpload = async () => {
    setUploading(true);

    try {
      const validFiles = files
        .map((f) => (f.file instanceof File ? f.file : null))
        .filter((f): f is File => f !== null);

      if (validFiles.length === 0) {
        toast.error("No valid files to upload");
        return;
      }

      const result = await directUpload.mutateAsync({
        files: validFiles,
        bookingId,
        section,
        category,
      });

      if (result.successfulUploads > 0) {
        toast.success(
          `Successfully uploaded ${result.successfulUploads} file${result.successfulUploads !== 1 ? "s" : ""}`
        );

        if (onUploadComplete) {
          onUploadComplete();
        }

        onOpenChange(false);
        clearFiles();
      }

      if (result.failedUploads > 0) {
        toast.error(
          `${result.failedUploads} file${result.failedUploads !== 1 ? "s" : ""} failed to upload`
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
      clearFiles,
    },
  ] = useFileUpload({
    accept,
    maxSize,
    multiple: true,
  });

  const handleRemoveFile = (id: string) => {
    removeFile(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload {label}</DialogTitle>
          <DialogDescription>
            Upload your documents ({acceptedFileTypesText} - max {maxSizeMB}MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            data-dragging={isDragging || undefined}
            className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-[160px] flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors has-[input:focus]:ring-[3px]"
          >
            <input
              {...getInputProps()}
              className="sr-only"
              aria-label={`Upload ${label}`}
            />
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div
                className="bg-background mb-3 flex size-12 shrink-0 items-center justify-center rounded-full border"
                aria-hidden="true"
              >
                <UploadIcon className="size-5 opacity-60" />
              </div>
              <p className="mb-1.5 text-sm font-medium">
                Drop your files here or click to browse
              </p>
              <p className="text-muted-foreground text-xs">
                {acceptedFileTypesText} (max. {maxSizeMB}MB per file)
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={openFileDialog}
                type="button"
              >
                <UploadIcon className="-ms-1 size-4 opacity-60" aria-hidden="true" />
                Select files
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {errors.length > 0 && (
            <div
              className="text-destructive flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm"
              role="alert"
            >
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{errors[0]}</span>
            </div>
          )}

          {/* Files List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <p className="text-sm font-medium">
                Selected Files ({files.length})
              </p>
              {files.map((fileWithPreview) => (
                <div
                  key={fileWithPreview.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileTextIcon className="size-5 opacity-60" />
                  </div>
                  <div className="flex-1 w-[290px] ">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {fileWithPreview.file.name}
                      </p>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => handleRemoveFile(fileWithPreview.id)}
                        aria-label={`Remove ${fileWithPreview.file.name}`}
                        disabled={uploading}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatBytes(fileWithPreview.file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              type="button"
              disabled={uploading || files.length === 0}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
