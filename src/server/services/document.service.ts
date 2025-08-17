import { type } from "arktype";
import { randomUUID } from "crypto";
import {
  uploadObject,
  uploadMultipart,
  getPresignedUrl,
  downloadObject,
  deleteObject as deleteS3Object,
  shouldUseMultipart,
} from "@/lib/s3";
import { documentRepository } from "@/server/repositories/document.repository";
import { auditService } from "@/server/services/audit.service";
import { bookingService } from "@/server/services/booking.service";
import { type Document, type CreateDocumentInput, type UpdateDocumentInput } from "@/types/document";
import { env } from "@/lib/env";

const MAX_FILE_SIZE = parseInt(env.S3_UPLOAD_MAX_SIZE || "104857600"); // 100MB default
const PRESIGNED_URL_EXPIRY = parseInt(env.S3_PRESIGNED_URL_EXPIRY || "300"); // 5 minutes default

const uploadDocumentSchema = type({
  bookingId: "string",
  uploadedById: "string",
  fileName: "string",
  fileSize: "number",
  mimeType: "string",
  category: "'consent_form' | 'brief' | 'report' | 'dictation' | 'other'",
});

export class DocumentService {
  async uploadDocument(
    data: {
      bookingId: string;
      uploadedById: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      category: Document["category"];
      fileBuffer: Buffer;
    },
    onProgress?: (progress: number) => void
  ): Promise<Document> {
    const { fileBuffer, ...dataWithoutBuffer } = data;
    const validation = uploadDocumentSchema(dataWithoutBuffer);
    if (validation instanceof type.errors) {
      throw new Error(`Invalid document data: ${validation.summary}`);
    }

    if (data.fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`);
    }

    const documentId = randomUUID();
    const timestamp = new Date().toISOString();
    const sanitizedFileName = data.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `${data.bookingId}/${documentId}/${timestamp}_${sanitizedFileName}`;

    try {
      if (shouldUseMultipart(data.fileSize)) {
        await uploadMultipart({
          key: s3Key,
          body: fileBuffer,
          contentType: data.mimeType,
          metadata: {
            uploadedBy: data.uploadedById,
            bookingId: data.bookingId,
            originalFileName: data.fileName,
          },
          onProgress,
        });
      } else {
        await uploadObject({
          key: s3Key,
          body: fileBuffer,
          contentType: data.mimeType,
          metadata: {
            uploadedBy: data.uploadedById,
            bookingId: data.bookingId,
            originalFileName: data.fileName,
          },
        });
      }

      const documentInput: CreateDocumentInput = {
        bookingId: data.bookingId,
        uploadedById: data.uploadedById,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        category: data.category,
      };

      const document = await documentRepository.create({
        ...documentInput,
        id: documentId,
        s3Key,
      });

      await auditService.log({
        action: "document.uploaded",
        userId: data.uploadedById,
        resourceType: "document",
        resourceId: document.id,
        metadata: {
          bookingId: data.bookingId,
          fileName: data.fileName,
          fileSize: data.fileSize,
          category: data.category,
        },
      });

      return document;
    } catch (error) {
      await this.cleanupFailedUpload(s3Key);
      throw error;
    }
  }

  async getDocument(id: string, userId: string): Promise<Document | null> {
    const document = await documentRepository.findById(id);
    
    if (!document) {
      return null;
    }

    const hasAccess = await this.verifyAccess(document, userId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    await auditService.log({
      action: "document.accessed",
      userId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        fileName: document.fileName,
      },
    });

    return document;
  }

  async downloadDocument(id: string, userId: string): Promise<{
    stream: ReadableStream | null;
    document: Document;
  }> {
    const document = await this.getDocument(id, userId);
    
    if (!document) {
      throw new Error("Document not found");
    }

    const stream = await downloadObject(document.s3Key);
    
    if (!stream) {
      throw new Error("Failed to download document");
    }

    await auditService.log({
      action: "document.downloaded",
      userId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        fileName: document.fileName,
      },
    });

    return { stream, document };
  }

  async getPresignedDownloadUrl(id: string, userId: string): Promise<string> {
    const document = await this.getDocument(id, userId);
    
    if (!document) {
      throw new Error("Document not found");
    }

    const url = await getPresignedUrl(document.s3Key, PRESIGNED_URL_EXPIRY);

    await auditService.log({
      action: "document.presigned_url_generated",
      userId,
      resourceType: "document", 
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        expiresIn: PRESIGNED_URL_EXPIRY,
      },
    });

    return url;
  }

  async updateDocument(
    id: string,
    userId: string,
    data: UpdateDocumentInput
  ): Promise<Document> {
    const document = await this.getDocument(id, userId);
    
    if (!document) {
      throw new Error("Document not found");
    }

    const updated = await documentRepository.update(id, data);

    await auditService.log({
      action: "document.updated",
      userId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        changes: data,
      },
    });

    return updated;
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const document = await this.getDocument(id, userId);
    
    if (!document) {
      throw new Error("Document not found");
    }

    await documentRepository.softDelete(id);
    
    await deleteS3Object(document.s3Key);

    await auditService.log({
      action: "document.deleted",
      userId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        fileName: document.fileName,
        s3Key: document.s3Key,
      },
    });
  }

  async getDocumentsByBooking(bookingId: string, userId: string): Promise<Document[]> {
    const documents = await documentRepository.findByBookingId(bookingId);
    
    const accessibleDocuments = [];
    for (const doc of documents) {
      const hasAccess = await this.verifyAccess(doc, userId);
      if (hasAccess) {
        accessibleDocuments.push(doc);
      }
    }

    return accessibleDocuments;
  }

  private async verifyAccess(document: Document, userId: string): Promise<boolean> {
    // Check if user is the document uploader
    if (document.uploadedById === userId) {
      return true;
    }

    try {
      // For now, use the booking service to check access
      // This leverages the existing access control logic in booking service
      const systemUser = { id: userId, role: 'user' as const };
      const booking = await bookingService.getBookingById(document.bookingId, systemUser);
      
      // If user has access to the booking, they have access to its documents
      return !!booking;
    } catch (error) {
      // If access is denied or booking not found, return false
      if (error instanceof Error && (error.name === 'AccessDeniedError' || error.name === 'BookingNotFoundError')) {
        return false;
      }
      
      // For other errors, log and deny access
      console.error("Error verifying document access:", error);
      return false;
    }
  }

  private async cleanupFailedUpload(s3Key: string): Promise<void> {
    try {
      await deleteS3Object(s3Key);
    } catch (error) {
      console.error("Failed to cleanup S3 object:", error);
    }
  }
}

export const documentService = new DocumentService();