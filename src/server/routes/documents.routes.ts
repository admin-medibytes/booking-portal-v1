import { Hono } from "hono";
import { type } from "arktype";
import { documentService } from "@/server/services/document.service";
import { documentPermissionsService } from "@/server/services/document-permissions.service";
import { authMiddleware, requireAuth, checkImpersonation } from "@/server/middleware/auth.middleware";
import { validateMiddleware } from "@/server/middleware/validate.middleware";
import { documentUploadRateLimit, createRateLimiter } from "@/server/middleware/rate-limit.middleware";
import { env } from "@/lib/env";
import { convertToPdf } from "@/lib/pdf-converter";
import type { DocumentCategory } from "@/types/document";

const documentsRoutes = new Hono();

documentsRoutes.use("*", authMiddleware);
documentsRoutes.use("*", requireAuth);
documentsRoutes.use("*", checkImpersonation);

const MAX_FILE_SIZE = parseInt(env.S3_UPLOAD_MAX_SIZE || "104857600");

// Create download rate limiter - 100 downloads per hour per user
const documentDownloadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 downloads per hour
  keyPrefix: "document-download",
  skip: (c) => {
    const authContext = c.get("auth");
    const userRoles = authContext?.user?.role?.split(",").map((r) => r.trim()) || [];
    return userRoles.includes("admin");
  },
});

const uploadDocumentSchema = type({
  bookingId: "string",
  section: "'ime_documents' | 'supplementary_documents'",
  category: "'consent_form' | 'document_brief' | 'dictation' | 'draft_report' | 'final_report'",
  fileName: "string",
  fileSize: "number",
  mimeType: "string",
});

documentsRoutes.post(
  "/",
  documentUploadRateLimit,
  validateMiddleware(uploadDocumentSchema),
  async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File;
      const metadata = JSON.parse(formData.get("metadata") as string);

      if (!file) {
        return c.json({ error: "No file provided" }, 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return c.json(
          { error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes` },
          400
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const memberRole = 'user' in authContext && authContext.user && 'memberRole' in authContext.user
        ? (authContext.user as {memberRole?: string}).memberRole
        : undefined;

      const document = await documentService.uploadDocument({
        bookingId: metadata.bookingId,
        uploadedById: user.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        section: metadata.section,
        category: metadata.category,
        fileBuffer,
        userRole: memberRole,
      });

      return c.json({ data: document });
    } catch (error) {
      console.error("Document upload error:", error);
      return c.json({ error: "Failed to upload document" }, 500);
    }
  }
);

documentsRoutes.get(
  "/:id",
  documentDownloadRateLimit,
  async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      const session = authContext?.session;
      
      // Enhanced session validation
      if (!user || !session) {
        return c.json({ error: "Unauthorized", redirect: "/login" }, 401);
      }
      
      // Check for expired session
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return c.json({ error: "Session expired", redirect: "/login" }, 401);
      }

      const documentId = c.req.param("id");
      const memberRole = 'user' in authContext && authContext.user && 'memberRole' in authContext.user
        ? (authContext.user as {memberRole?: string}).memberRole
        : undefined;
      const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
      const userAgent = c.req.header("user-agent") || "unknown";
      const rangeHeader = c.req.header("range");
      
      // Parse range header if present
      let range: { start: number; end: number } | undefined;
      if (rangeHeader) {
        const matches = rangeHeader.match(/bytes=(\d+)-(\d*)?/);
        if (matches) {
          const start = parseInt(matches[1], 10);
          const end = matches[2] ? parseInt(matches[2], 10) : undefined;
          range = { start, end: end || start + 1024 * 1024 - 1 }; // Default 1MB chunks
        }
      }
      
      // Get download with comprehensive permission validation
      const downloadResult = await documentService.downloadDocument(
        documentId,
        user.id,
        {
          impersonatedUserId: session.impersonatedBy || undefined,
          ipAddress,
          userAgent,
          range,
          userRole: memberRole,
        }
      );
      
      const { stream, document, contentLength, contentRange, acceptRanges } = downloadResult;

      if (!stream) {
        return c.json({ error: "Document not found" }, 404);
      }

      // Check if referrer needs PDF-only download for final reports
      const role = documentPermissionsService.getUserRole(memberRole);
      const downloadFormat = documentPermissionsService.getDownloadFormat(role, document.category);
      
      if (downloadFormat.pdfOnly && document.mimeType !== "application/pdf") {
        // Convert to PDF for referrers downloading final reports
        const pdfStream = await convertToPdf(stream, document.mimeType, document.fileName);
        c.header("Content-Type", "application/pdf");
        c.header("Content-Disposition", `attachment; filename="${sanitizeFilename(document.fileName.replace(/\.[^.]+$/, '.pdf'))}"`);  
        return c.body(pdfStream);
      }
      
      // Set secure headers for normal download
      c.header("Content-Type", document.mimeType);
      c.header("Content-Disposition", `attachment; filename="${sanitizeFilename(document.fileName)}"`);
      c.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
      c.header("X-Content-Type-Options", "nosniff");
      c.header("X-Frame-Options", "DENY");
      
      // Set range headers if applicable
      if (acceptRanges) {
        c.header("Accept-Ranges", acceptRanges);
      }
      
      if (contentRange) {
        c.status(206); // Partial Content
        c.header("Content-Range", contentRange);
        c.header("Content-Length", contentLength?.toString() || "0");
      } else {
        c.header("Content-Length", document.fileSize.toString());
      }

      return c.body(stream);
    } catch (error) {
      console.error("Document download error:", error);
      
      if (error instanceof Error) {
        // Handle specific error cases without exposing internals
        switch (error.message) {
          case "Document not found":
            return c.json({ error: "Document not found" }, 404);
          case "Access denied":
            return c.json({ error: "Access denied" }, 403);
          case "Session expired":
            return c.json({ error: "Session expired", redirect: "/login" }, 401);
          default:
            // Log error details but don't expose them
            console.error("Unexpected download error:", error.stack);
            return c.json({ error: "Failed to download document" }, 500);
        }
      }
      
      return c.json({ error: "Failed to download document" }, 500);
    }
  }
);

documentsRoutes.delete("/:id", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const documentId = c.req.param("id");
    const memberRole = 'user' in authContext && authContext.user && 'memberRole' in authContext.user
      ? (authContext.user as {memberRole?: string}).memberRole
      : undefined;
    await documentService.deleteDocument(documentId, user.id, memberRole);

    return c.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Document deletion error:", error);
    
    if (error instanceof Error && error.message === "Document not found") {
      return c.json({ error: "Document not found" }, 404);
    }
    
    if (error instanceof Error && error.message === "Access denied") {
      return c.json({ error: "Access denied" }, 403);
    }
    
    return c.json({ error: "Failed to delete document" }, 500);
  }
});

documentsRoutes.get("/booking/:bookingId", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const bookingId = c.req.param("bookingId");
    const section = c.req.query("section") as "ime_documents" | "supplementary_documents" | undefined;
    const category = c.req.query("category") as DocumentCategory | undefined;
    const memberRole = 'user' in authContext && authContext.user && 'memberRole' in authContext.user
      ? (authContext.user as {memberRole?: string}).memberRole
      : undefined;
    
    const documents = await documentService.getDocumentsByBooking(
      bookingId,
      user.id,
      {
        section,
        category,
        userRole: memberRole,
      }
    );

    return c.json({ data: documents });
  } catch (error) {
    console.error("Document list error:", error);
    return c.json({ error: "Failed to fetch documents" }, 500);
  }
});

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  // Remove any path traversal attempts and special characters
  return filename
    .replace(/[\/\\]/g, "_") // Replace slashes
    .replace(/\.\.+/g, ".") // Remove multiple dots
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Keep only safe characters
    .slice(0, 255); // Limit length
}

export { documentsRoutes };