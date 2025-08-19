import { useState, useMemo } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileText,
  Upload,
  FileArchive,
  FileSpreadsheet,
  HeadphonesIcon,
  FileIcon,
  Download,
  Loader2,
  Trash2,
  ArrowUpDown,
  Info,
} from "lucide-react";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentPermissionsMatrix } from "@/components/documents/document-permissions-matrix";
import { useDocuments } from "@/hooks/use-documents";
import { useDownloadDocument } from "@/hooks/use-download-document";
import { useDeleteDocument } from "@/hooks/use-delete-document";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { documentPermissionsService } from "@/server/services/document-permissions.service";
import type { Document, DocumentCategory, DocumentSection } from "@/types/document";

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
    document_brief: "Document Brief",
    dictation: "Dictation",
    draft_report: "Draft Report",
    final_report: "Final Report",
  };
  return labels[category] || category;
}

type SortOption = "date" | "name" | "category";

function sortDocuments(documents: Document[], sortBy: SortOption): Document[] {
  const sorted = [...documents];

  switch (sortBy) {
    case "date":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "name":
      return sorted.sort((a, b) => a.fileName.localeCompare(b.fileName));
    case "category":
      return sorted.sort((a, b) => a.category.localeCompare(b.category));
    default:
      return sorted;
  }
}

function getRolePermissionText(memberRole?: string): string {
  switch (memberRole) {
    case "referrer":
      return "As a referrer, you can upload and manage consent forms and document briefs. You can view final reports (PDF only).";
    case "specialist":
      return "As a specialist, you can manage dictations, drafts, and final reports. You can view document briefs.";
    case "owner":
    case "manager":
      return "As an organization owner/manager, you have full access to all documents for bookings in your organization.";
    case "team_lead":
      return "As a team lead, you can access all documents for bookings created by your team members.";
    case "admin":
      return "As an admin, you can access documents when impersonating a referrer.";
    default:
      return "Your access to documents is determined by your role in the organization.";
  }
}

export function DocumentsSection({ bookingId }: DocumentsSectionProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DocumentSection>("ime_documents");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const { user } = useAuth();
  const {
    data: documents = [],
    isLoading,
    refetch,
  } = useDocuments(bookingId, {
    section: activeTab,
  });
  const { downloadDocument, isDownloading, getProgress } = useDownloadDocument();
  const { deleteDocument, isDeleting } = useDeleteDocument();

  const userRole = documentPermissionsService.getUserRole(user?.memberRole);

  // Filter documents by category
  const filteredDocuments = useMemo(() => {
    if (categoryFilter === "all") return documents;
    return documents.filter((doc) => doc.category === categoryFilter);
  }, [documents, categoryFilter]);

  // Sort documents
  const sortedDocuments = useMemo(() => {
    return sortDocuments(filteredDocuments, sortBy);
  }, [filteredDocuments, sortBy]);

  // Count documents by category
  const categoryCounts = useMemo(() => {
    const counts: Record<DocumentCategory, number> = {
      consent_form: 0,
      document_brief: 0,
      dictation: 0,
      draft_report: 0,
      final_report: 0,
    };
    documents.forEach((doc) => {
      counts[doc.category] = (counts[doc.category] || 0) + 1;
    });
    return counts;
  }, [documents]);

  // Get available categories for current tab
  const availableCategories = useMemo(() => {
    if (activeTab === "ime_documents") {
      return Object.keys(categoryCounts) as DocumentCategory[];
    } else {
      return (Object.keys(categoryCounts) as DocumentCategory[]).filter(
        (cat) => cat !== "consent_form"
      );
    }
  }, [activeTab, categoryCounts]);

  const handleUploadComplete = () => {
    refetch();
  };

  const handleDownload = (doc: Document) => {
    downloadDocument(doc.id, doc.fileName);
  };

  const handleDelete = async (doc: Document) => {
    if (
      confirm(`Are you sure you want to delete "${doc.fileName}"? This action cannot be undone.`)
    ) {
      await deleteDocument(doc.id);
      refetch();
    }
  };

  // const canUpload = (category: DocumentCategory) => {
  //   return documentPermissionsService.hasPermission({ role: userRole, category, permission: "upload" });
  // };

  const canDownload = (category: DocumentCategory) => {
    return documentPermissionsService.hasPermission({
      role: userRole,
      category,
      permission: "download",
    });
  };

  const canDelete = (category: DocumentCategory) => {
    return documentPermissionsService.hasPermission({
      role: userRole,
      category,
      permission: "delete",
    });
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
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-md">
                  <div className="space-y-2">
                    <p className="font-medium">Document Access Permissions</p>
                    <p className="text-sm">{getRolePermissionText(user?.memberRole)}</p>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Access is role-based and automatically determined by your relationship to
                        the booking.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => setPermissionsDialogOpen(true)}
                      >
                        View full permissions matrix
                      </Button>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
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
                    Upload examination-related documents to{" "}
                    {activeTab === "ime_documents" ? "IME Documents" : "Supplementary Documents"}.
                  </DialogDescription>
                </DialogHeader>
                <DocumentUpload
                  bookingId={bookingId}
                  section={activeTab}
                  userRole={user?.memberRole}
                  onUploadComplete={handleUploadComplete}
                />
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(value: string) => setActiveTab(value as DocumentSection)}
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="ime_documents">IME Documents</TabsTrigger>
              <TabsTrigger value="supplementary_documents">Supplementary Documents</TabsTrigger>
            </TabsList>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => setCategoryFilter(value as DocumentCategory | "all")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {getCategoryLabel(category)} ({categoryCounts[category] || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4" />
                        Date
                      </div>
                    </SelectItem>
                    <SelectItem value="name">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4" />
                        Name
                      </div>
                    </SelectItem>
                    <SelectItem value="category">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4" />
                        Category
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-gray-500">
                {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""}
              </div>
            </div>

            <TabsContent value={activeTab}>
              {sortedDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-2">No documents uploaded</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Upload consent forms, briefs, reports, and other examination documents.
                  </p>
                  <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Documents
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {availableCategories.map((category) => {
                    const categoryDocs = sortedDocuments.filter((doc) => doc.category === category);
                    if (categoryDocs.length === 0 && categoryFilter !== "all") return null;

                    return (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-medium text-gray-700">
                            {getCategoryLabel(category)}
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            {categoryDocs.length}
                          </Badge>
                        </div>
                        {categoryDocs.length > 0 ? (
                          <div className="space-y-2">
                            {categoryDocs.map((doc) => {
                              const { icon: DocIcon, color } = getDocumentIcon(doc);
                              const downloading = isDownloading(doc.id);
                              const progress = getProgress(doc.id);

                              return (
                                <div
                                  key={doc.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <DocIcon className={cn("w-5 h-5 flex-shrink-0", color)} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                                      <p className="text-xs text-gray-500">
                                        {formatBytes(doc.fileSize)} • Uploaded{" "}
                                        {new Date(doc.createdAt).toLocaleDateString()}
                                        {doc.uploadedBy && ` by ${doc.uploadedBy.name}`}
                                      </p>
                                      {downloading && (
                                        <div className="mt-2 space-y-1">
                                          <Progress value={progress} className="h-1" />
                                          <p className="text-xs text-gray-500">
                                            {progress}% downloaded
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {canDownload(doc.category) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-shrink-0"
                                        onClick={() => handleDownload(doc)}
                                        disabled={downloading}
                                      >
                                        {downloading ? (
                                          <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Downloading
                                          </>
                                        ) : (
                                          <>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                          </>
                                        )}
                                      </Button>
                                    )}
                                    {canDelete(doc.category) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-shrink-0"
                                        onClick={() => handleDelete(doc)}
                                        disabled={isDeleting(doc.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            No {getCategoryLabel(category).toLowerCase()} uploaded
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Access Permissions</DialogTitle>
            <DialogDescription>
              Understand how different roles can interact with various document types.
            </DialogDescription>
          </DialogHeader>
          <DocumentPermissionsMatrix />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
