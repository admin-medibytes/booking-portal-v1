import { randomUUID } from "crypto";
import {
  generateS3Key,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  downloadS3ObjectStream,
  deleteS3Object,
  s3Client,
  getS3Bucket,
  PRESIGNED_URL_EXPIRATION,
} from "@/server/utils/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { documentRepository } from "@/server/repositories/document.repository";
import { auditService } from "@/server/services/audit.service";
import { bookingService } from "@/server/services/booking.service";
import { documentPermissionsService } from "@/server/services/document-permissions.service";
import { type Document, type CreateDocumentInput, type UpdateDocumentInput, type DocumentSection, type DocumentCategory } from "@/types/document";
import { validateBookingDocumentUpload } from "@/server/utils/file-validation";

const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
];

export interface InitiateUploadInput {
  bookingId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  section: DocumentSection;
  category: DocumentCategory;
}

export interface InitiateUploadResult {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export class DocumentService {
  /**
   * Initiate file upload - Generate presigned URL for client-side upload
   * HIPAA Compliance: Validates file before allowing upload
   */
  async initiateUpload(
    input: InitiateUploadInput,
    context?: {
      ipAddress?: string;
      userAgent?: string;
      userRole?: string;
    }
  ): Promise<InitiateUploadResult> {
    // Auto-detect audio files and set category to dictation
    let finalCategory = input.category;
    if (AUDIO_MIME_TYPES.includes(input.mimeType.toLowerCase())) {
      finalCategory = "dictation";
    }

    // Validate file upload
    validateBookingDocumentUpload(input.fileName, input.mimeType, input.fileSize, finalCategory);

    // Check upload permission
    if (context?.userRole) {
      const role = documentPermissionsService.getUserRole(context.userRole);
      if (!documentPermissionsService.hasPermission({ role, category: finalCategory, permission: "upload" })) {
        throw new Error("You do not have permission to upload this document type");
      }
    }

    const documentId = randomUUID();
    const s3Key = generateS3Key(input.bookingId, input.fileName, input.uploadedById);

    // Generate presigned URL
    const uploadUrl = await generatePresignedUploadUrl(s3Key, input.mimeType, {
      uploadedBy: input.uploadedById,
      bookingId: input.bookingId,
      originalFileName: input.fileName,
    });

    // Log upload initiation
    await auditService.log({
      action: "document.upload_initiated",
      userId: input.uploadedById,
      resourceType: "document",
      resourceId: documentId,
      metadata: {
        bookingId: input.bookingId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        section: input.section,
        category: finalCategory,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      documentId,
      uploadUrl,
      s3Key,
      expiresIn: PRESIGNED_URL_EXPIRATION,
    };
  }

  /**
   * Confirm upload - Save document metadata after successful S3 upload
   * HIPAA Compliance: Only creates database record if upload confirmed
   */
  async confirmUpload(
    documentId: string,
    s3Key: string,
    input: CreateDocumentInput,
    context?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<Document> {
    // Create document record in database
    const document = await documentRepository.create({
      ...input,
      id: documentId,
      s3Key,
    });

    // Log successful upload
    await auditService.log({
      action: "document.uploaded",
      userId: input.uploadedById,
      resourceType: "document",
      resourceId: documentId,
      metadata: {
        bookingId: input.bookingId,
        s3Key,
        fileName: input.fileName,
        fileSize: input.fileSize,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return document;
  }

  /**
   * Direct upload - Upload file directly to S3 from server
   * Simpler approach for smaller files without client-side presigned URLs
   */
  async uploadDocumentDirect(data: {
    bookingId: string;
    uploadedById: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    section: DocumentSection;
    category: DocumentCategory;
    fileBuffer: Buffer;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Document> {
    const { fileBuffer, userRole, ipAddress, userAgent } = data;

    // Auto-detect audio files and set category to dictation
    let finalCategory = data.category;
    if (AUDIO_MIME_TYPES.includes(data.mimeType.toLowerCase())) {
      finalCategory = "dictation";
    }

    // Validate file upload
    validateBookingDocumentUpload(data.fileName, data.mimeType, data.fileSize, finalCategory);

    // Check upload permission
    if (userRole) {
      const role = documentPermissionsService.getUserRole(userRole);
      if (!documentPermissionsService.hasPermission({ role, category: finalCategory, permission: "upload" })) {
        throw new Error("You do not have permission to upload this document type");
      }
    }

    const documentId = randomUUID();
    const s3Key = generateS3Key(data.bookingId, data.fileName, data.uploadedById);
    const bucket = getS3Bucket();

    try {
      // Upload to S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: data.mimeType,
          ServerSideEncryption: "AES256",
          Metadata: {
            "phi-data": "true",
            "booking-id": data.bookingId,
            "uploaded-by": data.uploadedById,
          },
        })
      );

      // Create document record
      const document = await documentRepository.create({
        id: documentId,
        bookingId: data.bookingId,
        uploadedById: data.uploadedById,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        section: data.section,
        category: finalCategory,
        s3Key,
      });

      // Log successful upload
      await auditService.log({
        action: "document.uploaded",
        userId: data.uploadedById,
        resourceType: "document",
        resourceId: documentId,
        metadata: {
          bookingId: data.bookingId,
          s3Key,
          fileName: data.fileName,
          fileSize: data.fileSize,
          section: data.section,
          category: finalCategory,
        },
        ipAddress,
        userAgent,
      });

      return document;
    } catch (error) {
      // Cleanup S3 object if database insert fails
      try {
        await deleteS3Object(s3Key);
      } catch (cleanupError) {
        console.error("Failed to cleanup S3 object:", cleanupError);
      }
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
      const downloadResult = await downloadS3ObjectStream(document.s3Key, context?.range);
      
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

    const url = await generatePresignedDownloadUrl(document.s3Key, document.fileName);

    await auditService.log({
      action: "document.presigned_url_generated",
      userId,
      impersonatedUserId: context?.impersonatedUserId,
      resourceType: "document",
      resourceId: id,
      metadata: {
        bookingId: document.bookingId,
        expiresIn: PRESIGNED_URL_EXPIRATION,
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

    console.log(`[getDocumentsByBooking] Found ${documents.length} documents for booking ${bookingId}`);
    console.log(`[getDocumentsByBooking] userId: ${userId}, userRole: ${filters?.userRole}`);

    // For impersonation, check access as the impersonated user
    const effectiveUserId = filters?.impersonatedUserId || userId;

    const accessibleDocuments = [];
    for (const doc of documents) {
      const hasAccess = await this.verifyAccess(doc, effectiveUserId, filters?.userRole);
      console.log(`[getDocumentsByBooking] Document ${doc.id} - hasAccess: ${hasAccess}`);

      if (hasAccess) {
        // Check download permission based on role
        if (filters?.userRole) {
          const role = documentPermissionsService.getUserRole(filters.userRole);
          const hasDownloadPermission = documentPermissionsService.hasPermission({ role, category: doc.category, permission: "download" });
          console.log(`[getDocumentsByBooking] Document ${doc.id} - role: ${role}, hasDownloadPermission: ${hasDownloadPermission}`);

          if (hasDownloadPermission) {
            accessibleDocuments.push(doc);
          }
        } else {
          accessibleDocuments.push(doc);
        }
      }
    }

    console.log(`[getDocumentsByBooking] Returning ${accessibleDocuments.length} accessible documents`);
    return accessibleDocuments;
  }

  private async verifyAccess(document: Document, userId: string, userRole?: string): Promise<boolean> {
    console.log(`[verifyAccess] Checking access for document ${document.id}`);
    console.log(`[verifyAccess] document.uploadedById: ${document.uploadedById}, userId: ${userId}`);

    // Check if user is the document uploader
    if (document.uploadedById === userId) {
      console.log(`[verifyAccess] User is the uploader - granting access`);
      return true;
    }

    try {
      // Use role-based access checks
      console.log(`[verifyAccess] Checking role-based access for bookingId: ${document.bookingId}`);
      const hasRoleBasedAccess = await this.checkRoleBasedAccess(document.bookingId, userId, userRole);
      console.log(`[verifyAccess] Role-based access result: ${hasRoleBasedAccess}`);
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