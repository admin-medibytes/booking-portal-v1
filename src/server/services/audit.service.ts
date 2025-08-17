import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

interface AuditLogData {
  userId: string;
  impersonatedUserId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(data: AuditLogData) {
    try {
      await db.insert(auditLogs).values({
        userId: data.userId,
        action: data.action,
        entityType: data.resourceType,
        entityId: data.resourceId,
        changes: {
          ...data.metadata,
          impersonatedUserId: data.impersonatedUserId,
        },
        ipAddress: data.ipAddress || "0.0.0.0",
        userAgent: data.userAgent || "Unknown",
      });
    } catch (error) {
      // Log errors but don't throw - audit logging should not break the main flow
      console.error("Failed to create audit log:", error);
    }
  }

  async getLogsForResource(resourceType: string, resourceId: string, limit = 50) {
    return db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, resourceType), eq(auditLogs.entityId, resourceId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getLogsForUser(userId: string, limit = 100) {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

export const auditService = new AuditService();