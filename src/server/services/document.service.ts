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
import { documentPermissionsService } from "@/server/services/document-permissions.service";
import { type Document, type CreateDocumentInput, type UpdateDocumentInput, type DocumentSection, type DocumentCategory } from "@/types/document";
import { env } from "@/lib/env";

const MAX_FILE_SIZE = parseInt(env.S3_UPLOAD_MAX_SIZE || "104857600"); // 100MB default
const PRESIGNED_URL_EXPIRY = parseInt(env.S3_PRESIGNED_URL_EXPIRY || "300"); // 5 minutes default

const uploadDocumentSchema = type({
  bookingId: "string",
  uploadedById: "string",
  fileName: "string",
  fileSize: "number",
  mimeType: "string",
  section: "'ime_documents' | 'supplementary_documents'",
  category: "'consent_form' | 'document_brief' | 'dictation' | 'draft_report' | 'final_report'",
});

const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
];

export class DocumentService {
  async uploadDocument(
    data: {
      bookingId: string;
      uploadedById: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      section: DocumentSection;
      category: DocumentCategory;
      fileBuffer: Buffer;
      userRole?: string;
    },
    onProgress?: (progress: number) => void
  ): Promise<Document> {
    const { fileBuffer, userRole, ...dataWithoutBuffer } = data;
    
    // Auto-detect audio files and set category to dictation
    let finalCategory = data.category;
    if (AUDIO_MIME_TYPES.includes(data.mimeType.toLowerCase())) {
      finalCategory = "dictation";
    }
    
    const validationData = { ...dataWithoutBuffer, category: finalCategory };
    const validation = uploadDocumentSchema(validationData);
    if (validation instanceof type.errors) {
      throw new Error(`Invalid document data: ${validation.summary}`);
    }

    // Check upload permission
    if (userRole) {
      const role = documentPermissionsService.getUserRole(userRole);
      if (!documentPermissionsService.hasPermission({ role, category: finalCategory, permission: "upload" })) {
        throw new Error("You do not have permission to upload this document type");
      }
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
        section: data.section,
        category: finalCategory,
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
          section: data.section,
          category: finalCategory,
        },
      });

      return document;
    } catch (error) {
      await this.cleanupFailedUpload(s3Key);
      throw error;
    }
  }

  async getDocument(
    id: string, 
    userId: string, 
    context?: {
      userRole?: string;
      impersonatedUserId?: string;
    }
  ): Promise<Document | null> {
    const document = await documentRepository.findById(id);
    
    if (!document) {
      return null;
    }

    // For impersonation, check access as the impersonated user
    const effectiveUserId = context?.impersonatedUserId || userId;
    const hasAccess = await this.verifyAccess(document, effectiveUserId, context?.userRole);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    await auditService.log({
      action: "document.accessed",
      userId,
      impersonatedUserId: context?.impersonatedUserId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        fileName: document.fileName,
      },
    });

    return document;
  }

  async downloadDocument(
    id: string,
    userId: string,
    context?: {
      impersonatedUserId?: string;
      ipAddress?: string;
      userAgent?: string;
      range?: { start: number; end: number };
      userRole?: string;
    }
  ): Promise<{
    stream: ReadableStream | null;
    document: Document;
    contentLength?: number;
    contentRange?: string;
    acceptRanges?: string;
  }> {
    const startTime = Date.now();
    
    // First log access attempt
    await auditService.log({
      action: "document.accessed",
      userId,
      impersonatedUserId: context?.impersonatedUserId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        attempt: true,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
    
    try {
      // Comprehensive permission validation
      const document = await documentRepository.findById(id);
      
      if (!document) {
        // Log failed access attempt
        await auditService.log({
          action: "document.access_denied",
          userId,
          impersonatedUserId: context?.impersonatedUserId,
          resourceType: "document",
          resourceId: id,
          metadata: {
            reason: "Document not found",
          },
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
        throw new Error("Document not found");
      }

      // For impersonation, check access as the impersonated user
      const effectiveUserId = context?.impersonatedUserId || userId;
      const hasAccess = await this.verifyAccess(document, effectiveUserId, context?.userRole);
      if (!hasAccess) {
        // Log access denied
        await auditService.log({
          action: "document.access_denied",
          userId,
          impersonatedUserId: context?.impersonatedUserId,
          resourceType: "document",
          resourceId: id,
          metadata: {
            bookingId: document.bookingId,
            fileName: document.fileName,
            reason: "Insufficient permissions",
          },
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        });
        throw new Error("Access denied");
      }

      // Stream the document - never expose S3 URLs
      const downloadResult = await downloadObject(document.s3Key, context?.range);
      
      if (!downloadResult.stream) {
        throw new Error("Failed to download document");
      }

      // Log successful download
      const downloadDuration = Date.now() - startTime;
      await auditService.log({
        action: "document.downloaded",
        userId,
        impersonatedUserId: context?.impersonatedUserId,
        resourceType: "document",
        resourceId: id,
        metadata: {
          bookingId: document.bookingId,
          fileName: document.fileName,
          fileSize: document.fileSize,
          downloadDuration,
          mimeType: document.mimeType,
          category: document.category,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      return { 
        stream: downloadResult.stream, 
        document,
        contentLength: downloadResult.contentLength,
        contentRange: downloadResult.contentRange,
        acceptRanges: downloadResult.acceptRanges,
      };
    } catch (error) {
      // Log failed download attempt with reason
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await auditService.log({
        action: "document.download_failed",
        userId,
        impersonatedUserId: context?.impersonatedUserId,
        resourceType: "document",
        resourceId: id,
        metadata: {
          failureReason: errorMessage,
          downloadDuration: Date.now() - startTime,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      
      throw error;
    }
  }

  async getPresignedDownloadUrl(
    id: string, 
    userId: string,
    context?: {
      userRole?: string;
      impersonatedUserId?: string;
    }
  ): Promise<string> {
    const document = await this.getDocument(id, userId, context);
    
    if (!document) {
      throw new Error("Document not found");
    }

    const url = await getPresignedUrl(document.s3Key, PRESIGNED_URL_EXPIRY);

    await auditService.log({
      action: "document.presigned_url_generated",
      userId,
      impersonatedUserId: context?.impersonatedUserId,
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
    data: UpdateDocumentInput,
    context?: {
      userRole?: string;
      impersonatedUserId?: string;
    }
  ): Promise<Document> {
    const document = await this.getDocument(id, userId, context);
    
    if (!document) {
      throw new Error("Document not found");
    }

    const updated = await documentRepository.update(id, data);

    await auditService.log({
      action: "document.updated",
      userId,
      impersonatedUserId: context?.impersonatedUserId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        changes: data,
      },
    });

    return updated;
  }

  async deleteDocument(
    id: string, 
    userId: string, 
    context?: {
      userRole?: string;
      impersonatedUserId?: string;
    }
  ): Promise<void> {
    const document = await this.getDocument(id, userId, context);
    
    if (!document) {
      throw new Error("Document not found");
    }

    // Check delete permission
    if (context?.userRole) {
      const role = documentPermissionsService.getUserRole(context.userRole);
      if (!documentPermissionsService.hasPermission({ role, category: document.category, permission: "delete" })) {
        throw new Error("You do not have permission to delete this document type");
      }
    }

    // Perform hard delete as required for HIPAA compliance
    await documentRepository.hardDelete(id);
    
    await deleteS3Object(document.s3Key);

    await auditService.log({
      action: "document.deleted",
      userId,
      impersonatedUserId: context?.impersonatedUserId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        fileName: document.fileName,
        s3Key: document.s3Key,
      },
    });
  }

  async getDocumentsByBooking(
    bookingId: string, 
    userId: string,
    filters?: {
      section?: DocumentSection;
      category?: DocumentCategory;
      userRole?: string;
      impersonatedUserId?: string;
    }
  ): Promise<Document[]> {
    const documents = await documentRepository.findByBookingId(bookingId, filters);
    
    // For impersonation, check access as the impersonated user
    const effectiveUserId = filters?.impersonatedUserId || userId;
    
    const accessibleDocuments = [];
    for (const doc of documents) {
      const hasAccess = await this.verifyAccess(doc, effectiveUserId, filters?.userRole);
      if (hasAccess) {
        // Check download permission based on role
        if (filters?.userRole) {
          const role = documentPermissionsService.getUserRole(filters.userRole);
          if (documentPermissionsService.hasPermission({ role, category: doc.category, permission: "download" })) {
            accessibleDocuments.push(doc);
          }
        } else {
          accessibleDocuments.push(doc);
        }
      }
    }

    return accessibleDocuments;
  }

  private async verifyAccess(document: Document, userId: string, userRole?: string): Promise<boolean> {
    // Check if user is the document uploader
    if (document.uploadedById === userId) {
      return true;
    }

    try {
      // Use role-based access checks
      const hasRoleBasedAccess = await this.checkRoleBasedAccess(document.bookingId, userId, userRole);
      return hasRoleBasedAccess;
    } catch (error) {
      // For errors, log and deny access
      console.error("Error verifying document access:", error);
      return false;
    }
  }

  async checkRoleBasedAccess(bookingId: string, userId: string, userRole?: string): Promise<boolean> {
    // Get booking details to check relationships
    const booking = await bookingService.getBookingForAccess(bookingId);
    if (!booking) {
      return false;
    }

    // 1. Referrers see all documents for their own bookings
    if (booking.referrerId === userId) {
      return true;
    }

    // 2. Specialists see documents only for assigned bookings
    const specialistData = await bookingService.getSpecialistByUserId(userId);
    if (specialistData && booking.specialistId === specialistData.id) {
      return true;
    }

    // 3. Organization owners/managers see documents for their organization
    const orgMembership = await bookingService.getUserOrgMembership(userId);
    if (orgMembership && booking.organizationId === orgMembership.organizationId) {
      if (orgMembership.role === 'owner' || orgMembership.role === 'manager') {
        return true;
      }

      // 4. Team leads see documents for their team members' bookings
      if (orgMembership.role === 'team_lead' && orgMembership.teamIds.length > 0) {
        // Check if the booking's referrer is in the team lead's teams
        const isTeamMember = await bookingService.isUserInTeams(booking.referrerId, orgMembership.teamIds);
        if (isTeamMember) {
          return true;
        }
      }
    }

    // 5. Admins see all documents when impersonating referrers
    // This is handled at the route level with impersonation context
    // The userRole check here is for non-impersonated admin access
    if (userRole === 'admin') {
      // Admins don't have blanket access unless impersonating
      return false;
    }

    return false;
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