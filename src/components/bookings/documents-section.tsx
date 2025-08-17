import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Upload, FileArchive, FileSpreadsheet, HeadphonesIcon, FileIcon } from "lucide-react";
import { DocumentUpload } from "@/components/documents/document-upload";
import { useDocuments } from "@/hooks/use-documents";
import { cn } from "@/lib/utils";
import type { Document, DocumentCategory } from "@/types/document";

interface DocumentsSectionProps {
  bookingId: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getDocumentIcon(document: Document) {
  const mimeType = document.mimeType.toLowerCase();
  const fileName = document.fileName.toLowerCase();

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return { icon: FileText, color: "text-red-600" };
  }
  if (mimeType.includes("word") || fileName.match(/\.(doc|docx)$/)) {
    return { icon: FileText, color: "text-blue-600" };
  }
  if (mimeType.startsWith("audio/") || fileName.match(/\.(mp3|m4a|wav)$/)) {
    return { icon: HeadphonesIcon, color: "text-purple-600" };
  }
  if (mimeType.includes("zip") || fileName.endsWith(".zip")) {
    return { icon: FileArchive, color: "text-yellow-600" };
  }
  if (mimeType.includes("spreadsheet") || fileName.match(/\.(xls|xlsx|csv)$/)) {
    return { icon: FileSpreadsheet, color: "text-green-600" };
  }
  return { icon: FileIcon, color: "text-gray-600" };
}

function getCategoryLabel(category: DocumentCategory): string {
  const labels: Record<DocumentCategory, string> = {
    consent_form: "Consent Form",
    brief: "Brief",
    report: "Report",
    dictation: "Dictation",
    other: "Other",
  };
  return labels[category] || category;
}

function groupDocumentsByCategory(documents: Document[]) {
  const grouped = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<DocumentCategory, Document[]>);

  // Sort categories in a logical order
  const categoryOrder: DocumentCategory[] = ["consent_form", "brief", "report", "dictation", "other"];
  const sortedCategories = categoryOrder.filter((cat) => grouped[cat]);

  return sortedCategories.map((category) => ({
    category,
    documents: grouped[category].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  }));
}

export function DocumentsSection({ bookingId }: DocumentsSectionProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const { data: documents = [], isLoading, refetch } = useDocuments(bookingId);

  const documentCount = documents.length;
  const groupedDocuments = groupDocumentsByCategory(documents);

  const handleUploadComplete = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading documents...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documents
          </div>
          <div className="flex items-center gap-3">
            {documentCount > 0 && (
              <span className="text-sm font-normal text-gray-500">
                {documentCount} document{documentCount !== 1 ? "s" : ""}
              </span>
            )}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload Documents</DialogTitle>
                  <DialogDescription>
                    Upload examination-related documents. Files are securely stored and accessible only to authorized users.
                  </DialogDescription>
                </DialogHeader>
                <DocumentUpload
                  bookingId={bookingId}
                  onUploadComplete={handleUploadComplete}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documentCount === 0 ? (
          <div className="text-center py-8">
            <Upload className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-2">No documents uploaded</p>
            <p className="text-sm text-gray-400 mb-4">
              Upload consent forms, briefs, reports, and other examination documents.
            </p>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Documents
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedDocuments.map(({ category, documents: categoryDocs }) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  {getCategoryLabel(category)} ({categoryDocs.length})
                </h4>
                <div className="space-y-2">
                  {categoryDocs.map((doc) => {
                    const { icon: DocIcon, color } = getDocumentIcon(doc);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <DocIcon className={cn("w-5 h-5 flex-shrink-0", color)} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {formatBytes(doc.fileSize)} • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={() => {
                            // Download functionality will be implemented in a future story
                            window.open(`/api/documents/${doc.id}`, "_blank");
                          }}
                        >
                          Download
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}