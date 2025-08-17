export type DocumentSection = "ime_documents" | "supplementary_documents";

export type DocumentCategory = 
  | "consent_form"
  | "document_brief"
  | "dictation"
  | "draft_report"
  | "final_report";

export interface Document {
  id: string;
  bookingId: string;
  uploadedById: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
  };
  s3Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  section: DocumentSection;
  category: DocumentCategory;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateDocumentInput {
  bookingId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  section: DocumentSection;
  category: DocumentCategory;
}

export interface UpdateDocumentInput {
  fileName?: string;
  section?: DocumentSection;
  category?: DocumentCategory;
}

export interface DocumentMetadata {
  uploadedBy: string;
  bookingId: string;
  originalFileName: string;
}