import { useState, useCallback, useRef } from "react";
import {
  FileArchiveIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  HeadphonesIcon,
  ImageIcon,
  Trash2Icon,
  UploadIcon,
  VideoIcon,
  CheckCircleIcon,
  LoaderIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUploadDocument } from "@/hooks/use-upload-document";
import { documentPermissionsService } from "@/server/services/document-permissions.service";
import type { DocumentCategory, DocumentSection } from "@/types/document";

interface DocumentUploadProps {
  bookingId: string;
  section: DocumentSection;
  userRole?: string;
  onUploadComplete?: () => void;
  maxFiles?: number;
  maxSize?: number;
}

interface FileWithProgress {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
  category: DocumentCategory;
}

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "audio/mpeg": [".mp3"],
  "audio/mp4": [".m4a"],
  "audio/wav": [".wav"],
  "audio/x-m4a": [".m4a"],
  "audio/webm": [".webm"],
  "audio/ogg": [".ogg"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

const ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_TYPES).flat().join(",");
const MAX_FILE_SIZE = 104857600; // 100MB

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
];

function suggestCategory(file: File): DocumentCategory {
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  if (AUDIO_MIME_TYPES.includes(fileType) || fileName.match(/\.(mp3|m4a|wav|ogg|webm)$/)) {
    return "dictation";
  }
  if (fileName.includes("consent") || fileName.includes("authorization")) {
    return "consent_form";
  }
  if (fileName.includes("brief") || fileName.includes("summary")) {
    return "document_brief";
  }
  if (fileName.includes("draft") && fileName.includes("report")) {
    return "draft_report";
  }
  if (fileName.includes("final") && fileName.includes("report")) {
    return "final_report";
  }
  if (fileName.includes("report")) {
    return "draft_report";
  }
  return "document_brief";
}

function getFileIconAndColor(file: File) {
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
    return { icon: FileTextIcon, color: "text-red-600" };
  }
  if (fileType.includes("word") || fileName.match(/\.(doc|docx)$/)) {
    return { icon: FileTextIcon, color: "text-blue-600" };
  }
  if (fileType.startsWith("image/")) {
    return { icon: ImageIcon, color: "text-green-600" };
  }
  if (fileType.startsWith("audio/") || fileName.match(/\.(mp3|m4a|wav)$/)) {
    return { icon: HeadphonesIcon, color: "text-purple-600" };
  }
  if (fileType.includes("zip") || fileName.endsWith(".zip")) {
    return { icon: FileArchiveIcon, color: "text-yellow-600" };
  }
  if (fileType.includes("spreadsheet") || fileName.match(/\.(xls|xlsx|csv)$/)) {
    return { icon: FileSpreadsheetIcon, color: "text-green-600" };
  }
  if (fileType.startsWith("video/")) {
    return { icon: VideoIcon, color: "text-pink-600" };
  }
  return { icon: FileIcon, color: "text-gray-600" };
}

export function DocumentUpload({
  bookingId,
  section,
  userRole,
  onUploadComplete,
  maxFiles = 10,
  maxSize = MAX_FILE_SIZE,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument } = useUploadDocument();

  const role = documentPermissionsService.getUserRole(userRole);
  const availableCategories = documentPermissionsService.getAvailableCategoriesForSection(
    role,
    section
  );

  const handleFilesAdded = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const currentFileCount = files.filter((f) => f.status !== "error").length;
      const remainingSlots = maxFiles - currentFileCount;

      if (remainingSlots <= 0) {
        return;
      }

      const validFiles = fileArray.slice(0, remainingSlots).map((file) => {
        const suggestedCategory = suggestCategory(file);
        // Ensure suggested category is available for this user/section
        const finalCategory = availableCategories.includes(suggestedCategory)
          ? suggestedCategory
          : availableCategories[0] || "document_brief";

        if (file.size > maxSize) {
          return {
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            progress: 0,
            status: "error" as const,
            error: `File size exceeds ${formatBytes(maxSize)}`,
            category: finalCategory,
          };
        }

        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          progress: 0,
          status: "pending" as const,
          category: finalCategory,
        };
      });

      setFiles((prev) => [...prev, ...validFiles]);

      // Start uploading pending files
      validFiles
        .filter((f) => f.status === "pending")
        .forEach((fileWithProgress) => {
          uploadFile(fileWithProgress);
        });
    },
    [files, maxFiles, maxSize, availableCategories]
  );

  const uploadFile = useCallback(
    async (fileWithProgress: FileWithProgress) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileWithProgress.id ? { ...f, status: "uploading" } : f))
      );

      try {
        await uploadDocument(
          {
            file: fileWithProgress.file,
            bookingId,
            section,
            category: fileWithProgress.category,
          },
          (progress) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === fileWithProgress.id ? { ...f, progress } : f))
            );
          }
        );

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileWithProgress.id ? { ...f, status: "completed", progress: 100 } : f
          )
        );

        onUploadComplete?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileWithProgress.id ? { ...f, status: "error", error: errorMessage } : f
          )
        );
      }
    },
    [bookingId, onUploadComplete, uploadDocument]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFilesAdded(e.dataTransfer.files);
    },
    [handleFilesAdded]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFilesAdded(e.target.files);
      }
    },
    [handleFilesAdded]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updateFileCategory = useCallback((id: string, category: DocumentCategory) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, category } : f)));
  }, []);

  const retryUpload = useCallback(
    (fileWithProgress: FileWithProgress) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileWithProgress.id
            ? { ...f, status: "pending", progress: 0, error: undefined }
            : f
        )
      );
      uploadFile(fileWithProgress);
    },
    [uploadFile]
  );

  const completedCount = files.filter((f) => f.status === "completed").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400",
          files.length >= maxFiles && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileInput}
          className="hidden"
          disabled={files.length >= maxFiles}
        />
        <UploadIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium mb-2">Drag and drop files here, or click to browse</p>
        <p className="text-sm text-gray-500 mb-2">Maximum file size: {formatBytes(maxSize)}</p>
        <p className="text-xs text-gray-400 mb-4">
          Accepted formats: PDF, Word docs, images (JPG, PNG), audio files (MP3, M4A, WAV), and ZIP
          archives
        </p>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= maxFiles}
          variant="outline"
        >
          Select Files
        </Button>
        {files.length >= maxFiles && (
          <p className="text-sm text-orange-600 mt-2">Maximum {maxFiles} files allowed</p>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          {completedCount > 0 && (
            <p className="text-sm text-green-600">
              {completedCount} file{completedCount !== 1 ? "s" : ""} uploaded successfully
            </p>
          )}
          {uploadingCount > 0 && (
            <p className="text-sm text-blue-600">
              Uploading {uploadingCount} file{uploadingCount !== 1 ? "s" : ""}...
            </p>
          )}
          {errorCount > 0 && (
            <p className="text-sm text-red-600">
              {errorCount} file{errorCount !== 1 ? "s" : ""} failed to upload
            </p>
          )}

          {files.map((fileItem) => {
            const { icon: FileIcon, color } = getFileIconAndColor(fileItem.file);
            return (
              <div
                key={fileItem.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
              >
                <FileIcon className={cn("w-10 h-10", color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                    <span className="text-xs text-gray-500">{formatBytes(fileItem.file.size)}</span>
                  </div>
                  {fileItem.status === "uploading" && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${fileItem.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{fileItem.progress}%</span>
                    </div>
                  )}
                  {fileItem.status === "error" && (
                    <p className="text-xs text-red-600">{fileItem.error}</p>
                  )}
                  {fileItem.status === "pending" && (
                    <Select
                      value={fileItem.category}
                      onValueChange={(value: DocumentCategory) =>
                        updateFileCategory(fileItem.id, value)
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat === "consent_form" && "Consent Form"}
                            {cat === "document_brief" && "Document Brief"}
                            {cat === "dictation" && "Dictation"}
                            {cat === "draft_report" && "Draft Report"}
                            {cat === "final_report" && "Final Report"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {fileItem.status === "uploading" && (
                    <LoaderIcon className="w-4 h-4 animate-spin text-blue-600" />
                  )}
                  {fileItem.status === "completed" && (
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  )}
                  {fileItem.status === "error" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retryUpload(fileItem)}
                      className="text-xs"
                    >
                      Retry
                    </Button>
                  )}
                  {(fileItem.status === "pending" || fileItem.status === "error") && (
                    <Button variant="ghost" size="sm" onClick={() => removeFile(fileItem.id)}>
                      <Trash2Icon className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
