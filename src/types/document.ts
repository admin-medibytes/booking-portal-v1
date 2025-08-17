export interface Document {
  id: string;
  bookingId: string;
  uploadedById: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: "consent_form" | "brief" | "report" | "dictation" | "other";
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type DocumentCategory = Document["category"];

export interface CreateDocumentInput {
  bookingId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: DocumentCategory;
}

export interface UpdateDocumentInput {
  fileName?: string;
  category?: DocumentCategory;
}

export interface DocumentMetadata {
  uploadedBy: string;
  bookingId: string;
  originalFileName: string;
}