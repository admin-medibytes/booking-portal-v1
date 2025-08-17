import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface DownloadProgress {
  documentId: string;
  progress: number;
  isDownloading: boolean;
}

export function useDownloadDocument() {
  const router = useRouter();
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});

  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      // Set initial progress
      setDownloadProgress((prev) => ({
        ...prev,
        [documentId]: { documentId, progress: 0, isDownloading: true },
      }));

      const response = await fetch(`/api/documents/${documentId}`, {
        credentials: "include",
        headers: {
          Accept: "*/*",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired - redirect to login
          router.push("/login");
          return;
        }
        
        if (response.status === 403) {
          // Access denied
          const data = await response.json();
          toast.error(data.message || "You don't have permission to download this document");
          return;
        }
        
        if (response.status === 429) {
          // Rate limit exceeded
          const data = await response.json();
          toast.error(data.message || "Too many download requests. Please try again later.");
          return;
        }

        throw new Error(`Download failed with status: ${response.status}`);
      }

      // Get content length for progress tracking
      const contentLength = response.headers.get("content-length");
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

      // Handle the response as a stream for progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read response stream");
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;

        // Update progress
        if (totalSize > 0) {
          const progress = Math.round((receivedLength / totalSize) * 100);
          setDownloadProgress((prev) => ({
            ...prev,
            [documentId]: { documentId, progress, isDownloading: true },
          }));
        }
      }

      // Combine chunks into a single blob
      const blob = new Blob(chunks as BlobPart[], {
        type: response.headers.get("content-type") || "application/octet-stream",
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Clear progress
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[documentId];
        return newProgress;
      });

      toast.success("Document downloaded successfully");
    } catch (error) {
      // Clear progress on error
      setDownloadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[documentId];
        return newProgress;
      });

      console.error("Download error:", error);
      toast.error("Failed to download document. Please try again.");
    }
  };

  const retryDownload = (documentId: string, fileName: string) => {
    downloadDocument(documentId, fileName);
  };

  return {
    downloadDocument,
    retryDownload,
    downloadProgress,
    isDownloading: (documentId: string) => !!downloadProgress[documentId]?.isDownloading,
    getProgress: (documentId: string) => downloadProgress[documentId]?.progress || 0,
  };
}