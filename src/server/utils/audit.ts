/**
 * Audit logging utility for HIPAA compliance
 * Logs all access to protected health information (PHI)
 */

import { db } from "../db";
import { auditLogs } from "../db/schema/audit";

export type AuditAction =
  | "DOCUMENT_UPLOAD_INITIATED"
  | "DOCUMENT_UPLOAD_COMPLETED"
  | "DOCUMENT_UPLOAD_FAILED"
  | "DOCUMENT_ACCESSED"
  | "DOCUMENT_DOWNLOADED"
  | "DOCUMENT_DELETED"
  | "DOCUMENT_UPDATED";

export interface AuditLogData {
  userId: string;
  action: AuditAction;
  entityType: "document";
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 * HIPAA Compliance: All access to PHI must be logged
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      changes: data.changes || {},
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main flow
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Log document upload initiation
 */
export async function logDocumentUploadInitiated(
  userId: string,
  documentId: string,
  metadata: {
    bookingId: string;
    fileName: string;
    fileSize: number;
    section: string;
    category: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    action: "DOCUMENT_UPLOAD_INITIATED",
    entityType: "document",
    entityId: documentId,
    changes: metadata,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document upload completion
 */
export async function logDocumentUploadCompleted(
  userId: string,
  documentId: string,
  metadata: {
    bookingId: string;
    s3Key: string;
    fileName: string;
    fileSize: number;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    action: "DOCUMENT_UPLOAD_COMPLETED",
    entityType: "document",
    entityId: documentId,
    changes: metadata,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document upload failure
 */
export async function logDocumentUploadFailed(
  userId: string,
  documentId: string,
  metadata: {
    bookingId: string;
    fileName: string;
    error: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    action: "DOCUMENT_UPLOAD_FAILED",
    entityType: "document",
    entityId: documentId,
    changes: metadata,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document access (viewing document metadata)
 */
export async function logDocumentAccessed(
  userId: string,
  documentId: string,
  metadata: {
    bookingId: string;
    fileName: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    action: "DOCUMENT_ACCESSED",
    entityType: "document",
    entityId: documentId,
    changes: metadata,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document download (generating download URL)
 */
export async function logDocumentDownloaded(
  userId: string,
  documentId: string,
  metadata: {
    bookingId: string;
    fileName: string;
    s3Key: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    action: "DOCUMENT_DOWNLOADED",
    entityType: "document",
    entityId: documentId,
    changes: metadata,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Log document deletion
 */
export async function logDocumentDeleted(
  userId: string,
  documentId: string,
  metadata: {
    bookingId: string;
    fileName: string;
    s3Key: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await createAuditLog({
    userId,
    action: "DOCUMENT_DELETED",
    entityType: "document",
    entityId: documentId,
    changes: metadata,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(headers: Headers): string | undefined {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    undefined
  );
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(headers: Headers): string | undefined {
  return headers.get("user-agent") || undefined;
}
